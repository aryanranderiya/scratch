use crate::board::BoardStore;
use crate::config::ConfigStore;
use crate::error::AppResult;
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
    pub sync: SyncManager,
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
pub fn save_config(state: State<AppState>, config: AppConfig) -> AppResult<()> {
    state.config.save(&config)?;
    state.refresh_notes()?;
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

#[tauri::command]
pub fn get_github_user(token: String) -> AppResult<GithubUser> {
    let client = GithubClient::new();
    let user = tauri::async_runtime::block_on(client.get_user(&token))?;
    Ok(user)
}

#[tauri::command]
pub fn list_orgs(token: String) -> AppResult<Vec<String>> {
    let client = GithubClient::new();
    let orgs = tauri::async_runtime::block_on(client.list_orgs(&token))?;
    Ok(orgs)
}

#[tauri::command]
pub fn list_user_repos(token: String) -> AppResult<Vec<RepoChoice>> {
    let client = GithubClient::new();
    let repos = tauri::async_runtime::block_on(client.list_user_repos(&token))?;
    Ok(repos)
}

#[tauri::command]
pub fn create_notes_repo(token: String) -> AppResult<String> {
    let client = GithubClient::new();
    let full_name =
        tauri::async_runtime::block_on(client.create_notes_repo(&token))?;
    Ok(full_name)
}

#[tauri::command]
pub fn search_prs(state: State<AppState>) -> AppResult<Vec<PrGroup>> {
    let cfg = state.config.load()?;
    let token = cfg.github_token.clone().unwrap_or_default();
    let login = cfg.github_login.clone().unwrap_or_default();
    if token.is_empty() || login.is_empty() {
        return Ok(Vec::new());
    }
    let groups =
        tauri::async_runtime::block_on(state.github.search_prs(&token, &login))?;
    Ok(groups)
}

#[tauri::command]
pub fn sync_now(state: State<AppState>) -> AppResult<SyncStatus> {
    let cfg = state.config.load()?;
    let token = cfg.github_token.clone().unwrap_or_default();
    state.refresh_notes()?;
    state.sync.sync(&token)?;
    let remote_configured = cfg.notes_repo.is_some();
    Ok(state.sync.status(remote_configured))
}

#[tauri::command]
pub fn sync_status(state: State<AppState>) -> AppResult<SyncStatus> {
    let cfg = state.config.load()?;
    let remote_configured = cfg.notes_repo.is_some();
    Ok(state.sync.status(remote_configured))
}
