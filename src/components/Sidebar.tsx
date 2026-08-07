import { Delete01Icon, PinIcon, PlusSignIcon, Search01Icon } from "hugeicons-react";
import { useEffect, useMemo, useState } from "react";
import type { NoteMeta } from "../lib/types";
import { cn, formatRelative } from "../lib/utils";
import { useAppStore } from "../store";
import { Input } from "./ui/Input";

export function Sidebar() {
	const open = useAppStore((s) => s.sidebarOpen);
	const setOpen = useAppStore((s) => s.setSidebarOpen);
	const notes = useAppStore((s) => s.notes);
	const activeId = useAppStore((s) => s.activeId);
	const selectNote = useAppStore((s) => s.selectNote);
	const createNote = useAppStore((s) => s.createNote);
	const deleteNote = useAppStore((s) => s.deleteNote);
	const togglePin = useAppStore((s) => s.togglePin);
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, setOpen]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const base = q
			? notes.filter(
					(n) => n.title.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q),
				)
			: notes;
		return [...base].sort(
			(a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
		);
	}, [notes, query]);

	if (!open) return null;

	const pinned = filtered.filter((n) => n.pinned);
	const rest = filtered.filter((n) => !n.pinned);

	return (
		<div
			className="fixed inset-0 z-40 bg-black/30"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) setOpen(false);
			}}
		>
			<aside
				className="absolute bottom-0 left-0 top-11 flex w-[280px] max-w-[85vw] flex-col border-r border-[var(--separator)] bg-[var(--surface)] shadow-3"
				style={{ animation: "sidebar-in 0.18s cubic-bezier(0.32, 0.72, 0, 1)" }}
			>
				<div className="flex items-center gap-2 px-3 pb-2 pt-3">
					<div className="relative flex-1">
						<Search01Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary" />
						<Input
							value={query}
							onChange={(e) => setQuery(e.currentTarget.value)}
							placeholder="Search"
							className="h-8 pl-8 text-[12px]"
							autoFocus
						/>
					</div>
					<button
						type="button"
						title="New note"
						onClick={() => void createNote()}
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
					>
						<PlusSignIcon className="h-4 w-4" />
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
					{pinned.length > 0 && (
						<div className="mb-1 mt-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
							<PinIcon className="h-3 w-3" />
							Pinned
						</div>
					)}
					{pinned.map((note) => (
						<NoteRow
							key={note.id}
							note={note}
							active={note.id === activeId}
							onSelect={() => {
								void selectNote(note.id);
								setOpen(false);
							}}
							onPin={() => void togglePin(note.id)}
							onDelete={() => void deleteNote(note.id)}
						/>
					))}
					{rest.map((note) => (
						<NoteRow
							key={note.id}
							note={note}
							active={note.id === activeId}
							onSelect={() => {
								void selectNote(note.id);
								setOpen(false);
							}}
							onPin={() => void togglePin(note.id)}
							onDelete={() => void deleteNote(note.id)}
						/>
					))}
					{filtered.length === 0 && (
						<div className="px-3 py-10 text-center text-[12px] text-tertiary">
							No notes {query ? `matching "${query}"` : "yet"}
						</div>
					)}
				</div>
			</aside>
			<style>
				{
					"@keyframes sidebar-in { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }"
				}
			</style>
		</div>
	);
}

interface NoteRowProps {
	note: NoteMeta;
	active: boolean;
	onSelect: () => void;
	onPin: () => void;
	onDelete: () => void;
}

function NoteRow({ note, active, onSelect, onPin, onDelete }: NoteRowProps) {
	const [hovering, setHovering] = useState(false);
	return (
		<button
			type="button"
			onMouseEnter={() => setHovering(true)}
			onMouseLeave={() => setHovering(false)}
			onClick={onSelect}
			className={cn(
				"group relative mb-0.5 block w-full rounded-lg px-2.5 py-2 text-left transition-colors",
				active
					? "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
					: "hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]",
			)}
		>
			<div className="min-w-0">
				<div className="truncate text-[13px] font-medium">{note.title}</div>
				{note.excerpt && (
					<div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-tertiary">
						{note.excerpt}
					</div>
				)}
				<div className="mt-0.5 text-[10px] text-tertiary">{formatRelative(note.updatedAt)}</div>
			</div>
			{hovering && (
				<div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
					<button
						type="button"
						title={note.pinned ? "Unpin" : "Pin"}
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => {
							e.stopPropagation();
							onPin();
						}}
						className="flex h-5 w-5 items-center justify-center rounded text-tertiary hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
					>
						<PinIcon className={cn("h-3.5 w-3.5", note.pinned && "text-[var(--accent)]")} />
					</button>
					<button
						type="button"
						title="Delete"
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						className="flex h-5 w-5 items-center justify-center rounded text-tertiary hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--danger)]"
					>
						<Delete01Icon className="h-3.5 w-3.5" />
					</button>
				</div>
			)}
		</button>
	);
}
