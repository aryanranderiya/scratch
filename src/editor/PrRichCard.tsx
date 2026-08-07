import {
	Cancel02Icon,
	GitPullRequestIcon,
	Tick02Icon,
} from "hugeicons-react";
import type { PrItem } from "../lib/types";
import { cn } from "../lib/utils";

/**
 * GitHub-style PR icon color: the git-pull-request icon is green for an open
 * PR and grey for a draft PR — matching GitHub's own UI.
 */
export function prIconColor(isDraft: boolean): string {
	return isDraft ? "var(--ink-tertiary)" : "var(--success)";
}

export function PrIcon({
	isDraft,
	mentioned,
	className,
	color,
}: { isDraft: boolean; mentioned?: boolean; className?: string; color?: string }) {
	return (
		<GitPullRequestIcon
			className={cn("shrink-0", className)}
			style={{ color: color ?? (mentioned ? "var(--accent)" : prIconColor(isDraft)) }}
		/>
	);
}

/**
 * CI status icon, distinct from the PR icon: a plain green check for success,
 * a plain red cross for failure, an orange dot for pending, nothing when
 * unknown. Matches GitHub's bare CI marks (no circles).
 */
export function CiStatusIcon({
	status,
	className,
}: { status: PrItem["checkStatus"]; className?: string }) {
	if (status === "success") {
		return (
			<Tick02Icon
				className={cn("shrink-0", className)}
				style={{ color: "var(--success)" }}
			/>
		);
	}
	if (status === "failure") {
		return (
			<Cancel02Icon
				className={cn("shrink-0", className)}
				style={{ color: "var(--danger)" }}
			/>
		);
	}
	if (status === "pending") {
		return (
			<span
				className={cn("shrink-0 rounded-full", className)}
				style={{ background: "var(--warning)" }}
			/>
		);
	}
	return null;
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
 * Shared rich PR content used by both the @ autocomplete popup and the
 * prMention block, so the editor shows the same content you picked.
 *
 * `variant="row"` is the full-width picker row (button). `variant="card"` is
 * the full-width block mention rendered inside the editor.
 */
export function PrRichCard({
	pr,
	selected,
	onSelect,
	onMouseEnter,
	mentioned,
	variant = "row",
}: {
	pr: PrItem;
	selected?: boolean;
	onSelect?: () => void;
	onMouseEnter?: () => void;
	mentioned?: boolean;
	variant?: "row" | "card";
}) {
	if (variant === "card") {
		const prColor = mentioned ? "var(--accent)" : prIconColor(pr.isDraft);
		return (
			<span
				className="pr-mention-card flex w-full cursor-pointer items-start justify-start gap-2.5 rounded-2xl bg-[var(--surface-muted)] p-2 transition-colors hover:bg-[var(--surface-hover)]"
				role="button"
				tabIndex={0}
				title={pr.title}
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
					style={{ background: `color-mix(in oklab, ${prColor} 12%, transparent)` }}
				>
					<PrIcon isDraft={pr.isDraft} mentioned={mentioned} className="h-3.5 w-3.5" />
				</span>
				<span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
					<span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-[var(--ink)]">
						{pr.title}
					</span>
					<span className="flex items-center gap-1.5">
						<PrRepoRef pr={pr} className="text-[11px] text-tertiary" />
						<CiStatusIcon status={pr.checkStatus} className="h-3 w-3" />
						{mentioned && (
							<span className="rounded-md bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-1.5 py-px text-[10px] font-medium text-[var(--accent)]">
								Linked
							</span>
						)}
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

	return (
		<button
			type="button"
			title={pr.title}
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
			<PrIcon isDraft={pr.isDraft} mentioned={mentioned} className="h-4 w-4" />
			<div className="min-w-0 flex-1">
				<div className="truncate text-[13px] text-[var(--ink)]">{pr.title}</div>
				<div className="flex items-center gap-1.5">
					<PrRepoRef pr={pr} className="text-[11px] text-tertiary" />
					<CiStatusIcon status={pr.checkStatus} className="h-3 w-3" />
				</div>
			</div>
			{mentioned && (
				<span className="shrink-0 rounded-md bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
					Linked
				</span>
			)}
			{pr.isDraft && (
				<span className="shrink-0 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-tertiary">
					Draft
				</span>
			)}
		</button>
	);
}
