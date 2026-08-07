use crate::error::{AppError, AppResult};
use crate::models::{GithubUser, PrGroup, PrItem, RepoChoice};
use chrono::Utc;
use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

pub struct GithubClient {
    client: reqwest::Client,
    cache: Mutex<PrCache>,
    cache_path: Option<PathBuf>,
    refreshing: AtomicBool,
}

#[derive(Clone, Serialize, Deserialize)]
struct PrCache {
    groups: Vec<PrGroup>,
    fetched_at: i64,
    login: Option<String>,
}

const PR_CACHE_TTL_SECONDS: i64 = 120;
const PR_CACHE_STALE_LIMIT_SECONDS: i64 = 24 * 60 * 60;

impl GithubClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("scratch-app")
            .build()
            .expect("failed to build http client");
        Self {
            client,
            cache: Mutex::new(PrCache {
                groups: Vec::new(),
                fetched_at: 0,
                login: None,
            }),
            cache_path: None,
            refreshing: AtomicBool::new(false),
        }
    }

    /// Persist search results to a JSON file alongside the config, so a cold
    /// start can serve from disk while the network refresh runs in the
    /// background. Clients built with the default `new()` (one-off commands)
    /// keep the in-memory-only behavior.
    pub fn with_config_dir(mut self, config_dir: PathBuf) -> Self {
        self.cache_path = Some(config_dir.join("pr_cache.json"));
        self
    }

    async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        token: &str,
        url: &str,
    ) -> AppResult<T> {
        let resp = self
            .client
            .get(url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| AppError::Github(format!("request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp
                .text()
                .await
                .unwrap_or_else(|_| "no body".into());
            return Err(AppError::Github(format!(
                "GET {url} -> {status}: {body}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| AppError::Github(format!("bad json from {url}: {e}")))
    }

    pub async fn get_user(&self, token: &str) -> AppResult<GithubUser> {
        self.get(token, "https://api.github.com/user").await
    }

    pub async fn list_orgs(&self, token: &str) -> AppResult<Vec<String>> {
        #[derive(Deserialize)]
        struct Org {
            login: String,
        }
        let orgs: Vec<Org> = self
            .get(
                token,
                "https://api.github.com/user/orgs?per_page=100",
            )
            .await?;
        Ok(orgs.into_iter().map(|o| o.login).collect())
    }

    pub async fn list_user_repos(&self, token: &str) -> AppResult<Vec<RepoChoice>> {
        #[derive(Deserialize)]
        struct Repo {
            full_name: String,
            private: bool,
        }
        let repos: Vec<Repo> = self
            .get(
                token,
                "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member",
            )
            .await?;
        Ok(repos
            .into_iter()
            .map(|r| RepoChoice {
                full_name: r.full_name,
                is_private: r.private,
            })
            .collect())
    }

    pub async fn create_notes_repo(&self, token: &str) -> AppResult<String> {
        #[derive(serde::Serialize)]
        struct CreateRepo<'a> {
            name: &'a str,
            private: bool,
            description: &'a str,
        }
        #[derive(Deserialize)]
        struct Repo {
            full_name: String,
        }
        let body = CreateRepo {
            name: "scratch-notes",
            private: true,
            description: "Notes synced from Scratch",
        };
        let url = "https://api.github.com/user/repos";
        let resp = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/vnd.github+json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Github(format!("create repo failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp
                .text()
                .await
                .unwrap_or_else(|_| "no body".into());
            // 422 = already exists → resolve by lookup
            if status == reqwest::StatusCode::UNPROCESSABLE_ENTITY {
                let repo: Repo = self
                    .get(token, "https://api.github.com/repos/aryanranderiya/scratch-notes")
                    .await?;
                return Ok(repo.full_name);
            }
            return Err(AppError::Github(format!("POST {url} -> {status}: {text}")));
        }

        let repo: Repo = resp
            .json()
            .await
            .map_err(|e| AppError::Github(format!("bad create repo json: {e}")))?;
        Ok(repo.full_name)
    }

    pub async fn search_prs(
        self: &Arc<Self>,
        token: &str,
        login: &str,
        force: bool,
    ) -> AppResult<Vec<PrGroup>> {
        if !force {
            if let Some(groups) = self.memory_cache_if_fresh(login) {
                return Ok(groups);
            }

            if let Some(disk) = self.load_disk_cache() {
                if disk.login.as_deref() == Some(login) {
                    let age = Utc::now().timestamp() - disk.fetched_at;
                    if age < PR_CACHE_TTL_SECONDS {
                        let groups = disk.groups;
                        self.fill_memory(groups.clone(), disk.fetched_at, login);
                        return Ok(groups);
                    }
                    if age < PR_CACHE_STALE_LIMIT_SECONDS {
                        let groups = disk.groups;
                        self.fill_memory(groups.clone(), disk.fetched_at, login);
                        self.spawn_refresh_if_idle(token, login);
                        return Ok(groups);
                    }
                }
            }
        }

        let groups = self.fetch_prs(token, login).await?;
        self.store_cache(&groups, login);
        Ok(groups)
    }

    /// Full network fetch: org list, per-org search queries in parallel, then
    /// per-PR check-runs enrichment with bounded concurrency.
    async fn fetch_prs(&self, token: &str, login: &str) -> AppResult<Vec<PrGroup>> {
        let mut orgs = vec![login.to_string()];
        let org_list = self.list_orgs(token).await?;
        orgs.extend(org_list);

        let token_owned = token.to_string();
        let login_owned = login.to_string();
        let results: Vec<AppResult<(String, Vec<PrItem>)>> = stream::iter(orgs)
            .map(|org| {
                let token = token_owned.clone();
                let login = login_owned.clone();
                async move {
                    let url = if org == login {
                        format!(
                            "https://api.github.com/search/issues?q=is:open+is:pr+author:{login}+user:{login}&per_page=100&sort=updated"
                        )
                    } else {
                        format!(
                            "https://api.github.com/search/issues?q=is:open+is:pr+author:{login}+org:{org}&per_page=100&sort=updated"
                        )
                    };
                    let items = self.fetch_pr_page(&token, &url).await?;
                    Ok((org, items))
                }
            })
            .buffer_unordered(8)
            .collect()
            .await;

        let results: Vec<(String, Vec<PrItem>)> =
            results.into_iter().collect::<AppResult<_>>()?;

        let prs: Vec<PrItem> = results
            .iter()
            .flat_map(|(_, items)| items.iter().cloned())
            .collect();
        let enriched = self.enrich_check_status(token, prs).await?;

        let mut groups: Vec<PrGroup> = results
            .into_iter()
            .map(|(org, _)| PrGroup {
                org: org.clone(),
                prs: enriched.iter().filter(|p| p.org == org).cloned().collect(),
            })
            .collect();
        groups.sort_by(|a, b| a.org.cmp(&b.org));
        Ok(groups)
    }

    fn memory_cache_if_fresh(&self, login: &str) -> Option<Vec<PrGroup>> {
        let cache = self.cache.lock().unwrap();
        let now = Utc::now().timestamp();
        if cache.fetched_at > 0
            && now - cache.fetched_at < PR_CACHE_TTL_SECONDS
            && cache.login.as_deref() == Some(login)
        {
            Some(cache.groups.clone())
        } else {
            None
        }
    }

    fn fill_memory(&self, groups: Vec<PrGroup>, fetched_at: i64, login: &str) {
        let mut cache = self.cache.lock().unwrap();
        cache.groups = groups;
        cache.fetched_at = fetched_at;
        cache.login = Some(login.to_string());
    }

    fn store_cache(&self, groups: &[PrGroup], login: &str) {
        let now = Utc::now().timestamp();
        let cache = PrCache {
            groups: groups.to_vec(),
            fetched_at: now,
            login: Some(login.to_string()),
        };
        *self.cache.lock().unwrap() = cache.clone();
        self.save_disk_cache(&cache);
    }

    fn load_disk_cache(&self) -> Option<PrCache> {
        let path = self.cache_path.as_ref()?;
        let content = std::fs::read_to_string(path).ok()?;
        match serde_json::from_str(&content) {
            Ok(cache) => Some(cache),
            Err(e) => {
                eprintln!("pr cache unreadable at {}: {e}", path.display());
                None
            }
        }
    }

    fn save_disk_cache(&self, cache: &PrCache) {
        let Some(path) = self.cache_path.as_ref() else {
            return;
        };
        let content = match serde_json::to_string(cache) {
            Ok(content) => content,
            Err(e) => {
                eprintln!("pr cache serialization failed: {e}");
                return;
            }
        };
        if let Some(parent) = path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                eprintln!("pr cache dir creation failed: {e}");
                return;
            }
        }
        if let Err(e) = std::fs::write(path, content) {
            eprintln!("pr cache write failed at {}: {e}", path.display());
        }
    }

    /// Serve stale data immediately and refetch in the background, unless a
    /// refresh is already in flight.
    fn spawn_refresh_if_idle(self: &Arc<Self>, token: &str, login: &str) {
        if self
            .refreshing
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }
        let this = Arc::clone(self);
        let token = token.to_string();
        let login = login.to_string();
        tauri::async_runtime::spawn(async move {
            match this.fetch_prs(&token, &login).await {
                Ok(groups) => this.store_cache(&groups, &login),
                Err(e) => eprintln!("background pr refresh failed: {e}"),
            }
            this.refreshing.store(false, Ordering::SeqCst);
        });
    }

    async fn enrich_check_status(&self, token: &str, prs: Vec<PrItem>) -> AppResult<Vec<PrItem>> {
        let client = &self.client;
        let results: Vec<AppResult<PrItem>> = stream::iter(prs)
            .map(|pr| {
                let token = token.to_string();
                let url = format!(
                    "https://api.github.com/repos/{}/commits/refs/pull/{}/head/check-runs?per_page=100",
                    pr.repo, pr.number
                );
                async move {
                    let resp = client
                        .get(&url)
                        .header("Authorization", format!("Bearer {token}"))
                        .header("Accept", "application/vnd.github+json")
                        .send()
                        .await
                        .map_err(|e| AppError::Github(format!("check-runs request failed: {e}")))?;

                    let mut pr = pr;
                    if !resp.status().is_success() {
                        // A missing/unrunnable checks suite is not a failure.
                        pr.check_status = None;
                        return Ok(pr);
                    }

                    let runs: CheckRuns = resp
                        .json()
                        .await
                        .map_err(|e| AppError::Github(format!("bad check-runs json: {e}")))?;
                    pr.check_status = derive_check_status(&runs);
                    Ok(pr)
                }
            })
            .buffer_unordered(8)
            .collect()
            .await;

        results.into_iter().collect()
    }

    async fn fetch_pr_page(&self, token: &str, url: &str) -> AppResult<Vec<PrItem>> {
        #[derive(Deserialize)]
        struct SearchResponse {
            items: Vec<SearchItem>,
        }
        #[derive(Deserialize)]
        struct SearchItem {
            number: u32,
            title: String,
            html_url: String,
            repository_url: String,
            #[serde(default)]
            draft: bool,
            #[serde(default)]
            pull_request: Option<serde_json::Value>,
        }

        let resp: SearchResponse = self.get(token, url).await?;
        Ok(resp
            .items
            .into_iter()
            .filter(|i| i.pull_request.is_some())
            .map(|i| {
                let repo = i
                    .repository_url
                    .rsplit('/')
                    .take(2)
                    .collect::<Vec<_>>();
                let (org, repo_name) = match repo.as_slice() {
                    [repo_name, org] => (org.to_string(), repo_name.to_string()),
                    _ => ("unknown".into(), "unknown".into()),
                };
                PrItem {
                    id: format!("{org}/{repo_name}#{}", i.number),
                    repo: format!("{org}/{repo_name}"),
                    org: org.clone(),
                    number: i.number,
                    title: i.title,
                    url: i.html_url,
                    is_draft: i.draft,
                    check_status: None,
                }
            })
            .collect())
    }
}

#[derive(Deserialize)]
struct CheckRuns {
    total_count: u32,
    check_runs: Vec<CheckRun>,
}

#[derive(Deserialize)]
struct CheckRun {
    status: String,
    conclusion: Option<String>,
}

fn derive_check_status(runs: &CheckRuns) -> Option<String> {
    if runs.total_count == 0 {
        return None;
    }
    let any_failure = runs.check_runs.iter().any(|r| {
        r.status == "completed"
            && matches!(
                r.conclusion.as_deref(),
                Some("failure" | "timed_out" | "action_required" | "cancelled")
            )
    });
    if any_failure {
        return Some("failure".into());
    }
    let any_pending = runs
        .check_runs
        .iter()
        .any(|r| r.status == "queued" || r.status == "in_progress");
    if any_pending {
        return Some("pending".into());
    }
    Some("success".into())
}

impl Default for GithubClient {
    fn default() -> Self {
        Self::new()
    }
}
