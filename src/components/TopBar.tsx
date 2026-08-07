import {
	Delete01Icon,
	KanbanIcon,
	MoreHorizontalIcon,
	PanelLeftIcon,
	PinIcon,
	PlusSignIcon,
	Settings02Icon,
} from "hugeicons-react";
import { useRef, useState } from "react";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";
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

	const [editing, setEditing] = useState(false);
	const titleRef = useRef<HTMLInputElement>(null);

	const commitTitle = () => {
		setEditing(false);
		void saveActive();
	};

	const title = active?.title ?? "Untitled";

	return (
		<header
			className="drag-header flex h-11 shrink-0 items-center gap-1 pr-2"
			data-tauri-drag-region
		>
			<div className="drag-header-pad flex min-w-0 flex-1 items-center gap-1.5">
				{view === "notes" && (
					<>
						<img
							src="/icon.png"
							alt=""
							className="hidden h-[18px] w-[18px] shrink-0 rounded-[5px] min-[380px]:block"
							draggable={false}
						/>
						{editing ? (
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
								title="Rename note"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									setEditing(true);
									requestAnimationFrame(() => titleRef.current?.select());
								}}
								onDoubleClick={(e) => e.preventDefault()}
								className="h-7 min-w-0 flex-1 truncate rounded px-1 text-left text-[13px] font-semibold tracking-tight transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
							>
								{title}
							</button>
						)}
					</>
				)}
				{view === "board" && (
					<span className="truncate text-[13px] font-semibold tracking-tight">Board</span>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-0.5">
				<SyncIndicator />
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
						<Dropdown
							trigger={
								<button
									type="button"
									title="Note options"
									className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
								>
									<MoreHorizontalIcon className="h-4 w-4" />
								</button>
							}
							items={[
								{
									key: "pin",
									label: active?.pinned ? "Unpin note" : "Pin note",
									icon: <PinIcon className="h-4 w-4" />,
									onClick: () => {
										if (active) void togglePin(active.id);
									},
								},
								{
									key: "settings",
									label: "Settings",
									icon: <Settings02Icon className="h-4 w-4" />,
									onClick: () => setSettingsOpen(true),
								},
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
							]}
						/>
					</>
				)}
				<button
					type="button"
					title={view === "board" ? "Notes" : "Board"}
					onClick={() => setView(view === "board" ? "notes" : "board")}
					className={cn(
						"flex h-7 w-7 items-center justify-center rounded-md transition-colors",
						view === "board"
							? "bg-[var(--accent-soft)] text-[var(--accent)]"
							: "text-[var(--ink-secondary)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]",
					)}
				>
					<KanbanIcon className="h-4 w-4" />
				</button>
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
