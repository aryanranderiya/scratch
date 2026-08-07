// In-browser mock of the Tauri IPC layer (window.__TAURI_INTERNALS__) so the
// real frontend can be driven in a headless browser. Mirrors the backend contract.
// Tests may prime config overrides (e.g. hiddenOrgs) via primeConfig(); they are
// stored in localStorage and re-applied by this script on every navigation.
export const tauriMockInitScript = `
(function () {
  var configOverrides = {};
  try {
    var raw = window.localStorage.getItem("scratch-mock-overrides");
    configOverrides = raw ? JSON.parse(raw) : {};
  } catch (e) {
    configOverrides = {};
  }

  const store = {
    config: {
      githubToken: "mock-token",
      githubLogin: "testuser",
      vaultPath: "/tmp/vault",
      notesRepo: "testuser/scratch-notes",
      syncIntervalSeconds: 180,
      theme: "system",
      hiddenOrgs: [],
      hiddenRepos: [],
      favoriteOrgs: [],
      viewMode: "notes",
      toolbarCollapsed: false,
      ...configOverrides,
    },
    notes: [],
    prGroups: [
      {
        org: "theexperiencecompany",
        prs: [
          { id: "theexperiencecompany/gaia#897", repo: "theexperiencecompany/gaia", org: "theexperiencecompany", number: 897, title: "chore: release master", url: "https://github.com/theexperiencecompany/gaia/pull/897", isDraft: false, checkStatus: "success" },
          { id: "theexperiencecompany/gaia#894", repo: "theexperiencecompany/gaia", org: "theexperiencecompany", number: 894, title: "fix(web): recover from stale-asset ChunkLoadError", url: "https://github.com/theexperiencecompany/gaia/pull/894", isDraft: false, checkStatus: "failure" },
        ],
      },
      {
        org: "testuser",
        prs: [
          { id: "testuser/pet-project#12", repo: "testuser/pet-project", org: "testuser", number: 12, title: "Add auth flow", url: "https://github.com/testuser/pet-project/pull/12", isDraft: true, checkStatus: null },
        ],
      },
    ],
    sync: { syncing: false, lastSyncedAt: Math.floor(Date.now()/1000), lastError: null, remoteConfigured: true },
    board: {
      columns: [
        { id: "new", name: "New", color: "#8e8e93" },
        { id: "in-progress", name: "In Progress", color: "#0a84ff" },
        { id: "needs-review", name: "Needs Review", color: "#ff9f0a" },
        { id: "manually-tested", name: "Manually Tested", color: "#bf5af2" },
        { id: "done", name: "Done", color: "#30d158" },
      ],
      cards: {},
    },
    nextId: 1,
  };

  window.__store = store;
  window.__TAURI_INTERNALS__ = {
    invoke: async function (cmd, args) {
      await new Promise((r) => setTimeout(r, 10));
      switch (cmd) {
        case "get_config":
          return JSON.parse(JSON.stringify(store.config));
        case "save_config":
          store.config = { ...store.config, ...(args.config ?? {}) };
          return null;
        case "list_notes": {
          return store.notes.map((n) => ({
            id: n.id,
            title: n.title,
            excerpt: (n.content || "").replace(/[#*_>\`\\[\\]()]/g, "").replace(/\\n+/g, " ").trim().slice(0, 120),
            updatedAt: n.updatedAt,
            createdAt: n.createdAt,
            pinned: n.pinned,
          }));
        }
        case "get_note":
          return JSON.parse(JSON.stringify(store.notes.find((n) => n.id === args.id)));
        case "create_note": {
          const now = Math.floor(Date.now()/1000);
          const note = { id: "note-" + (store.nextId++), title: "Untitled", content: "", updatedAt: now, createdAt: now, pinned: false };
          store.notes.push(note);
          return JSON.parse(JSON.stringify(note));
        }
        case "save_note": {
          const idx = store.notes.findIndex((n) => n.id === args.note.id);
          const updated = { ...args.note, updatedAt: Math.floor(Date.now()/1000) };
          if (idx >= 0) store.notes[idx] = updated;
          else store.notes.push(updated);
          return null;
        }
        case "delete_note":
          store.notes = store.notes.filter((n) => n.id !== args.id);
          return null;
        case "search_prs": {
          const hidden = new Set(store.config.hiddenOrgs ?? []);
          if (args.force && store.prSearchDelayMs) {
            await new Promise((r) => setTimeout(r, store.prSearchDelayMs));
          }
          return JSON.parse(
            JSON.stringify(store.prGroups.filter((g) => !hidden.has(g.org))),
          );
        }
        case "get_board":
          return JSON.parse(JSON.stringify(store.board));
        case "save_board":
          store.board = args.board;
          return null;
        case "save_image":
          return "scratch-assets/mock-" + (store.nextId++) + "." + (args.ext || "png");
        case "list_orgs":
          return [];
        case "sync_now":
        case "sync_status":
          return JSON.parse(JSON.stringify(store.sync));
        default:
          return null;
      }
    },
    transformCallback: (cb) => cb,
    unregisterCallback: () => {},
    convertFileSrc: (p) => p,
  };

  window.__TAURI__ = {
    core: { invoke: window.__TAURI_INTERNALS__.invoke },
  };
})();
`;

export async function primeNotes(page: import("@playwright/test").Page, notes: unknown[]) {
	await page.evaluate((n) => {
		const s = (window as unknown as { __store?: { notes: unknown[] } }).__store;
		if (s) s.notes = n as never[];
	}, notes);
}

export async function primeConfig(
	page: import("@playwright/test").Page,
	overrides: Record<string, unknown>,
) {
	await page.evaluate((o) => {
		window.localStorage.setItem("scratch-mock-overrides", JSON.stringify(o));
	}, overrides);
	await page.reload();
}
