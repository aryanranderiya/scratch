import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	closestCorners,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Cancel01Icon,
	CancelCircleIcon,
	CheckmarkCircle02Icon,
	Clock01Icon,
	GitPullRequestIcon,
	InboxIcon,
	MoreHorizontalIcon,
	PencilEdit01Icon,
	PlusSignIcon,
} from "hugeicons-react";
import {
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { PrRepoRef } from "../editor/PrRichCard";
import { openUrl } from "../lib/open";
import type { BoardColumn, BoardState, PrItem } from "../lib/types";
import { cn, uid } from "../lib/utils";
import { useAppStore } from "../store";
import { Spinner } from "./ui/Spinner";

const PALETTE = [
	"#8e8e93",
	"#0a84ff",
	"#ff9f0a",
	"#bf5af2",
	"#30d158",
	"#ff453a",
	"#ffd60a",
	"#64d2ff",
];

const MENU_WIDTH = 176;

function cardsFromOrdered(ordered: Record<string, string[]>): Record<string, string> {
	const cards: Record<string, string> = {};
	for (const [colId, ids] of Object.entries(ordered)) {
		for (const id of ids) {
			cards[id] = colId;
		}
	}
	return cards;
}

function ordersEqual(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	for (const key of aKeys) {
		const x = a[key];
		const y = b[key];
		if (!y || x.length !== y.length) return false;
		for (let i = 0; i < x.length; i++) {
			if (x[i] !== y[i]) return false;
		}
	}
	return true;
}

function reconcileOrdered(
	prev: Record<string, string[]>,
	board: BoardState,
	prs: PrItem[],
): Record<string, string[]> {
	const columnIds = new Set(board.columns.map((c) => c.id));
	const prIds = new Set(prs.map((p) => p.id));
	const firstId = board.columns[0]?.id ?? null;
	const targetOf = (prId: string): string | null => {
		const colId = board.cards[prId];
		if (colId && columnIds.has(colId)) return colId;
		return firstId;
	};

	const ordered: Record<string, string[]> = {};
	const placed = new Set<string>();
	for (const col of board.columns) {
		const keep = (prev[col.id] ?? []).filter((id) => prIds.has(id));
		for (const id of keep) {
			placed.add(id);
		}
		ordered[col.id] = [...keep];
	}

	const missing = [...prs]
		.filter((pr) => !placed.has(pr.id))
		.sort((a, b) => a.id.localeCompare(b.id));
	for (const pr of missing) {
		const target = targetOf(pr.id);
		if (!target) continue;
		ordered[target].push(pr.id);
		placed.add(pr.id);
	}
	return ordered;
}

function CiStatusIcon({ status }: { status: PrItem["checkStatus"] }) {
	switch (status) {
		case "success":
			return <CheckmarkCircle02Icon className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />;
		case "failure":
			return <CancelCircleIcon className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />;
		case "pending":
			return <Clock01Icon className="h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />;
		default:
			return <GitPullRequestIcon className="h-3.5 w-3.5 shrink-0 text-[var(--ink-tertiary)]" />;
	}
}

function CardBody({ pr }: { pr: PrItem }) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center gap-1.5">
				<span
					className={cn(
						"flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
						pr.isDraft
							? "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
							: "bg-[color-mix(in_oklab,var(--success)_14%,transparent)]",
					)}
				>
					<GitPullRequestIcon
						className={cn(
							"h-3 w-3",
							pr.isDraft ? "text-[var(--ink-secondary)]" : "text-[var(--success)]",
						)}
					/>
				</span>
				<span className="min-w-0 flex-1 truncate text-[11px] text-tertiary">
					<PrRepoRef pr={pr} />
				</span>
				{pr.isDraft && (
					<span className="shrink-0 rounded bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] px-1.5 py-px text-[10px] font-medium text-[var(--ink-secondary)]">
						Draft
					</span>
				)}
				<CiStatusIcon status={pr.checkStatus} />
			</div>
			<p className="line-clamp-2 text-[13px] font-medium leading-snug">{pr.title}</p>
		</div>
	);
}

