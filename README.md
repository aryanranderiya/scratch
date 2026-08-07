<p align="center">
  <img src="docs/screenshots/icon.png" width="120" alt="Scratch" />
</p>

<h1 align="center">Scratch</h1>

<p align="center">
  A minimal markdown scratchpad that lives in the corner of your screen — Notion-style editing, GitHub PR linking with <code>@</code>, and automatic sync to your own GitHub repo.
</p>

<p align="center">
  <img src="docs/screenshots/notes.png" width="700" alt="Scratch notes" />
</p>

## Why

Obsidian and Notion are heavy. macOS Stickies have no markdown and no sync. Scratch sits between them: a small, flat, Apple-clean window where thoughts, todos, and PR notes live as **plain markdown files** — stored locally, readable by anything, and synced to your own private GitHub repo every few minutes. Nothing is ever lost, and nothing is locked in.

## Features

- **Notion-like editor** — block markdown editing with `/` commands, headings, callouts, task lists, and a Notion-style PR reference card
- **`@` PR linking** — type `@` to search your open pull requests (your repos + org repos), sorted by readiness: passing CI, failing, idle, drafts at the bottom. Already-linked PRs show a blue icon + `Linked` chip
- **PR status checklist** — one click inserts the QA checklist (Tested Autonomously / Files Reviewed / Manually Tested)
- **PR triage board** — a kanban board (separate view) with custom columns, drag & drop, resizable columns, repo filtering, and GitHub-style PR/CI icons
- **Automatic sync** — notes are plain `.md` files in a local git vault, committed and pushed to your private GitHub repo every few minutes; pull-to-refresh in the PR picker
- **Apple-clean design** — SF Pro throughout, light & dark mode, flat surfaces, macOS segmented tabs, compact bottom-right window
- **iCloud optional** — the vault can live in iCloud Drive alongside GitHub sync

<p align="center">
  <img src="docs/screenshots/kanban.png" width="700" alt="Scratch kanban board" />
</p>

## Downloads

Installers are built by CI and attached to each [release](https://github.com/aryanranderiya/scratch/releases).

| Platform | Artifact |
| --- | --- |
| macOS (Apple Silicon) | `Scratch_<version>_aarch64.dmg` |
| macOS (Intel) | `Scratch_<version>_x64.dmg` |
| Linux | `scratch_<version>_amd64.AppImage`, `.deb` |
| Windows | `Scratch_<version>_x64.msi`, `.exe` (NSIS) |

To build locally:

```bash
pnpm tauri build   # packages .app + .dmg on macOS
```

## Getting started

1. Install prerequisites: [Node 22](https://nodejs.org), [pnpm 10](https://pnpm.io), [Rust stable](https://rustup.rs)
2. `pnpm install`
3. `pnpm tauri dev`

On first launch, connect a GitHub Personal Access Token with `repo` scope. Scratch creates a private `scratch-notes` repository (or syncs to an existing one) and initializes your local vault (default `~/Scratch`, or iCloud Drive).

## Your notes are plain markdown

Every note is a `.md` file in your vault — syncable, grep-able, and readable by any editor:

```markdown
---
title: Untitled
created_at: 1786114051
updated_at: 1786114282
pinned: false
---

[@theexperiencecompany/gaia#901](https://github.com/theexperiencecompany/gaia/pull/901)

- [ ] hey there this is what i'm working on

[@theexperiencecompany/gaia#897](https://github.com/theexperiencecompany/gaia/pull/897)

- [ ] i gotta work on this task
```

The vault is a real git repository — even if Scratch never opened again, your notes, history, and remote are all intact.

## Development

```bash
pnpm dev                              # frontend (Vite)
pnpm tauri dev                        # desktop app
pnpm build                            # typecheck + build frontend
pnpm exec biome check src e2e         # lint
pnpm exec playwright test             # UI tests (headless)
cd src-tauri && cargo test            # backend command tests
pnpm tauri build                      # package .app + .dmg
```

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 + TipTap (editor) + Zustand (state)
- **Backend**: Tauri v2 + Rust — `git2` for sync, `reqwest` for the GitHub API, commands in `src-tauri/src/commands.rs`
- **Notes**: one markdown file per note with YAML frontmatter (`title`, `created_at`, `updated_at`, `pinned`), stored in a local git vault
- **Sync**: the vault is a git repo on branch `main`; on a timer (default every 3 min) Scratch commits, fast-forwards from the remote, and pushes using your token
- **PR search**: GitHub search API (`is:open is:pr author:<login>` per org, in parallel), cached to disk for fast starts with background refresh
- **PR mentions**: a custom TipTap block node that serializes to `[@org/repo#123](https://github.com/org/repo/pull/123)` — plain markdown, fully portable

## Testing

- `src-tauri/tests/commands.rs` — integration tests exercising the real command handlers through Tauri's mock runtime, including git sync wiring (remote creation, `master` → `main` rename) and config migration
- `e2e/` — Playwright tests driving the built UI with a mocked Tauri IPC layer: editor, @ picker, kanban drag & drop, focus behavior, and layout-overflow audits at 320–900px

## Releasing

Tag a version to build and attach installers:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

CI builds macOS (dmg), Linux (AppImage/deb), and Windows (msi/nsis) assets and drafts a GitHub release.
