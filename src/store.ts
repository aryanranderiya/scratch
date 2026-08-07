import { create } from "zustand";
import { api } from "./lib/api";
import type {
	AppConfig,
	BoardState,
	Note,
	NoteMeta,
	PrGroup,
	SyncStatus,
	Theme,
} from "./lib/types";

export type View = "notes" | "board";

export function applyPlatformClass() {
	const isMac = /mac/i.test(navigator.userAgent);
	document.documentElement.classList.toggle("platform-mac", isMac);
}

const BOARD_HIDDEN_REPOS_KEY = "scratch.board.hiddenRepos";

export function loadBoardHiddenRepos(): string[] {
	try {
		const raw = localStorage.getItem(BOARD_HIDDEN_REPOS_KEY);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}

export function persistBoardHiddenRepos(repos: string[]) {
	try {
		localStorage.setItem(BOARD_HIDDEN_REPOS_KEY, JSON.stringify(repos));
	} catch {
		// localStorage unavailable — filter state simply won't persist.
	}
}

interface AppState {
	ready: boolean;
	config: AppConfig | null;
	notes: NoteMeta[];
	activeId: string | null;
	active: Note | null;
	prGroups: PrGroup[];
	prsLoading: boolean;
	sync: SyncStatus | null;
	theme: Theme;
	view: View;
	board: BoardState;
	boardHiddenRepos: string[];
	settingsOpen: boolean;
	sidebarOpen: boolean;

	bootstrap: () => Promise<void>;
	applyTheme: (t: Theme) => void;
	setView: (v: View) => void;
	setSettingsOpen: (open: boolean) => void;
	setSidebarOpen: (open: boolean) => void;
	persistView: (v: View) => Promise<void>;
	setBoardHiddenRepos: (repos: string[]) => void;
	persistToolbarCollapsed: (collapsed: boolean) => Promise<void>;

	refreshNotes: () => Promise<void>;
	selectNote: (id: string) => Promise<void>;
	createNote: () => Promise<void>;
	updateActive: (partial: Partial<Note>) => void;
	saveActive: () => Promise<void>;
	deleteNote: (id: string) => Promise<void>;
	togglePin: (id: string) => Promise<void>;

	loadPrs: () => Promise<void>;
	refreshPrs: () => Promise<void>;
	loadBoard: () => Promise<void>;
	saveBoard: (board: BoardState) => Promise<void>;
	toggleOrgHidden: (org: string) => Promise<void>;
	toggleOrgFavorite: (org: string) => Promise<void>;
	toggleRepoHidden: (repo: string) => Promise<void>;
	refreshSyncStatus: () => Promise<void>;
	syncNow: () => Promise<void>;
	saveConfig: (cfg: AppConfig) => Promise<void>;
}

function systemPrefersDark(): boolean {
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export const useAppStore = create<AppState>((set, get) => ({
	ready: false,
	config: null,
	notes: [],
	activeId: null,
	active: null,
	prGroups: [],
	prsLoading: false,
	sync: null,
	theme: "system",
	view: "notes",
	board: { columns: [], cards: {} },
	boardHiddenRepos: [],
	settingsOpen: false,
	sidebarOpen: false,

	bootstrap: async () => {
		applyPlatformClass();
		// Render the shell immediately; hydrate in the background so slow
		// loads (PR search + check-runs) never block first paint.
		const config = await api.getConfig();
		const hiddenRepos = loadBoardHiddenRepos();
		set({ config, ready: true, boardHiddenRepos: hiddenRepos });
		get().applyTheme(config.theme as Theme);
		set({ view: (config.viewMode as View) || "notes" });
		void get()
			.refreshNotes()
			.then(() => get().refreshSyncStatus());
		void get().loadPrs();
		void get().loadBoard();
	},

	applyTheme: (t) => {
		set({ theme: t });
		const dark = t === "dark" || (t === "system" && systemPrefersDark());
		document.documentElement.classList.toggle("dark", dark);
	},

	setSettingsOpen: (open) => set({ settingsOpen: open }),
	setSidebarOpen: (open) => set({ sidebarOpen: open }),
	setView: (v) => set({ view: v }),

	persistView: async (v) => {
		const cfg = get().config;
		if (!cfg) return;
		set({ view: v });
		await api.saveConfig({ ...cfg, viewMode: v });
		set({ config: { ...cfg, viewMode: v } });
	},

	persistToolbarCollapsed: async (collapsed) => {
		const cfg = get().config;
		if (!cfg) return;
		await api.saveConfig({ ...cfg, toolbarCollapsed: collapsed });
		set({ config: { ...cfg, toolbarCollapsed: collapsed } });
	},

	setBoardHiddenRepos: (repos) => {
		persistBoardHiddenRepos(repos);
		set({ boardHiddenRepos: repos });
	},

	refreshNotes: async () => {
		const notes = await api.listNotes();
		set({ notes });
		const { activeId } = get();
		if (activeId) {
			const stillThere = notes.some((n) => n.id === activeId);
			if (!stillThere) {
				set({ activeId: null, active: null });
			}
		}
	},

	selectNote: async (id) => {
		if (id === get().activeId && get().active) return;
		await get().saveActive();
		const note = await api.getNote(id);
		set({ activeId: id, active: note });
	},

	createNote: async () => {
		await get().saveActive();
		const note = await api.createNote();
		await get().refreshNotes();
		set({ activeId: note.id, active: note });
	},

	updateActive: (partial) => {
		const { active } = get();
		if (!active) return;
		set({ active: { ...active, ...partial } });
	},

	saveActive: async () => {
		const { active } = get();
		if (!active) return;
		const next = {
			...active,
			updatedAt: Math.floor(Date.now() / 1000),
		};
		await api.saveNote(next);
		set({ active: next });
		await get().refreshNotes();
	},

	deleteNote: async (id) => {
		await api.deleteNote(id);
		if (get().activeId === id) {
			set({ activeId: null, active: null });
		}
		await get().refreshNotes();
	},

	togglePin: async (id) => {
		const { notes } = get();
		const meta = notes.find((n) => n.id === id);
		if (!meta) return;
		const note = await api.getNote(id);
		await api.saveNote({
			...note,
			pinned: !note.pinned,
		});
		await get().refreshNotes();
	},

	loadPrs: async () => {
		set({ prsLoading: true });
		try {
			const prGroups = await api.searchPrs(false);
			set({ prGroups, prsLoading: false });
		} catch (e) {
			set({ prsLoading: false });
			throw e;
		}
	},

	refreshPrs: async () => {
		set({ prsLoading: true });
		try {
			const prGroups = await api.searchPrs(true);
			set({ prGroups, prsLoading: false });
		} catch (e) {
			set({ prsLoading: false });
			throw e;
		}
	},

	loadBoard: async () => {
		const board = await api.getBoard();
		set({ board });
	},

	saveBoard: async (board) => {
		await api.saveBoard(board);
		set({ board });
	},

	toggleOrgHidden: async (org) => {
		const cfg = get().config;
		if (!cfg) return;
		const hiddenOrgs = cfg.hiddenOrgs.includes(org)
			? cfg.hiddenOrgs.filter((o) => o !== org)
			: [...cfg.hiddenOrgs, org];
		const next = { ...cfg, hiddenOrgs };
		await api.saveConfig(next);
		set({ config: next });
	},

	toggleOrgFavorite: async (org) => {
		const cfg = get().config;
		if (!cfg) return;
		const favoriteOrgs = cfg.favoriteOrgs.includes(org)
			? cfg.favoriteOrgs.filter((o) => o !== org)
			: [...cfg.favoriteOrgs, org];
		const next = { ...cfg, favoriteOrgs };
		await api.saveConfig(next);
		set({ config: next });
	},

	toggleRepoHidden: async (repo) => {
		const cfg = get().config;
		if (!cfg) return;
		const hiddenRepos = cfg.hiddenRepos.includes(repo)
			? cfg.hiddenRepos.filter((r) => r !== repo)
			: [...cfg.hiddenRepos, repo];
		const next = { ...cfg, hiddenRepos };
		await api.saveConfig(next);
		set({ config: next });
	},

	refreshSyncStatus: async () => {
		const sync = await api.syncStatus();
		set({ sync });
	},

	syncNow: async () => {
		const sync = await api.syncNow();
		set({ sync });
		await get().refreshNotes();
	},

	saveConfig: async (cfg) => {
		await api.saveConfig(cfg);
		set({ config: cfg });
		get().applyTheme(cfg.theme as Theme);
		await get().refreshNotes();
	},
}));

export function bindThemeListener() {
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		const { theme } = useAppStore.getState();
		useAppStore.getState().applyTheme(theme);
	});
}