function SortableCard({ pr }: { pr: PrItem }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: pr.id,
	});
	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			onClick={() => void openUrl(pr.url)}
			style={{
				transform: CSS.Transform.toString(transform),
				transition: isDragging ? undefined : transition,
			}}
			className={cn(
				"surface-raised cursor-grab rounded-xl p-2.5 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]",
				isDragging && "opacity-0",
			)}
		>
			<CardBody pr={pr} />
		</div>
	);
}

interface ColumnProps {
	column: BoardColumn;
	cardIds: string[];
	prMap: Map<string, PrItem>;
	renaming: boolean;
	renameDraft: string;
	onDraftChange: (value: string) => void;
	onRenameCommit: () => void;
	onRenameCancel: () => void;
	onStartRename: () => void;
	onOpenMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}

function Column({
	column,
	cardIds,
	prMap,
	renaming,
	renameDraft,
	onDraftChange,
	onRenameCommit,
	onRenameCancel,
	onStartRename,
	onOpenMenu,
}: ColumnProps) {
	const { setNodeRef, isOver } = useDroppable({ id: column.id });
	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex w-[240px] shrink-0 flex-col rounded-xl transition-colors",
				isOver && "bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]",
			)}
		>
			<header className="flex h-8 shrink-0 items-center gap-1.5 px-1">
				<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: column.color }} />
				{renaming ? (
					<input
						ref={(el) => {
							if (el) {
								el.focus();
								el.select();
							}
						}}
						value={renameDraft}
						onChange={(e) => onDraftChange(e.currentTarget.value)}
						onBlur={onRenameCommit}
						onKeyDown={(e) => {
							if (e.key === "Enter") onRenameCommit();
							if (e.key === "Escape") onRenameCancel();
						}}
						className="h-6 min-w-0 flex-1 rounded-md bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-1.5 text-[13px] font-semibold tracking-tight outline-none"
					/>
				) : (
					<button
						type="button"
						title="Rename column"
						onClick={onStartRename}
						className="min-w-0 flex-1 truncate rounded px-1 text-left text-[13px] font-semibold tracking-tight transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
					>
						{column.name}
					</button>
				)}
				<span className="shrink-0 text-[11px] text-tertiary">{cardIds.length}</span>
				<button
					type="button"
					title="Column options"
					onMouseDown={(e) => e.stopPropagation()}
					onClick={onOpenMenu}
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
				>
					<MoreHorizontalIcon className="h-3.5 w-3.5" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<SortableContext id={column.id} items={cardIds} strategy={verticalListSortingStrategy}>
					<div className="space-y-2 p-1">
						{cardIds.map((prId) => {
							const pr = prMap.get(prId);
							return pr ? <SortableCard key={prId} pr={pr} /> : null;
						})}
						{cardIds.length === 0 && !isOver && (
							<div className="rounded-xl border border-dashed border-[color-mix(in_oklab,var(--ink)_18%,transparent)] py-4 text-center text-[11px] text-tertiary">
								Drop PRs here
							</div>
						)}
					</div>
				</SortableContext>
			</div>
		</div>
	);
}

interface AddColumnProps {
	draft: string;
	onChange: (value: string) => void;
	onCommit: () => void;
	onCancel: () => void;
}

function AddColumnColumn({ draft, onChange, onCommit, onCancel }: AddColumnProps) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		ref.current?.scrollIntoView({ behavior: "smooth", inline: "end" });
	}, []);
	return (
		<div ref={ref} className="flex w-[240px] shrink-0 flex-col">
			<header className="flex h-8 shrink-0 items-center gap-1.5 px-1">
				<span
					className="h-2 w-2 shrink-0 rounded-full"
					style={{ background: "var(--ink-tertiary)" }}
				/>
				<input
					ref={(el) => {
						if (el) {
							el.focus();
							el.select();
						}
					}}
					value={draft}
					onChange={(e) => onChange(e.currentTarget.value)}
					onBlur={onCancel}
					onKeyDown={(e) => {
						if (e.key === "Enter") onCommit();
						if (e.key === "Escape") onCancel();
					}}
					placeholder="New Column"
					className="h-6 min-w-0 flex-1 rounded-md bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] px-1.5 text-[13px] font-semibold tracking-tight outline-none placeholder:text-tertiary"
				/>
				<button
					type="button"
					title="Cancel"
					onClick={onCancel}
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]"
				>
					<Cancel01Icon className="h-3.5 w-3.5" />
				</button>
			</header>
			<div className="flex-1 p-1">
				<div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[color-mix(in_oklab,var(--ink)_18%,transparent)] text-[11px] text-tertiary">
					Enter to add
				</div>
			</div>
		</div>
	);
}

