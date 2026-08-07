use crate::board::BoardStore;
use crate::config::ConfigStore;
use crate::error::{AppError, AppResult};
use crate::github::GithubClient;
use crate::models::*;
use crate::notes::NotesStore;
use crate::sync::SyncManager;
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct AppState {
    pub config: ConfigStore,
    pub github: Arc<GithubClient>,
    pub notes: Mutex<NotesStore>,
    pub board: Mutex<BoardStore>,
    pub sync: Arc<SyncManager>,
}

impl AppState {
    pub fn refresh_notes(&self) -> AppResult<()> {
        let cfg = self.config.load()?;
        let notes = NotesStore::new(std::path::PathBuf::from(cfg.vault_path.clone()));
        *self.notes.lock().unwrap() = notes;
        let board = BoardStore::new(std::path::PathBuf::from(cfg.vault_path.clone()));
        *self.board.lock().unwrap() = board;
        self.sync.set_vault(cfg.vault_path);
        Ok(())
    }
}

#[tauri::command]
pub fn get_board(state: State<AppState>) -> AppResult<BoardState> {
    let cfg = state.config.load()?;
    let board = BoardStore::new(std::path::PathBuf::from(cfg.vault_path));
    board.get()
}

#[tauri::command]
pub fn save_board(state: State<AppState>, board: BoardState) -> AppResult<()> {
    let cfg = state.config.load()?;
    let store = BoardStore::new(std::path::PathBuf::from(cfg.vault_path));
    store.save(&board)
}

#[tauri::command]
pub fn get_config(state: State<AppState>) -> AppResult<AppConfig> {
    let cfg = state.config.load()?;
    Ok(cfg)
}

#[tauri::command]
pub async fn save_config(state: State<'_, AppState>, config: AppConfig) -> AppResult<()> {
    state.config.save(&config)?;
    state.refresh_notes()?;
    // Wire the origin remote as soon as a notes repo is chosen, so the first
    // autosave cycle syncs instead of silently staying local. Run off the main
    // thread so the first sync never freezes the UI.
    let token = config.github_token.clone().unwrap_or_default();
    let notes_repo = config.notes_repo.clone();
    if !token.is_empty() && notes_repo.is_some() {
        // Best-effort background sync: wire origin + push immediately. Its
        // outcome (including errors) is surfaced via sync_status, not by
        // failing the config save.
        let sync = state.sync.clone();
        let token = token.clone();
        let notes_repo = notes_repo.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || {
            sync.sync(&token, notes_repo.as_deref())
        })
        .await;
    }
    Ok(())
}

#[tauri::command]
pub fn list_notes(state: State<AppState>) -> AppResult<Vec<NoteMeta>> {
    let cfg = state.config.load()?;
    let notes = NotesStore::new(std::path::PathBuf::from(cfg.vault_path));
    notes.list()
}

#[tauri::command]
pub fn get_note(state: State<AppState>, id: String) -> AppResult<Note> {
    let cfg = state.config.load()?;
    let notes = NotesStore::new(std::path::PathBuf::from(cfg.vault_path));
    notes.get(&id)
}

#[tauri::command]
pub fn create_note(state: State<AppState>) -> AppResult<Note> {
    let cfg = state.config.load()?;
    let notes = NotesStore::new(std::path::PathBuf::from(cfg.vault_path));
    notes.create()
}

#[tauri::command]
pub fn save_note(state: State<AppState>, note: Note) -> AppResult<()> {
    let cfg = state.config.load()?;
    let notes = NotesStore::new(std::path::PathBuf::from(cfg.vault_path));
    notes.write(&note)
}

#[tauri::command]
pub fn delete_note(state: State<AppState>, id: String) -> AppResult<()> {
    let cfg = state.config.load()?;
    let notes = NotesStore::new(std::path::PathBuf::from(cfg.vault_path));
    notes.delete(&id)
}

/// Persist a pasted image into the vault's asset folder and return the
/// relative path (e.g. "scratch-assets/abc.png") for use in markdown.
#[tauri::command]
pub fn save_image(state: State<AppState>, bytes: Vec<u8>, ext: Option<String>) -> AppResult<String> {
    let cfg = state.config.load()?;
    let vault = std::path::PathBuf::from(&cfg.vault_path);
    let assets = vault.join("scratch-assets");
    std::fs::create_dir_all(&assets)
        .map_err(|e| AppError::Io(format!("create assets dir: {e}")))?;

    let ext = ext
        .filter(|e| !e.is_empty())
        .unwrap_or_else(|| "png".into())
        .trim_start_matches('.')
        .to_lowercase();
    let filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    std::fs::write(assets.join(&filename), &bytes)
        .map_err(|e| AppError::Io(format!("write image: {e}")))?;
    Ok(format!("scratch-assets/{filename}"))
}

#[tauri::command]
pub async fn get_github_user(token: String) -> AppResult<GithubUser> {
    let client = GithubClient::new();
    let user = client.get_user(&token).await?;
    Ok(user)
}

#[tauri::command]
pub async fn list_orgs(token: String) -> AppResult<Vec<String>> {
    let client = GithubClient::new();
    let orgs = client.list_orgs(&token).await?;
    Ok(orgs)
}

#[tauri::command]
pub async fn list_user_repos(token: String) -> AppResult<Vec<RepoChoice>> {
    let client = GithubClient::new();
    let repos = client.list_user_repos(&token).await?;
    Ok(repos)
}

#[tauri::command]
pub async fn create_notes_repo(token: String) -> AppResult<String> {
    let client = GithubClient::new();
    let full_name = client.create_notes_repo(&token).await?;
    Ok(full_name)
}

#[tauri::command]
pub async fn search_prs(
    state: State<'_, AppState>,
    force: Option<bool>,
) -> AppResult<Vec<PrGroup>> {
    let cfg = state.config.load()?;
    let token = cfg.github_token.clone().unwrap_or_default();
    let login = cfg.github_login.clone().unwrap_or_default();
    if token.is_empty() || login.is_empty() {
        return Ok(Vec::new());
    }
    let groups = state
        .github
        .search_prs(&token, &login, force.unwrap_or(false))
        .await?;
    Ok(groups)
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> AppResult<SyncStatus> {
    let cfg = state.config.load()?;
    let token = cfg.github_token.clone().unwrap_or_default();
    let notes_repo = cfg.notes_repo.clone();
    state.refresh_notes()?;
    {
        let sync = state.sync.clone();
        let token = token.clone();
        let notes_repo = notes_repo.clone();
        tauri::async_runtime::spawn_blocking(move || sync.sync(&token, notes_repo.as_deref()))
            .await
            .map_err(|e| AppError::Sync(format!("sync task join: {e}")))??;
    }
    let remote_configured = cfg.notes_repo.is_some();
    Ok(state.sync.status(remote_configured))
}

#[tauri::command]
pub fn sync_status(state: State<AppState>) -> AppResult<SyncStatus> {
    let cfg = state.config.load()?;
    let remote_configured = cfg.notes_repo.is_some();
    Ok(state.sync.status(remote_configured))
}
