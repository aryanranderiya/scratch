# Scratch

A minimal markdown scratchpad that lives in the corner of your screen — Notion-style editing, GitHub PR linking with `@`, and automatic sync to a private GitHub repo every few minutes.

## Why

Obsidian and Notion are heavy. macOS Stickies have no markdown and no sync. Scratch sits between them: a small, glass, Apple-clean window where thoughts, todos, and PR notes live as plain markdown files that are synced to your own GitHub repo automatically.

## Features

- **Notion-like editor** — TipTap-based block markdown editing with `/` commands
- **`@` PR linking** — type `@` to search open pull requests from your repos and org repos, grouped by org, and insert a link chip
- **PR status checklist** — one click inserts the QA checklist (Tested Autonomously / Files Reviewed / Manually Tested)
- **Automatic sync** — notes are plain `.md` files in a local git vault, committed and pushed to a private GitHub repo every few minutes
- **Apple-clean design** — SF font stack, glassmorphism with macOS vibrancy, light & dark mode, flat surfaces
- **Compact scratchpad window** — small 420×520 window, positioned bottom-right, resizable
- **Minimal navigation** — unified title bar with inline note-title editing, ellipsis menu, and a slide-in notes sidebar

## Getting started

1. `mise install` (or install Node 22, pnpm 10, Rust stable manually)
2. `pnpm install`
3. `cd src-tauri && cargo build` (first build compiles vendored libgit2)
4. `pnpm tauri dev`

On first launch, connect a GitHub Personal Access Token with `repo` scope. Scratch creates a private `scratch-notes` repository (or syncs to an existing one) and initializes your local vault (default `~/Scratch`).

## Development

```bash
pnpm dev          # frontend (Vite)
pnpm tauri dev    # desktop app
pnpm build        # typecheck + build frontend
pnpm exec biome check src e2e   # lint
pnpm exec playwright test       # UI tests (headless)
cd src-tauri && cargo test      # backend command tests
pnpm tauri build  # package .app + .dmg
```

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 + TipTap (editor) + Zustand (state)
- **Backend**: Tauri v2 + Rust — `git2` for sync, `reqwest` for the GitHub API, commands in `src-tauri/src/commands.rs`
- **Notes**: one markdown file per note, with YAML frontmatter (`title`, `created_at`, `updated_at`, `pinned`), stored in a local git vault
- **Sync**: the vault is a git repo; on a timer (default every 3 min) Scratch commits, fast-forwards from the remote, and pushes using your token
- **PR search**: GitHub search API (`is:open is:pr user:<login>` + per-org queries), cached for 2 minutes, grouped by org
- **PR mentions**: a custom TipTap node serialized to `[@org/repo#123](https://github.com/org/repo/pull/123)` — plain markdown, fully portable

## Testing

- `src-tauri/tests/commands.rs` — integration tests that exercise the real command handlers through Tauri's mock runtime
- `e2e/` — Playwright tests driving the built UI with a mocked Tauri IPC layer, including layout-overflow audits at 320–900px window sizes

## Releasing

Tag a version to build and attach installers:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

CI builds macOS (dmg), Linux (AppImage/deb), and Windows (msi) assets and drafts a GitHub release.
