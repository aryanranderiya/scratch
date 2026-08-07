pub use commands::AppState;
pub mod board;
pub mod commands;
pub mod config;
pub mod error;
pub mod github;
pub mod models;
pub mod notes;
pub mod sync;

use board::BoardStore;
use commands::*;
use config::ConfigStore;
use github::GithubClient;
use notes::NotesStore;
use sync::SyncManager;
use tauri::Manager;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub fn init_state<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let config_dir = std::env::var("SCRATCH_CONFIG_DIR")
        .map(PathBuf::from)
        .ok()
        .or_else(|| app.path().app_config_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    let config_store = ConfigStore::new(config_dir.clone());
    let cfg = config_store.load().expect("failed to load config");
    let vault = PathBuf::from(&cfg.vault_path);
    std::fs::create_dir_all(&vault).ok();
    let notes_store = NotesStore::new(vault.clone());
    let board_store = BoardStore::new(vault);
    let sync_manager = SyncManager::new(cfg.vault_path);

    app.manage(AppState {
        config: config_store,
        github: Arc::new(GithubClient::new().with_config_dir(config_dir)),
        notes: Mutex::new(notes_store),
        board: Mutex::new(board_store),
        sync: sync_manager,
    });
}

pub fn build_app<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("scratch-asset", |ctx, request| {
            // Serve vault files (e.g. pasted images) as scratch-asset://<relative-path>
            let state = ctx.app_handle().state::<AppState>();
            let cfg = state.config.load().ok();
            let vault = cfg
                .as_ref()
                .map(|c| std::path::PathBuf::from(&c.vault_path))
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            let rel = request.uri().path().trim_start_matches('/');
            let safe_rel: std::path::PathBuf = rel
                .split('/')
                .filter(|seg| !seg.is_empty() && *seg != "..")
                .collect();
            match std::fs::read(vault.join(&safe_rel)) {
                Ok(bytes) => tauri::http::Response::builder()
                    .header(
                        tauri::http::header::CONTENT_TYPE,
                        mime_guess::from_path(&safe_rel).first_or_octet_stream().essence_str(),
                    )
                    .body(bytes)
                    .unwrap(),
                Err(_) => tauri::http::Response::builder()
                    .status(tauri::http::StatusCode::NOT_FOUND)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .setup(|app| {
            init_state(&app.handle().clone());

            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(true);
                    position_bottom_right(&window);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_notes,
            get_note,
            create_note,
            save_note,
            delete_note,
            save_image,
            get_board,
            save_board,
            get_github_user,
            list_orgs,
            list_user_repos,
            create_notes_repo,
            search_prs,
            sync_now,
            sync_status
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    build_app(tauri::Builder::default())
        .run(app_context())
        .expect("error while running tauri application");
}

pub fn app_context() -> tauri::Context<tauri::Wry> {
    tauri::generate_context!()
}

#[cfg(target_os = "macos")]
fn position_bottom_right<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    use tauri::{PhysicalPosition, Position};
    if let Some(monitor) = window.current_monitor().ok().flatten() {
        let msize = monitor.size();
        let mpos = monitor.position();
        if let Ok(wsize) = window.outer_size() {
            let margin = 24;
            let x = mpos.x + (msize.width as i32) - (wsize.width as i32) - margin;
            let y = mpos.y + (msize.height as i32) - (wsize.height as i32) - margin;
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }
    }
}
