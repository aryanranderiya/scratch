import {
	ArrowUp01Icon,
	Delete01Icon,
	MoreHorizontalIcon,
	PanelLeftIcon,
	PinIcon,
	PlusSignIcon,
	Refresh01Icon,
	Settings02Icon,
} from "hugeicons-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";
import { BoardRepoFilter } from "./BoardRepoFilter";
import { SyncIndicator } from "./SyncIndicator";
import { Dropdown } from "./ui/Dropdown";

export function TopBar() {
	const active = useAppStore((s) => s.active);
	const updateActive = useAppStore((s) => s.updateActive);
	const saveActive = useAppStore((s) => s.saveActive);
	const deleteNote = useAppStore((s) => s.deleteNote);
	const createNote = useAppStore((s) => s.createNote);
	const togglePin = useAppStore((s) => s.togglePin);
	const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
	const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const prGroups = useAppStore((s) => s.prGroups);
	const config = useAppStore((s) => s.config);
	const persistToolbarCollapsed = useAppStore((s) => s.persistToolbarCollapsed);

	const allRepos = useMemo(() => {
		const seen = new Set<string>();
		for (const g of prGroups) {
			for (const pr of g.prs) seen.add(pr.repo);
		}
		return [...seen].sort();
	}, [prGroups]);

	const [editing, setEditing] = useState(false);
	const titleRef = useRef<HTMLInputElement>(null);

	const commitTitle = () => {
		setEditing(false);
		void saveActive();
	};

	const startEditing = () => {
		if (!active) {
			void createNote().then(() => {
				setEditing(true);
			});
			return;
		}
		setEditing(true);
	};

	const title = active?.title ?? "Untitled";

	return (
		<header
			className="drag-header flex h-11 shrink-0 items-center gap-1 pr-2"
			data-tauri-drag-region
		>
			<div className="drag-header-pad flex min-w-0 flex-1 items-center gap-1.5">
				<div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--surface-muted)] p-0.5">
					<button
						type="button"
						title="Scratchpad"
						onClick={() => setView("notes")}
						className={cn(
							"flex h-6 items-center rounded-md px-2 text-[11px] font-medium transition-colors",
							view === "notes"
								? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-1"
								: "text-[var(--ink-secondary)] hover:text-[var(--ink)]",
						)}
					>
						Scratchpad
					</button>
					<button
						type="button"
						title="Kanban"
						onClick={() => setView("board")}
						className={cn(
							"flex h-6 items-center rounded-md px-2 text-[11px] font-medium transition-colors",
							view === "board"
								? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-1"
								: "text-[var(--ink-secondary)] hover:text-[var(--ink)]",
						)}
					>
						Kanban
					</button>
				</div>
				{view === "board" && <BoardRepoFilter allRepos={allRepos} />}
				{view === "notes" &&
					(editing ? (
						<input
							ref={(el) => {
								titleRef.current = el;
								if (el) el.focus();
							}}
							value={active?.title ?? ""}
							onChange={(e) => updateActive({ title: e.currentTarget.value })}
							onBlur={commitTitle}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitTitle();
								if (e.key === "Escape") {
									updateActive({ title });
									commitTitle();
								}
							}}
							className="h-7 min-w-0 flex-1 bg-transparent text-[13px] font-semibold tracking-tight outline-none"
							placeholder="Untitled"
						/>
					) : (
						<button
							type="button"
							title="Note title"
							onMouseDown={(e) => e.preventDefault()}
							onClick={startEditing}
							onDoubleClick={(e) => e.preventDefault()}
							className="h-7 min-w-0 flex-1 truncate rounded px-1 text-left text-[13px] font-semibold tracking-tight transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
						>
							{title}
						</button>
					))}
			</div>

			<div className="flex shrink-0 items-center gap-0.5">
				<SyncIndicator />
				{view === "board" && (
					<span className="mr-1 hidden items-center gap-1 text-[11px] text-tertiary min-[420px]:flex">
						<Refresh01Icon className="h-3 w-3" />
						Auto-syncs
					</span>
				)}
				{view === "notes" && (
					<>
						<button
							type="button"
							title="New note"
							onClick={() => void createNote()}
							className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
						>
							<PlusSignIcon className="h-4 w-4" />
						</button>
						<button
							type="button"
							title={
								config?.toolbarCollapsed
									? "Show formatting toolbar"
									: "Hide formatting toolbar"
							}
							onClick={() => void persistToolbarCollapsed(!config?.toolbarCollapsed)}
							className={cn(
								"flex h-7 w-7 items-center justify-center rounded-md transition-colors",
								config?.toolbarCollapsed
									? "bg-[var(--accent-soft)] text-[var(--accent)]"
									: "text-[var(--ink-secondary)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]",
							)}
						>
							<ArrowUp01Icon
								className={cn("h-4 w-4", config?.toolbarCollapsed && "rotate-180")}
							/>
						</button>
					</>
				)}
				<Dropdown
					trigger={
						<button
							type="button"
							title={view === "notes" ? "Note options" : "Board options"}
							className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
						>
							<MoreHorizontalIcon className="h-4 w-4" />
						</button>
					}
					items={[
						...(view === "notes"
							? [
									{
										key: "pin",
										label: active?.pinned ? "Unpin note" : "Pin note",
										icon: <PinIcon className="h-4 w-4" />,
										onClick: () => {
											if (active) void togglePin(active.id);
										},
									},
								]
							: []),
						{
							key: "settings",
							label: "Settings",
							icon: <Settings02Icon className="h-4 w-4" />,
							onClick: () => setSettingsOpen(true),
						},
						...(view === "notes"
							? [
									{
										key: "delete",
										label: "Delete note",
										icon: <Delete01Icon className="h-4 w-4" />,
										onClick: () => {
											if (active) void deleteNote(active.id);
										},
										danger: true,
										separator: true,
									},
								]
							: []),
					]}
				/>
				<button
					type="button"
					title="All notes"
					onClick={() => setSidebarOpen(true)}
					className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
				>
					<PanelLeftIcon className="h-4 w-4" />
				</button>
			</div>
		</header>
	);
}
