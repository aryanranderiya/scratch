use crate::error::{AppError, AppResult};
use crate::models::AppConfig;
use std::fs;
use std::path::PathBuf;

pub struct ConfigStore {
    path: PathBuf,
}

impl ConfigStore {
    pub fn new(app_config_dir: PathBuf) -> Self {
        Self {
            path: app_config_dir.join("config.json"),
        }
    }

    /// Directory containing config.json (also where crash.log is written).
    pub fn dir(&self) -> PathBuf {
        self.path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."))
    }

    pub fn load(&self) -> AppResult<AppConfig> {
        if !self.path.exists() {
            let cfg = AppConfig::default();
            self.save(&cfg)?;
            return Ok(cfg);
        }
        let content =
            fs::read_to_string(&self.path).map_err(|e| AppError::Config(format!("read: {e}")))?;
        let cfg = self.parse(&content)?;
        Ok(cfg)
    }

    /// Parse config JSON, merging defaults for fields missing from older
    /// config files so schema additions never brick an existing install.
    fn parse(&self, content: &str) -> AppResult<AppConfig> {
        let parsed: serde_json::Value = serde_json::from_str(content)
            .map_err(|e| AppError::Config(format!("parse: {e}")))?;
        let defaults = AppConfig::default();
        let default_json = serde_json::to_value(&defaults)
            .map_err(|e| AppError::Config(format!("serialize defaults: {e}")))?;

        let mut merged = default_json;
        if let (Some(target), Some(source)) = (merged.as_object_mut(), parsed.as_object()) {
            for (key, value) in source {
                target.insert(key.clone(), value.clone());
            }
        }

        serde_json::from_value(merged)
            .map_err(|e| AppError::Config(format!("parse merged: {e}")))
    }

    pub fn save(&self, cfg: &AppConfig) -> AppResult<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| AppError::Config(format!("mkdir: {e}")))?;
        }
        let content = serde_json::to_string_pretty(cfg)
            .map_err(|e| AppError::Config(format!("serialize: {e}")))?;
        fs::write(&self.path, content).map_err(|e| AppError::Config(format!("write: {e}")))?;
        Ok(())
    }
}
