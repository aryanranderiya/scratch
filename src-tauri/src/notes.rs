use crate::error::{AppError, AppResult};
use crate::models::{Note, NoteMeta};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};

pub struct NotesStore {
    vault: PathBuf,
}

impl NotesStore {
    pub fn new(vault: PathBuf) -> Self {
        Self { vault }
    }

    fn notes_dir(&self) -> &Path {
        &self.vault
    }

    pub fn ensure(&self) -> AppResult<()> {
        fs::create_dir_all(self.notes_dir())
            .map_err(|e| AppError::Io(format!("create vault: {e}")))?;
        Ok(())
    }

    fn note_path(&self, id: &str) -> PathBuf {
        self.notes_dir().join(format!("{id}.md"))
    }

    fn slug_to_path(&self, slug: &str) -> PathBuf {
        self.notes_dir().join(format!("{slug}.md"))
    }

    pub fn list(&self) -> AppResult<Vec<NoteMeta>> {
        self.ensure()?;
        let mut notes: Vec<NoteMeta> = Vec::new();
        for entry in fs::read_dir(self.notes_dir())
            .map_err(|e| AppError::Io(format!("read vault: {e}")))?
        {
            let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
            let path = entry.path();
            if path.extension().map(|e| e == "md").unwrap_or(false) {
                if let Some(meta) = self.read_meta(&path)? {
                    notes.push(meta);
                }
            }
        }
        notes.sort_by(|a, b| {
            b.pinned
                .cmp(&a.pinned)
                .then_with(|| b.updated_at.cmp(&a.updated_at))
        });
        Ok(notes)
    }

    fn read_meta(&self, path: &Path) -> AppResult<Option<NoteMeta>> {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return Ok(None),
        };
        let (meta, body) = parse_note_file(&content);
        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();
        Ok(Some(NoteMeta {
            id,
            title: meta.title,
            excerpt: excerpt_from_body(&body),
            updated_at: meta.updated_at,
            created_at: meta.created_at,
            pinned: meta.pinned,
        }))
    }

    pub fn get(&self, id: &str) -> AppResult<Note> {
        let path = self.note_path(id);
        let content =
            fs::read_to_string(&path).map_err(|e| AppError::Io(format!("read note {id}: {e}")))?;
        let (meta, body) = parse_note_file(&content);
        Ok(Note {
            id: id.to_string(),
            title: meta.title,
            content: body,
            updated_at: meta.updated_at,
            created_at: meta.created_at,
            pinned: meta.pinned,
        })
    }

    pub fn create(&self) -> AppResult<Note> {
        let now = Utc::now().timestamp();
        let slug = format!("untitled-{}", now);
        let mut path = self.slug_to_path(&slug);
        let mut counter = 1;
        while path.exists() {
            path = self.slug_to_path(&format!("{slug}-{counter}"));
            counter += 1;
        }
        let id = path.file_stem().unwrap().to_string_lossy().into_owned();
        let note = Note {
            id,
            title: "Untitled".into(),
            content: String::new(),
            updated_at: now,
            created_at: now,
            pinned: false,
        };
        self.write(&note)?;
        Ok(note)
    }

    pub fn write(&self, note: &Note) -> AppResult<()> {
        self.ensure()?;
        let path = self.note_path(&note.id);
        let content = serialize_note_file(note);
        fs::write(&path, content)
            .map_err(|e| AppError::Io(format!("write note {}: {e}", note.id)))?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        let path = self.note_path(id);
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| AppError::Io(format!("delete note {id}: {e}")))?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct NoteFileMeta {
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub pinned: bool,
}

impl Default for NoteFileMeta {
    fn default() -> Self {
        let now = Utc::now().timestamp();
        Self {
            title: "Untitled".into(),
            created_at: now,
            updated_at: now,
            pinned: false,
        }
    }
}

pub fn parse_note_file(content: &str) -> (NoteFileMeta, String) {
    let mut meta = NoteFileMeta::default();
    let mut body_start = 0usize;

    let trimmed = content.trim_start();
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some(end) = rest.find("\n---") {
            let front = &rest[..end];
            // body begins after the closing delimiter; offset maps `rest` back to `content`
            body_start = (content.len() - trimmed.len()) + 3 + end + 4;
            let mut found_title = false;
            for line in front.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    let v = v.trim().trim_matches('"').to_string();
                    match k.trim() {
                        "title" => {
                            meta.title = v;
                            found_title = true;
                        }
                        "created_at" => {
                            meta.created_at = v.parse().unwrap_or(meta.created_at);
                        }
                        "updated_at" => {
                            meta.updated_at = v.parse().unwrap_or(meta.updated_at);
                        }
                        "pinned" => {
                            meta.pinned = v.parse().unwrap_or(false);
                        }
                        _ => {}
                    }
                }
            }
            if !found_title {
                // derive from body first heading or 'Untitled'
            }
        }
    }

    let body = content[body_start..].trim_start().to_string();
    if meta.title == "Untitled" {
        if let Some(heading) = body
            .lines()
            .find(|l| l.trim_start().starts_with("# "))
        {
            meta.title = heading
                .trim_start()
                .trim_start_matches("# ")
                .trim()
                .to_string();
        }
    }
    (meta, body)
}

pub fn serialize_note_file(note: &Note) -> String {
    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(&format!("title: {}\n", escape_frontmatter(&note.title)));
    out.push_str(&format!("created_at: {}\n", note.created_at));
    out.push_str(&format!("updated_at: {}\n", note.updated_at));
    out.push_str(&format!("pinned: {}\n", note.pinned));
    out.push_str("---\n\n");
    out.push_str(&note.content);
    out
}

fn escape_frontmatter(s: &str) -> String {
    s.replace('\n', " ").replace(": ", " - ")
}

fn excerpt_from_body(body: &str) -> String {
    let cleaned: String = body
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with("# ") && !l.starts_with("```"))
        .collect::<Vec<_>>()
        .join(" ");
    let mut out = cleaned
        .replace(['#', '*', '_', '`', '>', '[', ']', '(', ')'], "")
        .trim()
        .to_string();
    if out.len() > 120 {
        out.truncate(120);
        out.push('…');
    }
    out
}