interface MenuState {
	colId: string;
	x: number;
	y: number;
}

interface ColumnMenuProps {
	menu: MenuState;
	columns: BoardColumn[];
	onRename: (colId: string) => void;
	onRecolor: (colId: string, color: string) => void;
	onDelete: (colId: string) => void;
	onClose: () => void;
}

function ColumnMenu({ menu, columns, onRename, onRecolor, onDelete, onClose }: ColumnMenuProps) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const onMouseDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("mousedown", onMouseDown);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("mousedown", onMouseDown);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	const column = columns.find((c) => c.id === menu.colId);
	if (!column) return null;

	const openRight = menu.x + MENU_WIDTH <= window.innerWidth - 8;
	const canDelete = columns.length > 1;

	return (
		<div
			className="fixed z-50"
			style={{ left: openRight ? menu.x : menu.x - MENU_WIDTH, top: menu.y }}
		>
			<div
				ref={ref}
				className="surface-raised w-44 rounded-xl p-1"
				style={{ animation: "menu-in 0.12s ease-out" }}
			>
				<button
					type="button"
					onClick={() => {
						onRename(column.id);
						onClose();
					}}
					className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
				>
					<PencilEdit01Icon className="h-4 w-4 text-[var(--ink-secondary)]" />
					Rename
				</button>
				<div className="px-2.5 pb-1 pt-2 text-[11px] text-tertiary">Color</div>
				<div className="grid grid-cols-4 gap-1.5 px-2 pb-2 pt-1">
					{PALETTE.map((color) => (
						<button
							key={color}
							type="button"
							title={color}
							onClick={() => {
								onRecolor(column.id, color);
								onClose();
							}}
							className={cn(
								"h-5 w-5 rounded-full transition-transform hover:scale-110",
								column.color === color && "ring-2 ring-[var(--ink)]",
							)}
							style={{ background: color }}
						/>
					))}
				</div>
				<div className="mx-2 my-1 h-px bg-[var(--separator)]" />
				<button
					type="button"
					disabled={!canDelete}
					onClick={() => onDelete(column.id)}
					className={cn(
						"flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
						canDelete
							? "text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]"
							: "cursor-not-allowed text-tertiary opacity-60",
					)}
				>
					<Cancel01Icon className="h-4 w-4" />
					Delete column
				</button>
			</div>
			<style>
				{
					"@keyframes menu-in { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }"
				}
			</style>
		</div>
	);
}

