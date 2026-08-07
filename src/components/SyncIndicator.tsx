import { Alert02Icon, CheckmarkCircle02Icon, RefreshIcon } from "hugeicons-react";
import { useEffect, useRef } from "react";
import { cn, formatRelative } from "../lib/utils";
import { useAppStore } from "../store";

export function SyncIndicator() {
	const sync = useAppStore((s) => s.sync);
	const refreshSyncStatus = useAppStore((s) => s.refreshSyncStatus);
	const syncNow = useAppStore((s) => s.syncNow);
	const config = useAppStore((s) => s.config);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const interval = config?.syncIntervalSeconds ?? 180;

	useEffect(() => {
		if (intervalRef.current) clearInterval(intervalRef.current);
		intervalRef.current = setInterval(() => {
			void refreshSyncStatus();
		}, Math.max(interval, 10) * 1000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [interval, refreshSyncStatus]);

	const syncing = sync?.syncing ?? false;
	const lastError = sync?.lastError ?? null;
	const lastSyncedAt = sync?.lastSyncedAt ?? null;
	const remoteConfigured = sync?.remoteConfigured ?? false;

	// Nothing to show when idle and no remote is configured.
	if (!syncing && !lastError && !(lastSyncedAt && remoteConfigured)) {
		return null;
	}

	const title = lastError
		? `Sync failed: ${lastError} — click to retry`
		: lastSyncedAt
			? `Synced ${formatRelative(lastSyncedAt)} — click to sync now`
			: "Not synced yet — click to sync now";

	return (
		<button
			type="button"
			onClick={() => void syncNow()}
			title={title}
			aria-label={title}
			className={cn(
				"flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
				lastError
					? "text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
					: "text-[var(--ink-secondary)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]",
			)}
		>
			{syncing ? (
				<RefreshIcon className="h-3.5 w-3.5 animate-spin" />
			) : lastError ? (
				<Alert02Icon className="h-3.5 w-3.5" />
			) : (
				<CheckmarkCircle02Icon className="h-3.5 w-3.5 text-[var(--success)]" />
			)}
		</button>
	);
}
