import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PrGroup, PrItem } from "../lib/types";
import { useAppStore } from "../store";
import { PrRichCard } from "./PrRichCard";

export interface PrPopupHandle {
	onKeyDown: (event: KeyboardEvent) => boolean;
}

interface PrMentionPopupProps {
	items: PrItem[];
	command: (item: PrItem) => void;
	query: string;
	loading?: boolean;
}

export const PrMentionPopup = forwardRef<PrPopupHandle, PrMentionPopupProps>(
	function PrMentionPopup({ items, command, query, loading }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const listRef = useRef<HTMLDivElement>(null);
		const config = useAppStore((s) => s.config);

		const hiddenOrgs = config?.hiddenOrgs ?? [];
		const favoriteOrgs = config?.favoriteOrgs ?? [];

		const visibleItems = useMemo(() => {
			const hidden = new Set(hiddenOrgs);
			return items.filter((item) => !hidden.has(item.org));
		}, [items, hiddenOrgs]);

		const grouped = useMemo(() => {
			const map = new Map<string, PrItem[]>();
			for (const item of visibleItems) {
				const list = map.get(item.org) ?? [];
				list.push(item);
				map.set(item.org, list);
			}
			const favoriteGroups: PrGroup[] = [];
			for (const org of favoriteOrgs) {
				const prs = map.get(org);
				if (prs) {
					favoriteGroups.push({ org, prs });
				}
			}
			const otherGroups = Array.from(map.entries())
				.filter(([org]) => !favoriteOrgs.includes(org))
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([org, prs]) => ({ org, prs }));
			return [...favoriteGroups, ...otherGroups];
		}, [visibleItems, favoriteOrgs]);

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
				{grouped.map(({ org, prs }) => (
					<div key={org}>
						<div className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-tertiary">{org}</div>
						{prs.map((item) => {
							const idx = visibleItems.indexOf(item);
							const selected = idx === selectedIndex;
							return (
								<div key={item.id} data-index={idx}>
									<PrRichCard
										pr={item}
										selected={selected}
										onSelect={() => command(item)}
										onMouseEnter={() => setSelectedIndex(idx)}
									/>
								</div>
							);
						})}
					</div>
				))}
			</div>
		);
	},
);
