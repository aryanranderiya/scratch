import { lazy, Suspense, useEffect } from "react";
import { CrashLogModal } from "./components/CrashLogModal";
import { Onboarding } from "./components/Onboarding";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Spinner } from "./components/ui/Spinner";
import { bindThemeListener, useAppStore } from "./store";

// Editor (TipTap + prosemirror) and Board (dnd-kit) are the heavy parts of the
// app. Lazy-load them so the shell paints before they parse and initialize.
const Editor = lazy(() => import("./editor/Editor").then((m) => ({ default: m.Editor })));
const Board = lazy(() => import("./components/Board").then((m) => ({ default: m.Board })));

function LazyFallback() {
	return (
		<div className="flex h-full items-center justify-center">
			<Spinner className="h-5 w-5 text-tertiary" />
		</div>
	);
}

export default function App() {
	const ready = useAppStore((s) => s.ready);
	const config = useAppStore((s) => s.config);
	const bootstrap = useAppStore((s) => s.bootstrap);
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);

	useEffect(() => {
		void bootstrap();
		bindThemeListener();
	}, [bootstrap]);

	// Cmd+1 / Cmd+2 switch between scratchpad and kanban.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!e.metaKey && !e.ctrlKey) return;
			if (e.key === "1") {
				e.preventDefault();
				setView("notes");
			} else if (e.key === "2") {
				e.preventDefault();
				setView("board");
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [setView]);

	if (!ready || !config) {
		return (
			<div className="flex h-full items-center justify-center">
				<span className="text-[13px] text-tertiary">Loading…</span>
			</div>
		);
	}

	if (!config.githubToken) {
		return (
			<>
				<Onboarding />
				<SettingsModal />
			</>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden bg-[var(--surface)]">
			<TopBar />
			<main className="min-h-0 flex-1">
				<Suspense fallback={<LazyFallback />}>
					{view === "board" ? <Board /> : <Editor />}
				</Suspense>
			</main>
			<Sidebar />
			<SettingsModal />
			<CrashLogModal />
		</div>
	);
}
