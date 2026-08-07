use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub github_token: Option<String>,
    pub github_login: Option<String>,
    pub vault_path: String,
    pub notes_repo: Option<String>,
    pub sync_interval_seconds: u64,
    pub theme: String,
    pub hidden_orgs: Vec<String>,
    pub favorite_orgs: Vec<String>,
    pub view_mode: String,
    pub toolbar_collapsed: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::home_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."));

        // Default vault lives in iCloud Drive on macOS when available.
        let vault_path = default_vault_path(&home);

        Self {
            github_token: None,
            github_login: None,
            vault_path,
            notes_repo: None,
            sync_interval_seconds: 180,
            theme: "system".into(),
            hidden_orgs: Vec::new(),
            favorite_orgs: Vec::new(),
            view_mode: "notes".into(),
            toolbar_collapsed: false,
        }
    }
}

fn default_vault_path(home: &std::path::Path) -> String {
    #[cfg(target_os = "macos")]
    {
        let icloud = home
            .join("Library")
            .join("Mobile Documents")
            .join("com~apple~CloudDocs")
            .join("Scratch");
        if icloud.parent().is_some_and(|p| p.exists()) {
            return icloud.to_string_lossy().into_owned();
        }
    }
    home.join("Scratch").to_string_lossy().into_owned()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub excerpt: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrItem {
    pub id: String,
    pub repo: String,
    pub org: String,
    pub number: u32,
    pub title: String,
    pub url: String,
    pub is_draft: bool,
    pub check_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrGroup {
    pub org: String,
    pub prs: Vec<PrItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoChoice {
    pub full_name: String,
    pub is_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub syncing: bool,
    pub last_synced_at: Option<i64>,
    pub last_error: Option<String>,
    pub remote_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardColumn {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardState {
    pub columns: Vec<BoardColumn>,
    pub cards: std::collections::BTreeMap<String, String>,
}

impl Default for BoardState {
    fn default() -> Self {
        Self {
            columns: vec![
                BoardColumn { id: "new".into(), name: "New".into(), color: "#8e8e93".into() },
                BoardColumn { id: "in-progress".into(), name: "In Progress".into(), color: "#0a84ff".into() },
                BoardColumn { id: "needs-review".into(), name: "Needs Review".into(), color: "#ff9f0a".into() },
                BoardColumn { id: "manually-tested".into(), name: "Manually Tested".into(), color: "#bf5af2".into() },
                BoardColumn { id: "done".into(), name: "Done".into(), color: "#30d158".into() },
            ],
            cards: std::collections::BTreeMap::new(),
        }
    }
}
