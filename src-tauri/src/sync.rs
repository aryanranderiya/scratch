use crate::error::{AppError, AppResult};
use crate::models::SyncStatus;
use git2::{Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository, Signature};
use std::path::Path;
use std::sync::Mutex;

pub struct SyncManager {
    vault: Mutex<String>,
    last_synced_at: Mutex<Option<i64>>,
    last_error: Mutex<Option<String>>,
    syncing: Mutex<bool>,
}

impl SyncManager {
    pub fn new(vault: String) -> Self {
        Self {
            vault: Mutex::new(vault),
            last_synced_at: Mutex::new(None),
            last_error: Mutex::new(None),
            syncing: Mutex::new(false),
        }
    }

    pub fn set_vault(&self, vault: String) {
        *self.vault.lock().unwrap() = vault;
    }

    fn repo_path(&self) -> String {
        self.vault.lock().unwrap().clone()
    }

    fn ensure_repo(&self) -> AppResult<Repository> {
        let path_str = self.repo_path();
        let path = Path::new(&path_str);
        std::fs::create_dir_all(path)
            .map_err(|e| AppError::Io(format!("create vault dir: {e}")))?;
        match Repository::open(path) {
            Ok(repo) => Ok(repo),
            Err(_) => Repository::init(path).map_err(|e| AppError::Git(e.to_string())),
        }
    }

    /// Ensure the local branch is `main` (rename from `master` if needed) so
    /// pushes line up with GitHub's default branch.
    fn ensure_main_branch(&self, repo: &Repository) -> AppResult<()> {
        let head = repo.head().ok();
        if let Some(head) = head {
            if head.is_branch() {
                let name = head.shorthand().unwrap_or("main").to_string();
                if name == "master" {
                    repo.reference(
                        "refs/heads/main",
                        head.peel_to_commit().map_err(|e| AppError::Git(e.to_string()))?.id(),
                        true,
                        "rename master to main",
                    )
                    .map_err(|e| AppError::Git(format!("rename branch: {e}")))?;
                    repo.set_head("refs/heads/main")
                        .map_err(|e| AppError::Git(format!("set head: {e}")))?;
                }
            }
        }
        Ok(())
    }

    /// Set the `origin` remote to the configured notes repo, creating it if
    /// missing. Returns Ok(false) when no notes repo is configured (local-only).
    fn ensure_remote(&self, repo: &Repository, repo_url: Option<&str>) -> AppResult<bool> {
        let Some(url) = repo_url.filter(|u| !u.is_empty()) else {
            return Ok(false);
        };
        let remote_url = format!("https://github.com/{url}.git");
        match repo.find_remote("origin") {
            Ok(r) => {
                if r.url().map(|u| u != remote_url).unwrap_or(true) {
                    repo.remote_set_url("origin", &remote_url)
                        .map_err(|e| AppError::Git(format!("set remote url: {e}")))?;
                }
            }
            Err(_) => {
                repo.remote("origin", &remote_url)
                    .map_err(|e| AppError::Git(format!("add remote: {e}")))?;
            }
        }
        Ok(true)
    }

    fn is_dirty(&self, repo: &Repository) -> AppResult<bool> {
        let statuses = repo
            .statuses(None)
            .map_err(|e| AppError::Git(format!("status: {e}")))?;
        Ok(statuses
            .iter()
            .any(|s| s.status() != git2::Status::CURRENT))
    }

    fn commit_all(&self, repo: &Repository, message: &str) -> AppResult<bool> {
        if !self.is_dirty(repo)? {
            return Ok(false);
        }
        let mut index = repo
            .index()
            .map_err(|e| AppError::Git(format!("index: {e}")))?;
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| AppError::Git(format!("add: {e}")))?;
        index
            .write()
            .map_err(|e| AppError::Git(format!("write index: {e}")))?;
        let tree_id = index
            .write_tree()
            .map_err(|e| AppError::Git(format!("write tree: {e}")))?;
        let tree = repo
            .find_tree(tree_id)
            .map_err(|e| AppError::Git(format!("find tree: {e}")))?;

        let sig = Signature::now("Scratch", "scratch@local")
            .map_err(|e| AppError::Git(format!("signature: {e}")))?;

