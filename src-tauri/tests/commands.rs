use std::sync::{Mutex, OnceLock};
use tempfile::TempDir;

use scratch_lib::commands::*;
use scratch_lib::models;
use scratch_lib::{build_app, init_state};
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri::Manager;

fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

struct TestApp {
    app: tauri::App<tauri::test::MockRuntime>,
}

fn setup_app() -> TestApp {
    let _guard = env_lock().lock().unwrap();
    let config_dir = TempDir::new().unwrap();
    let vault = TempDir::new().unwrap();
    std::env::set_var("SCRATCH_CONFIG_DIR", config_dir.path());

    let app = build_app(mock_builder())
        .build(mock_context(noop_assets()))
        .expect("failed to build app");
    init_state(&app.handle());

    // point the vault at a temp dir
    {
        let cfg: models::AppConfig = get_config(app.state()).unwrap();
        let mut cfg = cfg;
        cfg.vault_path = vault.path().to_string_lossy().into_owned();
        tauri::async_runtime::block_on(save_config(app.state(), cfg)).unwrap();
    }

    // keep tempdirs alive for the duration of the test
    let _dirs = (config_dir, vault);
    std::mem::forget(_dirs);

    TestApp { app }
}

#[test]
fn config_roundtrip() {
    let t = setup_app();
    let cfg: models::AppConfig = get_config(t.app.state()).unwrap();
    let updated = models::AppConfig {
        github_token: None,
        github_login: Some("testuser".into()),
        vault_path: "/tmp/vault".into(),
        notes_repo: Some("testuser/scratch-notes".into()),
        sync_interval_seconds: 300,
        theme: "dark".into(),
        hidden_orgs: Vec::new(),
        favorite_orgs: Vec::new(),
        view_mode: "notes".into(),
        toolbar_collapsed: false,
    };
    tauri::async_runtime::block_on(save_config(t.app.state(), updated.clone())).unwrap();
    let cfg2: models::AppConfig = get_config(t.app.state()).unwrap();
    assert_eq!(cfg2.vault_path, "/tmp/vault");
    assert_eq!(cfg2.sync_interval_seconds, 300);
    assert_eq!(cfg2.theme, "dark");
    assert_eq!(cfg2.github_login.as_deref(), Some("testuser"));
    assert_eq!(cfg.notes_repo, None);
}

#[test]
fn notes_crud_roundtrip() {
    let t = setup_app();

    let created: models::Note = create_note(t.app.state()).unwrap();
    let id = created.id.clone();
    assert_eq!(created.title, "Untitled");

    let mut note = created.clone();
    note.title = "My First Note".into();
    note.content =
        "# Heading\n\nSome body text with **bold** and `code`.\n\n- item one\n- item two"
            .into();
    save_note(t.app.state(), note.clone()).unwrap();

    let fetched: models::Note = get_note(t.app.state(), id.clone()).unwrap();
    assert_eq!(fetched.title, "My First Note");
    assert!(fetched.content.contains("**bold**"));

    let notes: Vec<models::NoteMeta> = list_notes(t.app.state()).unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].title, "My First Note");
    assert_eq!(
        notes[0].excerpt,
        "Some body text with bold and code. - item one - item two"
    );

    delete_note(t.app.state(), id).unwrap();
    let notes: Vec<models::NoteMeta> = list_notes(t.app.state()).unwrap();
    assert_eq!(notes.len(), 0);
}

#[test]
fn notes_persist_across_restart() {
    let _guard = env_lock().lock().unwrap();
    let config_dir = TempDir::new().unwrap();
    let vault = TempDir::new().unwrap();
    std::env::set_var("SCRATCH_CONFIG_DIR", config_dir.path());

    {
        let app = build_app(mock_builder())
            .build(mock_context(noop_assets()))
            .unwrap();
        init_state(&app.handle());
        let cfg: models::AppConfig = get_config(app.state()).unwrap();
        let mut cfg = cfg;
        cfg.vault_path = vault.path().to_string_lossy().into_owned();
        tauri::async_runtime::block_on(save_config(app.state(), cfg)).unwrap();
        let created: models::Note = create_note(app.state()).unwrap();
        let mut note = created;
        note.title = "Persisted".into();
        note.content = "hello world".into();
        save_note(app.state(), note).unwrap();
    }

    {
        let app = build_app(mock_builder())
            .build(mock_context(noop_assets()))
            .unwrap();
        init_state(&app.handle());
        let notes: Vec<models::NoteMeta> = list_notes(app.state()).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "Persisted");
    }
}

#[test]
fn github_token_missing_returns_empty_prs() {
    let t = setup_app();
    let prs: Vec<models::PrGroup> =
        tauri::async_runtime::block_on(search_prs(t.app.state(), None)).unwrap();
    assert!(prs.is_empty());
}

#[test]
fn sync_status_idle_without_remote() {
    let t = setup_app();
    let status: models::SyncStatus = sync_status(t.app.state()).unwrap();
    assert_eq!(status.remote_configured, false);
    assert_eq!(status.syncing, false);
}

