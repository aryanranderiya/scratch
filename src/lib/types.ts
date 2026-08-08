export interface AppConfig {
	githubToken: string | null;
	githubLogin: string | null;
	vaultPath: string;
	notesRepo: string | null;
	syncIntervalSeconds: number;
	theme: string;
	hiddenOrgs: string[];
	hiddenRepos: string[];
	favoriteOrgs: string[];
	viewMode: string;
	toolbarCollapsed: boolean;
}

export interface NoteMeta {
	id: string;
	title: string;
	excerpt: string;
	updatedAt: number;
	createdAt: number;
	pinned: boolean;
}

export interface Note {
	id: string;
	title: string;
	content: string;
	updatedAt: number;
	createdAt: number;
	pinned: boolean;
}

export type CheckStatus = "success" | "failure" | "pending" | null;

export type PrState = "open" | "merged" | "closed";

export interface PrItem {
	id: string;
	repo: string;
	org: string;
	number: number;
	title: string;
	url: string;
	isDraft: boolean;
	checkStatus: CheckStatus;
	state?: PrState;
}

export interface PrGroup {
	org: string;
	prs: PrItem[];
}

export interface GithubUser {
	login: string;
	name: string | null;
	avatarUrl: string | null;
}

export interface RepoChoice {
	fullName: string;
	isPrivate: boolean;
}

export interface SyncStatus {
	syncing: boolean;
	lastSyncedAt: number | null;
	lastError: string | null;
	remoteConfigured: boolean;
}

export interface BoardColumn {
	id: string;
	name: string;
	color: string;
}

export interface BoardState {
	columns: BoardColumn[];
	cards: Record<string, string>;
}

export type Theme = "system" | "light" | "dark";
