import { useEffect } from "react";
import { Board } from "./components/Board";
import { Onboarding } from "./components/Onboarding";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Editor } from "./editor/Editor";
import { bindThemeListener, useAppStore } from "./store";

export default function App() {
	const ready = useAppStore((s) => s.ready);
	const config = useAppStore((s) => s.config);
	const bootstrap = useAppStore((s) => s.bootstrap);
	const view = useAppStore((s) => s.view);

	useEffect(() => {
		void bootstrap();
		bindThemeListener();
	}, [bootstrap]);

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
			<main className="min-h-0 flex-1">{view === "board" ? <Board /> : <Editor />}</main>
			<Sidebar />
			<SettingsModal />
		</div>
	);
}