#[test]
fn board_default_columns_and_roundtrip() {
    let t = setup_app();

    let board: models::BoardState = get_board(t.app.state()).unwrap();
    assert_eq!(board.columns.len(), 5);
    assert_eq!(board.columns[0].name, "New");
    assert!(board.cards.is_empty());

    let mut updated = board.clone();
    updated.columns.push(models::BoardColumn {
        id: "custom".into(),
        name: "My Column".into(),
        color: "#ff0000".into(),
    });
    updated.cards.insert("theexperiencecompany/gaia#897".into(), "custom".into());
    save_board(t.app.state(), updated.clone()).unwrap();

    let reloaded: models::BoardState = get_board(t.app.state()).unwrap();
    assert_eq!(reloaded.columns.len(), 6);
    assert_eq!(reloaded.columns[5].name, "My Column");
    assert_eq!(
        reloaded.cards.get("theexperiencecompany/gaia#897").map(|s| s.as_str()),
        Some("custom")
    );
}

#[test]
fn config_defaults_include_new_fields() {
    let t = setup_app();
    let cfg: models::AppConfig = get_config(t.app.state()).unwrap();
    assert!(cfg.hidden_orgs.is_empty());
    assert!(cfg.favorite_orgs.is_empty());
    assert_eq!(cfg.view_mode, "notes");
    assert!(!cfg.toolbar_collapsed);

    let mut updated = cfg.clone();
    updated.hidden_orgs = vec!["SomeOrg".into()];
    updated.favorite_orgs = vec!["theexperiencecompany".into()];
    updated.view_mode = "board".into();
    updated.toolbar_collapsed = true;
    tauri::async_runtime::block_on(save_config(t.app.state(), updated.clone())).unwrap();

    let reloaded: models::AppConfig = get_config(t.app.state()).unwrap();
    assert_eq!(reloaded.hidden_orgs, vec!["SomeOrg"]);
    assert_eq!(reloaded.favorite_orgs, vec!["theexperiencecompany"]);
    assert_eq!(reloaded.view_mode, "board");
    assert!(reloaded.toolbar_collapsed);
}

#[test]
fn config_migrates_missing_fields_from_old_file() {
    let _guard = env_lock().lock().unwrap();
    let config_dir = TempDir::new().unwrap();
    let vault = TempDir::new().unwrap();
    std::env::set_var("SCRATCH_CONFIG_DIR", config_dir.path());

    // Write an OLD-format config (missing new fields) to disk.
    let old = format!(
        r#"{{
  "githubToken": "old-token",
  "githubLogin": "olduser",
  "vaultPath": "{}",
  "notesRepo": null,
  "syncIntervalSeconds": 300,
  "theme": "dark"
}}"#,
        vault.path().to_string_lossy()
    );
    std::fs::create_dir_all(config_dir.path()).unwrap();
    std::fs::write(config_dir.path().join("config.json"), old).unwrap();

    let app = build_app(mock_builder())
        .build(mock_context(noop_assets()))
        .unwrap();
    init_state(&app.handle());

    let cfg: models::AppConfig = get_config(app.state()).unwrap();
    // Old values preserved
    assert_eq!(cfg.github_login.as_deref(), Some("olduser"));
    assert_eq!(cfg.sync_interval_seconds, 300);
    assert_eq!(cfg.theme, "dark");
    // New fields defaulted
    assert!(cfg.hidden_orgs.is_empty());
    assert!(cfg.favorite_orgs.is_empty());
    assert_eq!(cfg.view_mode, "notes");
    assert!(!cfg.toolbar_collapsed);
}

#[test]
fn sync_wires_remote_and_renames_master_to_main() {
    let t = setup_app();

    // Force a git repo on the vault with a master branch
    let cfg: models::AppConfig = get_config(t.app.state()).unwrap();
    let vault = std::path::PathBuf::from(&cfg.vault_path);
    std::fs::create_dir_all(&vault).unwrap();
    let repo = git2::Repository::init(&vault).unwrap();
    {
        let sig = git2::Signature::now("t", "t@t").unwrap();
        let tree = repo.treebuilder(None).unwrap().write().unwrap();
        let tree = repo.find_tree(tree).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();
    }
    drop(repo);

    // Save a config with a notes repo so ensure_remote wires origin
    let mut updated = cfg.clone();
    updated.notes_repo = Some("testuser/scratch-notes".into());
    updated.github_token = Some("fake-token".into());
    updated.github_login = Some("testuser".into());
    tauri::async_runtime::block_on(save_config(t.app.state(), updated.clone())).unwrap();

    let repo = git2::Repository::open(&vault).unwrap();
    let head = repo.head().unwrap();
    let branch = head.shorthand().unwrap_or("").to_string();
    // save_config triggers sync which should have renamed master -> main
    assert_eq!(branch, "main");

    let remote = repo.find_remote("origin").unwrap();
    assert_eq!(
        remote.url().unwrap_or(""),
        "https://github.com/testuser/scratch-notes.git"
    );
}
