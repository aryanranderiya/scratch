import { CheckmarkCircle02Icon, FilterIcon } from "hugeicons-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";

/**
 * Repo visibility filter for the PR board. Renders a compact "Repos" button
 * with a dropdown of every repo that has open PRs. Lives in the top bar
 * (board view) and shares state through the store.
 */
export function BoardRepoFilter({ allRepos }: { allRepos: string[] }) {
	const hiddenRepos = useAppStore((s) => s.boardHiddenRepos);
	const setBoardHiddenRepos = useAppStore((s) => s.setBoardHiddenRepos);
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onMouseDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("mousedown", onMouseDown);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("mousedown", onMouseDown);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const toggleRepo = (repo: string) => {
		const next = hiddenRepos.includes(repo)
			? hiddenRepos.filter((r) => r !== repo)
			: [...hiddenRepos, repo];
		setBoardHiddenRepos(next);
	};

	const selectAll = () => setBoardHiddenRepos([]);
	const selectNone = () => setBoardHiddenRepos([...allRepos]);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				title="Filter repos"
				onClick={() => setOpen((o) => !o)}
				className={cn(
					"flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors",
					open || hiddenRepos.length > 0
						? "text-[var(--accent)] hover:bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
						: "text-[var(--ink-secondary)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]",
				)}
			>
				<FilterIcon className="h-3.5 w-3.5" />
				Repos
				{hiddenRepos.length > 0 && (
					<span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-semibold text-[var(--accent)]">
						{hiddenRepos.length}
					</span>
				)}
			</button>
			{open && (
				<div
					className="surface-raised absolute left-0 top-full z-50 mt-1 w-64 rounded-xl p-1.5 shadow-3"
					style={{ animation: "menu-in 0.12s ease-out" }}
				>
					<div className="flex items-center justify-between px-2.5 pb-1 pt-1">
						<span className="text-[11px] font-medium text-tertiary">Show PRs from</span>
						<span className="flex items-center gap-2">
							<button
								type="button"
								onClick={selectAll}
								className="text-[11px] font-medium text-[var(--accent)] hover:underline"
							>
								Select all
							</button>
							<button
								type="button"
								onClick={selectNone}
								className="text-[11px] font-medium text-[var(--accent)] hover:underline"
							>
								Select none
							</button>
						</span>
					</div>
					<div className="max-h-56 overflow-y-auto">
						{allRepos.length === 0 && (
							<div className="px-2.5 py-2 text-[12px] text-tertiary">No repos yet</div>
						)}
						{allRepos.map((repo) => {
							const hidden = hiddenRepos.includes(repo);
							return (
								<button
									key={repo}
									type="button"
									onClick={() => toggleRepo(repo)}
									className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
								>
									<span
										className={cn(
											"flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
											hidden
												? "border-[var(--separator)] bg-transparent"
												: "border-[var(--accent)] bg-[var(--accent)]",
										)}
									>
										{!hidden && <CheckmarkCircle02Icon className="h-3 w-3 text-white" />}
									</span>
									<span className={cn("min-w-0 truncate", hidden && "text-tertiary")}>{repo}</span>
								</button>
							);
						})}
					</div>
					<style>
						{
							"@keyframes menu-in { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }"
						}
					</style>
				</div>
			)}
		</div>
	);
}
