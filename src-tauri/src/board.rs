use crate::error::{AppError, AppResult};
use crate::models::BoardState;
use std::fs;
use std::path::PathBuf;

pub struct BoardStore {
    vault: PathBuf,
}

impl BoardStore {
    pub fn new(vault: PathBuf) -> Self {
        Self { vault }
    }

    fn board_path(&self) -> PathBuf {
        self.vault.join("board.json")
    }

    pub fn get(&self) -> AppResult<BoardState> {
        let path = self.board_path();
        if !path.exists() {
            return Ok(BoardState::default());
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| AppError::Io(format!("read board: {e}")))?;
        let board = serde_json::from_str(&content)
            .map_err(|e| AppError::Config(format!("parse board: {e}")))?;
        Ok(board)
    }

    pub fn save(&self, board: &BoardState) -> AppResult<()> {
        fs::create_dir_all(&self.vault)
            .map_err(|e| AppError::Io(format!("create vault dir: {e}")))?;
        let content = serde_json::to_string_pretty(board)
            .map_err(|e| AppError::Config(format!("serialize board: {e}")))?;
        fs::write(self.board_path(), content)
            .map_err(|e| AppError::Io(format!("write board: {e}")))?;
        Ok(())
    }
}
