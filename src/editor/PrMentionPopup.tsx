import { Refresh01Icon } from "hugeicons-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PrItem } from "../lib/types";
import { useAppStore } from "../store";
import { PrRichCard } from "./PrRichCard";

/** Extract already-linked PR ids ("org/repo#123") from a note's markdown. */
function linkedPrIds(markdown: string): Set<string> {
	const ids = new Set<string>();
	const re = /\[@([\w.-]+\/[\w.-]+)#(\d+)\]\(https:\/\/github\.com\//g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(markdown)) !== null) {
		ids.add(`${m[1]}#${m[2]}`);
	}
	return ids;
}

export interface PrPopupHandle {
	onKeyDown: (event: KeyboardEvent) => boolean;
}

interface PrMentionPopupProps {
	items: PrItem[];
	command: (item: PrItem) => void;
	query: string;
	loading?: boolean;
}

interface PrSection {
	label: string;
	prs: PrItem[];
}

function sectionLabel(item: PrItem): string | null {
	if (item.isDraft) return "Drafts";
	if (item.checkStatus === "success") return "Open · Passing";
	if (item.checkStatus === "failure") return "Open · Failing";
	return "Open · Idle";
}

const SECTION_ORDER = ["Open · Passing", "Open · Failing", "Open · Idle", "Drafts"];

export const PrMentionPopup = forwardRef<PrPopupHandle, PrMentionPopupProps>(
	function PrMentionPopup({ items, command, query, loading }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const [refreshing, setRefreshing] = useState(false);
		const listRef = useRef<HTMLDivElement>(null);
		const config = useAppStore((s) => s.config);

		const refresh = async () => {
			setRefreshing(true);
			try {
				await useAppStore.getState().refreshPrs();
			} finally {
				setRefreshing(false);
			}
		};

		const hiddenOrgs = config?.hiddenOrgs ?? [];
		const hiddenRepos = config?.hiddenRepos ?? [];
		const active = useAppStore((s) => s.active);
		const linked = useMemo(
			() => linkedPrIds(active?.content ?? ""),
			[active?.content],
		);

		const visibleItems = useMemo(() => {
			const hidden = new Set(hiddenOrgs);
			const hiddenReposSet = new Set(hiddenRepos);
			const filtered = items.filter(
				(item) => !hidden.has(item.org) && !hiddenReposSet.has(item.repo),
			);
			// Most-ready first: passing CI, then failing, then idle, drafts last.
			return [...filtered].sort((a, b) => {
				const aIdx = SECTION_ORDER.indexOf(sectionLabel(a) ?? "");
				const bIdx = SECTION_ORDER.indexOf(sectionLabel(b) ?? "");
				if (aIdx !== bIdx) return aIdx - bIdx;
				return a.repo.localeCompare(b.repo) || a.number - b.number;
			});
		}, [items, hiddenOrgs, hiddenRepos]);

		const sections = useMemo(() => {
			const map = new Map<string, PrItem[]>();
			for (const item of visibleItems) {
				const label = sectionLabel(item) ?? "Open · Idle";
				const list = map.get(label) ?? [];
				list.push(item);
				map.set(label, list);
			}
			const out: PrSection[] = [];
			for (const label of SECTION_ORDER) {
				const prs = map.get(label);
				if (prs && prs.length > 0) out.push({ label, prs });
			}
			return out;
		}, [visibleItems]);

		useEffect(() => {
			setSelectedIndex((i) => Math.min(i, Math.max(visibleItems.length - 1, 0)));
		}, [visibleItems.length]);

		useEffect(() => {
			const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
			el?.scrollIntoView({ block: "nearest" });
		}, [selectedIndex]);

		useImperativeHandle(ref, () => ({
			onKeyDown: (event: KeyboardEvent) => {
				if (event.key === "ArrowDown") {
					setSelectedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
					return true;
				}
				if (event.key === "ArrowUp") {
					setSelectedIndex((i) => Math.max(i - 1, 0));
					return true;
				}
				if (event.key === "Enter") {
					const item = visibleItems[selectedIndex];
					if (item) {
						command(item);
						return true;
					}
					return false;
				}
				if (event.key === "Escape") {
					return true;
				}
				return false;
			},
		}));

		if (loading) {
			return (
				<div className="surface-raised w-[min(400px,calc(100vw-2rem))] space-y-1.5 rounded-xl p-1.5">
					<div className="h-3 w-16 animate-pulse rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
							<div className="h-4 w-4 animate-pulse rounded-full bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
							<div className="flex-1 space-y-1.5">
								<div className="h-3 w-3/4 animate-pulse rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
								<div className="h-2.5 w-1/3 animate-pulse rounded-md bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]" />
							</div>
						</div>
					))}
				</div>
			);
		}

		if (visibleItems.length === 0) {
			return (
				<div className="surface-raised rounded-xl px-4 py-3">
					<span className="text-[13px] text-secondary">
						{query ? `No pull requests match "${query}"` : "No pull requests found"}
					</span>
				</div>
			);
		}

		return (
			<div
				ref={listRef}
				data-scratch-popup="pr"
				className="max-h-72 w-[min(400px,calc(100vw-2rem))] overflow-y-auto surface-raised rounded-xl p-1.5"
			>
				{sections.map(({ label, prs }) => (
					<div key={label}>
						{label !== "Open · Passing" && (
							<div className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-tertiary">
								{label}
							</div>
						)}
						{prs.map((item) => {
							const idx = visibleItems.indexOf(item);
							const selected = idx === selectedIndex;
							return (
								<div key={item.id} data-index={idx}>
									<PrRichCard
										pr={item}
										selected={selected}
										mentioned={linked.has(item.id)}
										onSelect={() => command(item)}
										onMouseEnter={() => setSelectedIndex(idx)}
									/>
								</div>
							);
						})}
					</div>
				))}
				<div className="mt-1 flex items-center justify-center">
					<button
						type="button"
						title={refreshing ? "Refreshing…" : "Refresh pull requests"}
						onMouseDown={(e) => e.stopPropagation()}
						onClick={() => void refresh()}
						disabled={refreshing}
						className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ink-secondary)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)] disabled:opacity-60"
					>
						{refreshing ? (
							<Refresh01Icon className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Refresh01Icon className="h-3.5 w-3.5" />
						)}
					</button>
				</div>
			</div>
		);
	},
);