export function Board() {
	const board = useAppStore((s) => s.board);
	const prGroups = useAppStore((s) => s.prGroups);
	const saveBoard = useAppStore((s) => s.saveBoard);
	const hiddenRepos = useAppStore((s) => s.boardHiddenRepos);

	const prs = useMemo(() => prGroups.flatMap((g) => g.prs), [prGroups]);
	const hiddenReposSet = useMemo(() => new Set(hiddenRepos), [hiddenRepos]);

	const allRepos = useMemo(() => {
		const seen = new Set<string>();
		for (const pr of prs) seen.add(pr.repo);
		return [...seen].sort();
	}, [prs]);

	const visiblePrs = useMemo(
		() => prs.filter((p) => !hiddenReposSet.has(p.repo)),
		[prs, hiddenReposSet],
	);
	const prMap = useMemo(() => new Map(visiblePrs.map((p) => [p.id, p])), [visiblePrs]);

	const columnsRef = useRef(board.columns);
	columnsRef.current = board.columns;

	const [ordered, setOrdered] = useState<Record<string, string[]>>({});
	const orderedRef = useRef(ordered);
	orderedRef.current = ordered;

	useLayoutEffect(() => {
		const next = reconcileOrdered(orderedRef.current, board, visiblePrs);
		if (!ordersEqual(orderedRef.current, next)) {
			setOrdered(next);
		}
	}, [board, visiblePrs]);

	const [renaming, setRenaming] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const [menu, setMenu] = useState<MenuState | null>(null);
	const [adding, setAdding] = useState(false);
	const [addDraft, setAddDraft] = useState("");
	const [colorTick, setColorTick] = useState(0);
	const [dragging, setDragging] = useState<string | null>(null);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

	const persist = (columns: BoardColumn[], next: Record<string, string[]>) => {
		void saveBoard({ columns, cards: cardsFromOrdered(next) });
	};

	const columnOfCard = (prId: string): string | null => {
		for (const [colId, ids] of Object.entries(orderedRef.current)) {
			if (ids.includes(prId)) return colId;
		}
		return null;
	};

	const isColumnId = (id: string) => columnsRef.current.some((c) => c.id === id);

	const handleDragStart = (e: DragStartEvent) => {
		setDragging(String(e.active.id));
	};

	const handleDragOver = (e: DragOverEvent) => {
		const { active, over } = e;
		if (!over || active.id === over.id) return;
		const activeId = String(active.id);
		const overId = String(over.id);
		const source = columnOfCard(activeId);
		if (!source) return;
		const target = isColumnId(overId) ? overId : columnOfCard(overId);
		if (!target || target === source) return;

		const sourceIds = (orderedRef.current[source] ?? []).filter((id) => id !== activeId);
		const targetIds = [...(orderedRef.current[target] ?? [])];
		const overIndex = isColumnId(overId) ? -1 : targetIds.indexOf(overId);
		targetIds.splice(overIndex === -1 ? targetIds.length : overIndex, 0, activeId);
		setOrdered({ ...orderedRef.current, [source]: sourceIds, [target]: targetIds });
	};

	const handleDragEnd = (e: DragEndEvent) => {
		setDragging(null);
		const { active, over } = e;
		if (!over || active.id === over.id) return;
		const activeId = String(active.id);
		const overId = String(over.id);
		const source = columnOfCard(activeId);
		if (!source) return;
		const target = isColumnId(overId) ? overId : columnOfCard(overId);
		if (!target) return;

		let next = orderedRef.current;
		if (source === target) {
			const ids = [...(orderedRef.current[source] ?? [])];
			const from = ids.indexOf(activeId);
			const to = isColumnId(overId) ? ids.length - 1 : ids.indexOf(overId);
			if (from !== to && from >= 0 && to >= 0) {
				next = { ...orderedRef.current, [source]: arrayMove(ids, from, to) };
			}
		} else {
			const sourceIds = (orderedRef.current[source] ?? []).filter((id) => id !== activeId);
			const targetIds = [...(orderedRef.current[target] ?? [])];
			if (!targetIds.includes(activeId)) {
				const overIndex = isColumnId(overId) ? -1 : targetIds.indexOf(overId);
				targetIds.splice(overIndex === -1 ? targetIds.length : overIndex, 0, activeId);
			}
			next = { ...orderedRef.current, [source]: sourceIds, [target]: targetIds };
		}
		setOrdered(next);
		persist(columnsRef.current, next);
	};

	const startAdd = () => {
		setAddDraft("");
		setAdding(true);
	};

	const commitAdd = () => {
		setAdding(false);
		const column: BoardColumn = {
			id: uid(),
			name: addDraft.trim() || "New Column",
			color: PALETTE[colorTick % PALETTE.length],
		};
		const nextColumns = [...columnsRef.current, column];
		const next = { ...orderedRef.current, [column.id]: [] };
		setOrdered(next);
		persist(nextColumns, next);
		setColorTick((t) => t + 1);
	};

	const cancelAdd = () => setAdding(false);

	const commitRename = () => {
		if (renaming === null) return;
		const name = renameDraft.trim();
		const colId = renaming;
		setRenaming(null);
		if (!name) return;
		const nextColumns = columnsRef.current.map((c) => (c.id === colId ? { ...c, name } : c));
		persist(nextColumns, orderedRef.current);
	};

	const cancelRename = () => setRenaming(null);

	const recolorColumn = (colId: string, color: string) => {
		const nextColumns = columnsRef.current.map((c) => (c.id === colId ? { ...c, color } : c));
		persist(nextColumns, orderedRef.current);
	};

	const deleteColumn = (colId: string) => {
		if (columnsRef.current.length <= 1) return;
		const nextColumns = columnsRef.current.filter((c) => c.id !== colId);
		const first = nextColumns[0];
		const moved = orderedRef.current[colId] ?? [];
		const next = { ...orderedRef.current };
		delete next[colId];
		next[first.id] = [...(next[first.id] ?? []), ...moved];
		setOrdered(next);
		persist(nextColumns, next);
	};

	const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, colId: string) => {
		e.stopPropagation();
		const rect = e.currentTarget.getBoundingClientRect();
		setMenu((m) => (m?.colId === colId ? null : { colId, x: rect.right, y: rect.bottom + 4 }));
	};

	const overlayPr = dragging ? prMap.get(dragging) : undefined;

	if (board.columns.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner className="h-5 w-5 text-tertiary" />
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{visiblePrs.length === 0 && allRepos.length > 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-tertiary">
					<InboxIcon className="h-6 w-6" />
					<span className="text-[13px]">No pull requests match the current filter</span>
				</div>
			) : visiblePrs.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-tertiary">
					<InboxIcon className="h-6 w-6" />
					<span className="text-[13px]">No open pull requests</span>
				</div>
			) : (
				<DndContext
					collisionDetection={closestCorners}
					sensors={sensors}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
					onDragCancel={() => setDragging(null)}
				>
					<div className="flex flex-1 gap-3 overflow-x-auto px-4 py-3">
						{board.columns.map((col) => (
							<Column
								key={col.id}
								column={col}
								cardIds={ordered[col.id] ?? []}
								prMap={prMap}
								renaming={renaming === col.id}
								renameDraft={renameDraft}
								onDraftChange={setRenameDraft}
								onRenameCommit={commitRename}
								onRenameCancel={cancelRename}
								onStartRename={() => {
									setRenaming(col.id);
									setRenameDraft(col.name);
								}}
								onOpenMenu={(e) => openMenu(e, col.id)}
							/>
						))}
						{adding ? (
							<AddColumnColumn
								draft={addDraft}
								onChange={setAddDraft}
								onCommit={commitAdd}
								onCancel={cancelAdd}
							/>
						) : (
							<button
								type="button"
								title="Add column"
								onClick={startAdd}
								className="flex h-8 w-[240px] shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-dashed border-[var(--separator)] text-[12px] font-medium text-tertiary transition-colors hover:border-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]"
							>
								<PlusSignIcon className="h-3.5 w-3.5" />
								Add column
							</button>
						)}
					</div>
					{menu && (
						<ColumnMenu
							menu={menu}
							columns={board.columns}
							onRename={(colId) => {
								const col = board.columns.find((c) => c.id === colId);
								if (!col) return;
								setRenaming(colId);
								setRenameDraft(col.name);
							}}
							onRecolor={recolorColumn}
							onDelete={deleteColumn}
							onClose={() => setMenu(null)}
						/>
					)}
					<DragOverlay>
						{overlayPr && (
							<div className="w-[232px]">
								<div className="surface-raised rounded-xl p-2.5">
									<CardBody pr={overlayPr} />
								</div>
							</div>
						)}
					</DragOverlay>
				</DndContext>
			)}
			<style>
				{
					"@keyframes menu-in { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }"
				}
			</style>
		</div>
	);
}
