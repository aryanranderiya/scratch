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
	color,
}: { status: PrItem["checkStatus"]; className?: string; color?: string }) {
	return (
		<GitPullRequestIcon
			className={cn("shrink-0", className)}
			style={{ color: color ?? prIconColor(status) }}
		/>
	);
}

/**
 * "org/repo #123" with the PR number in the accent color, separated from the
 * repo name. Used everywhere a PR reference is shown.
 */
export function PrRepoRef({
	pr,
	className,
	numberClassName,
	showOrg = true,
}: { pr: PrItem; className?: string; numberClassName?: string; showOrg?: boolean }) {
	const repoName = showOrg ? pr.repo : pr.repo.split("/").pop() ?? pr.repo;
	return (
		<span className={cn("inline-flex items-baseline gap-1", className)}>
			<span className="truncate">{repoName}</span>
			<span className={cn("shrink-0 font-semibold text-[var(--accent)]", numberClassName)}>
				#{pr.number}
			</span>
		</span>
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
	variant?: "row" | "chip" | "card";
}) {
	if (variant === "card") {
		const statusColor = pr.isDraft ? "var(--ink-secondary)" : prIconColor(pr.checkStatus);
		return (
			<span
				className="pr-mention-card flex w-full cursor-pointer items-start justify-start gap-2.5 rounded-2xl bg-[var(--surface-muted)] p-2 transition-colors hover:bg-[var(--surface-hover)]"
				role="button"
				tabIndex={0}
				title={`Open ${pr.repo}#${pr.number}`}
				onClick={() => onSelect?.()}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onSelect?.();
					}
				}}
			>
				<span
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
					style={{ background: `color-mix(in oklab, ${statusColor} 12%, transparent)` }}
				>
					<PrIcon status={pr.checkStatus} className="h-3.5 w-3.5" color={statusColor} />
				</span>
				<span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
					<span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-[var(--ink)]">
						{pr.title}
					</span>
					<span className="flex items-center gap-1.5">
						<PrRepoRef pr={pr} className="text-[11px] text-tertiary" />
						{pr.isDraft && (
							<span className="rounded-md bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] px-1.5 py-px text-[10px] font-medium text-[var(--ink-secondary)]">
								Draft
							</span>
						)}
					</span>
				</span>
			</span>
		);
	}

	if (variant === "chip") {
		return (
			<span
				className="pr-mention inline-flex max-w-full cursor-pointer items-center gap-1 align-middle"
				role="button"
				tabIndex={0}
				title={`Open ${pr.repo}#${pr.number}`}
				onClick={() => onSelect?.()}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onSelect?.();
					}
				}}
			>
				<PrIcon status={pr.checkStatus} className="h-3.5 w-3.5" />
				<span className="max-w-[16em] truncate text-[12.5px] font-medium text-[var(--ink)]">
					{pr.title}
				</span>
				<PrRepoRef pr={pr} className="shrink-0 text-[11px] text-tertiary" />
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
				selected
					? "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]"
					: "hover:bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]",
			)}
		>
			<PrIcon status={pr.checkStatus} className="h-4 w-4" />
			<div className="min-w-0 flex-1">
				<div className="truncate text-[13px] text-[var(--ink)]">{pr.title}</div>
				<PrRepoRef pr={pr} className="text-[11px] text-tertiary" />
			</div>
			{pr.isDraft && (
				<span className="shrink-0 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-tertiary">
					Draft
				</span>
			)}
		</button>
	);
}
