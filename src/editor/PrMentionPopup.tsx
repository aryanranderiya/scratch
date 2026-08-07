import { CancelCircleIcon, CheckmarkCircle01Icon, Clock01Icon } from "hugeicons-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Spinner } from "../components/ui/Spinner";
import type { CheckStatus, PrGroup, PrItem } from "../lib/types";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";

export interface PrPopupHandle {
	onKeyDown: (event: KeyboardEvent) => boolean;
}

interface PrMentionPopupProps {
	items: PrItem[];
	command: (item: PrItem) => void;
	query: string;
	loading?: boolean;
}

function StatusIcon({ status }: { status: CheckStatus }) {
	if (status === "success") {
		return <CheckmarkCircle01Icon className="h-4 w-4 shrink-0 text-[var(--success)]" />;
	}
	if (status === "failure") {
		return <CancelCircleIcon className="h-4 w-4 shrink-0 text-[var(--danger)]" />;
	}
	if (status === "pending") {
		return <Clock01Icon className="h-4 w-4 shrink-0 text-[var(--warning)]" />;
	}
	return (
		<span className="flex h-4 w-4 shrink-0 items-center justify-center text-[11px] leading-none text-[var(--ink-tertiary)]">
			—
		</span>
	);
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
				<div className="flex items-center gap-2 rounded-xl bg-[var(--surface-raised)] px-4 py-3 shadow-2">
					<Spinner className="h-4 w-4 text-[var(--ink-tertiary)]" />
					<span className="text-[13px] text-secondary">Loading pull requests…</span>
				</div>
			);
		}

		if (visibleItems.length === 0) {
			return (
				<div className="rounded-xl bg-[var(--surface-raised)] px-4 py-3 shadow-2">
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
				className="max-h-72 w-[min(400px,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-[var(--surface-raised)] p-1.5 shadow-2"
			>
				{grouped.map(({ org, prs }) => (
					<div key={org}>
						<div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-tertiary">
							{org}
						</div>
						{prs.map((item) => {
							const idx = visibleItems.indexOf(item);
							const selected = idx === selectedIndex;
							return (
								<button
									key={item.id}
									type="button"
									data-index={idx}
									onMouseEnter={() => setSelectedIndex(idx)}
									onMouseDown={(e) => {
										e.preventDefault();
										command(item);
									}}
									className={cn(
										"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
										selected && "bg-[var(--surface-muted)]",
									)}
								>
									<StatusIcon status={item.checkStatus} />
									<div className="min-w-0 flex-1">
										<div className="truncate text-[13px] text-[var(--ink)]">{item.title}</div>
										<div className="truncate text-[11px] text-tertiary">
											{item.org}/{item.repo}#{item.number}
										</div>
									</div>
									{item.isDraft && (
										<span className="shrink-0 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-tertiary">
											Draft
										</span>
									)}
								</button>
							);
						})}
					</div>
				))}
			</div>
		);
	},
);