        let parent = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_commit().ok());
        let parent_ids: Vec<&git2::Commit> = parent.as_ref().into_iter().collect();

        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_ids)
            .map_err(|e| AppError::Git(format!("commit: {e}")))?;
        Ok(true)
    }

    fn remote_credentials<'a>(token: &'a str) -> RemoteCallbacks<'a> {
        let mut cb = RemoteCallbacks::new();
        cb.credentials(move |_url, username_from_url, _allowed| {
            Cred::userpass_plaintext(username_from_url.unwrap_or("x-access-token"), token)
        });
        cb
    }

    fn current_branch(&self, repo: &Repository) -> AppResult<String> {
        let head = repo
            .head()
            .map_err(|e| AppError::Git(format!("head: {e}")))?;
        if head.is_branch() {
            Ok(head
                .shorthand()
                .unwrap_or("main")
                .to_string())
        } else {
            Ok("main".into())
        }
    }

    fn push_to_remote(&self, token: &str) -> AppResult<()> {
        let repo = self.ensure_repo()?;
        let mut remote = match repo.find_remote("origin") {
            Ok(r) => r,
            Err(_) => return Ok(()),
        };

        let cb = Self::remote_credentials(token);
        let mut push_opts = PushOptions::new();
        push_opts.remote_callbacks(cb);

        let branch = self.current_branch(&repo)?;
        let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
        remote
            .push(&[refspec.as_str()], Some(&mut push_opts))
            .map_err(|e| AppError::Git(format!("push: {e}")))?;
        Ok(())
    }

    fn pull_from_remote(&self, token: &str) -> AppResult<()> {
        let repo = self.ensure_repo()?;
        let mut remote = match repo.find_remote("origin") {
            Ok(r) => r,
            Err(_) => return Ok(()),
        };

        let cb = Self::remote_credentials(token);
        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(cb);

        let branch = self.current_branch(&repo)?;
        let refspec = format!("+refs/heads/{branch}:refs/remotes/origin/{branch}");
        remote
            .fetch(&[refspec.as_str()], Some(&mut fetch_opts), None)
            .map_err(|e| AppError::Git(format!("fetch: {e}")))?;

        let remote_ref_name = format!("refs/remotes/origin/{branch}");
        let Ok(remote_ref) = repo.find_reference(&remote_ref_name) else {
            return Ok(()); // no remote branch yet — nothing to pull
        };
        let remote_commit = remote_ref
            .peel_to_commit()
            .map_err(|e| AppError::Git(format!("peel remote: {e}")))?;

        let Ok(local_head) = repo.head() else {
            // no local commits yet — adopt remote branch
            let refname = format!("refs/heads/{branch}");
            repo.reference(&refname, remote_commit.id(), true, "set branch")
                .map_err(|e| AppError::Git(format!("set branch: {e}")))?;
            repo.set_head(&refname)
                .map_err(|e| AppError::Git(format!("set head: {e}")))?;
            checkout(&repo, remote_commit.id())?;
            return Ok(());
        };
        let local_commit = local_head
            .peel_to_commit()
            .map_err(|e| AppError::Git(format!("peel local: {e}")))?;

        let base = repo.merge_base(local_commit.id(), remote_commit.id());
        match base {
            Ok(base) if base == remote_commit.id() => Ok(()), // already up to date
            Ok(base) if base == local_commit.id() => {
                // fast-forward local branch to remote
                let refname = current_branch_ref(&repo)?;
                repo.find_reference(&refname)
                    .map_err(|e| AppError::Git(format!("branch ref: {e}")))?
                    .set_target(remote_commit.id(), "fast-forward")
                    .map_err(|e| AppError::Git(format!("ff: {e}")))?;
                repo.set_head(&refname)
                    .map_err(|e| AppError::Git(format!("set head: {e}")))?;
                checkout(&repo, remote_commit.id())
            }
            _ => Ok(()), // diverged — local commit already made; push reconciles
        }
    }

    pub fn sync(&self, token: &str, notes_repo: Option<&str>) -> AppResult<bool> {
        {
            let mut s = self.syncing.lock().unwrap();
            if *s {
                return Ok(false);
            }
            *s = true;
        }

        let result = (|| -> AppResult<bool> {
            let repo = self.ensure_repo()?;
            self.ensure_main_branch(&repo)?;
            let committed = self.commit_all(&repo, "scratch: sync")?;

            let has_remote = self.ensure_remote(&repo, notes_repo)?;
            if has_remote {
                self.pull_from_remote(token)?;
                let repo2 = self.ensure_repo()?;
                self.commit_all(&repo2, "scratch: merge")?;
                self.push_to_remote(token)?;
            }

            *self.last_synced_at.lock().unwrap() = Some(chrono::Utc::now().timestamp());
            *self.last_error.lock().unwrap() = None;
            Ok(committed)
        })();

        match result {
            Ok(v) => {
                *self.syncing.lock().unwrap() = false;
                Ok(v)
            }
            Err(e) => {
                *self.last_error.lock().unwrap() = Some(e.to_string());
                *self.syncing.lock().unwrap() = false;
                Err(e)
            }
        }
    }

    pub fn status(&self, remote_configured: bool) -> SyncStatus {
        SyncStatus {
            syncing: *self.syncing.lock().unwrap(),
            last_synced_at: *self.last_synced_at.lock().unwrap(),
            last_error: self.last_error.lock().unwrap().clone(),
            remote_configured,
        }
    }
}

fn current_branch_ref(repo: &Repository) -> AppResult<String> {
    let head = repo
        .head()
        .map_err(|e| AppError::Git(format!("head: {e}")))?;
    if let Some(name) = head.name() {
        Ok(name.to_string())
    } else {
        Ok("refs/heads/main".into())
    }
}

fn checkout(repo: &Repository, commit_id: git2::Oid) -> AppResult<()> {
    let object = repo
        .find_object(commit_id, None)
        .map_err(|e| AppError::Git(format!("find object: {e}")))?;
    let mut co = git2::build::CheckoutBuilder::new();
    co.force();
    repo.checkout_tree(&object, Some(&mut co))
        .map_err(|e| AppError::Git(format!("checkout tree: {e}")))?;
    Ok(())
}
