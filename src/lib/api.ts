import { invoke } from "@tauri-apps/api/core";
import type {
	AppConfig,
	BoardState,
	GithubUser,
	Note,
	NoteMeta,
	PrGroup,
	RepoChoice,
	SyncStatus,
} from "./types";

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
	return invoke<T>(cmd, args);
}

export const api = {
	getConfig: () => call<AppConfig>("get_config"),
	saveConfig: (config: AppConfig) => call<void>("save_config", { config }),

	listNotes: () => call<NoteMeta[]>("list_notes"),
	getNote: (id: string) => call<Note>("get_note", { id }),
	createNote: () => call<Note>("create_note"),
	saveNote: (note: Note) => call<void>("save_note", { note }),
	deleteNote: (id: string) => call<void>("delete_note", { id }),

	getBoard: () => call<BoardState>("get_board"),
	saveBoard: (board: BoardState) => call<void>("save_board", { board }),

	saveImage: (bytes: number[], ext: string | null) =>
		call<string>("save_image", { bytes, ext }),

	saveCrashReport: (report: string) => call<void>("save_crash_report", { report }),

	getGithubUser: (token: string) => call<GithubUser>("get_github_user", { token }),
	listOrgs: (token: string) => call<string[]>("list_orgs", { token }),
	listUserRepos: (token: string) => call<RepoChoice[]>("list_user_repos", { token }),
	createNotesRepo: (token: string) => call<string>("create_notes_repo", { token }),
	searchPrs: (force = false) => call<PrGroup[]>("search_prs", { force }),

	syncNow: () => call<SyncStatus>("sync_now"),
	syncStatus: () => call<SyncStatus>("sync_status"),
};
