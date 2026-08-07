import { GitPullRequestIcon } from "hugeicons-react";
import type { PrItem } from "../lib/types";
import { cn } from "../lib/utils";

/** GitHub-style PR icon color: green for open/success, red for failure, amber for pending. */
export function prIconColor(status: PrItem["checkStatus"]): string {
	switch (status) {
		case "success":
			return "var(--success)";
		case "failure":
			return "var(--danger)";
		case "pending":
			return "var(--warning)";
		default:
			return "var(--ink-tertiary)";
	}
}

export function PrIcon({
	status,
	className,
}: { status: PrItem["checkStatus"]; className?: string }) {
	return (
		<GitPullRequestIcon
			className={cn("shrink-0", className)}
			style={{ color: prIconColor(status) }}
		/>
	);
}

/**
 * Shared rich PR content used by both the @ autocomplete popup and the inline
 * prMention node, so the editor shows the same content you picked.
 *
 * `variant="row"` is the full-width picker row (button). `variant="chip"` is
 * the compact inline mention rendered inside the editor (span).
 */
export function PrRichCard({
	pr,
	selected,
	onSelect,
	onMouseEnter,
	variant = "row",
}: {
	pr: PrItem;
	selected?: boolean;
	onSelect?: () => void;
	onMouseEnter?: () => void;
	variant?: "row" | "chip";
}) {
	if (variant === "chip") {
		return (
			<span className="inline-flex max-w-full items-center gap-1 align-middle">
				<PrIcon status={pr.checkStatus} className="h-3.5 w-3.5" />
				<span className="max-w-[16em] truncate text-[12.5px] font-medium text-[var(--ink)]">
					{pr.title}
				</span>
				<span className="shrink-0 font-mono text-[11px] text-tertiary">
					{pr.repo}#{pr.number}
				</span>
			</span>
		);
	}

	return (
		<button
			type="button"
			onMouseEnter={onMouseEnter}
			onMouseDown={(e) => {
				e.preventDefault();
				onSelect?.();
			}}
			className={cn(
				"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
				selected && "bg-[var(--surface-muted)]",
			)}
		>
			<PrIcon status={pr.checkStatus} className="h-4 w-4" />
			<div className="min-w-0 flex-1">
				<div className="truncate text-[13px] text-[var(--ink)]">{pr.title}</div>
				<div className="truncate text-[11px] text-tertiary">
					{pr.repo}#{pr.number}
				</div>
			</div>
			{pr.isDraft && (
				<span className="shrink-0 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-tertiary">
					Draft
				</span>
			)}
		</button>
	);
}
