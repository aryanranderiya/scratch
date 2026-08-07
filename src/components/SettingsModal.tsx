import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
	CheckmarkCircle01Icon,
	CloudIcon,
	PlusSignIcon,
	RefreshIcon,
	StarIcon,
} from "hugeicons-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { openUrl } from "../lib/open";
import type { AppConfig, RepoChoice } from "../lib/types";
import { useAppStore } from "../store";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { Spinner } from "./ui/Spinner";
import { Toggle } from "./ui/Toggle";

function SettingsCard({
	title,
	description,
	children,
}: { title: string; description?: string; children: React.ReactNode }) {
	return (
		<section className="glass-soft space-y-3 rounded-xl p-4">
			<div>
				<h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
				{description && <p className="mt-0.5 text-[11px] text-tertiary">{description}</p>}
			</div>
			{children}
		</section>
	);
}

export function SettingsModal() {
	const open = useAppStore((s) => s.settingsOpen);
	const setOpen = useAppStore((s) => s.setSettingsOpen);
	const config = useAppStore((s) => s.config);
	const saveConfig = useAppStore((s) => s.saveConfig);
	const syncNow = useAppStore((s) => s.syncNow);
	const toggleOrgHidden = useAppStore((s) => s.toggleOrgHidden);
	const toggleOrgFavorite = useAppStore((s) => s.toggleOrgFavorite);

	const [token, setToken] = useState("");
	const [connecting, setConnecting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [repos, setRepos] = useState<RepoChoice[]>([]);
	const [showToken, setShowToken] = useState(false);
	const [vaultPath, setVaultPath] = useState(config?.vaultPath ?? "");
	const [interval, setIntervalSec] = useState(180);
	const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
	const [creatingRepo, setCreatingRepo] = useState(false);
	const [orgs, setOrgs] = useState<string[]>([]);
	const [orgsLoading, setOrgsLoading] = useState(false);
	const orgsLoaded = useRef(false);
	const wasOpen = useRef(false);

	useEffect(() => {
		if (!open) {
			wasOpen.current = false;
			return;
		}
		if (wasOpen.current) return;
		if (!config) return;
		wasOpen.current = true;
		setToken(config.githubToken ?? "");
		setVaultPath(config.vaultPath);
		setIntervalSec(config.syncIntervalSeconds);
		setTheme(config.theme as "system" | "light" | "dark");
		setError(null);
	}, [open, config]);

	useEffect(() => {
		if (!open) return;
		if (!config?.githubToken) {
			orgsLoaded.current = false;
			setOrgs([]);
			return;
		}
		if (orgsLoaded.current) return;
		setOrgsLoading(true);
		api
			.listOrgs(config.githubToken)
			.then((list) => {
				setOrgs(list);
				orgsLoaded.current = true;
			})
			.catch((e) => setError(String(e)))
			.finally(() => setOrgsLoading(false));
	}, [open, config]);

	const connect = async () => {
		if (!config) return;
		setConnecting(true);
		setError(null);
		try {
			const user = await api.getGithubUser(token.trim());
			await api.listOrgs(token.trim());
			const available = await api.listUserRepos(token.trim());
			setRepos(available);
			setConnecting(false);
			await persist({
				...config,
				githubToken: token.trim(),
				githubLogin: user.login,
			});
		} catch (e) {
			setConnecting(false);
			setError(String(e));
		}
	};

	const persist = async (cfg: AppConfig) => {
		await saveConfig(cfg);
	};

	const createNotesRepo = async () => {
		if (!config) return;
		setCreatingRepo(true);
		setError(null);
		try {
			const fullName = await api.createNotesRepo(token.trim());
			setRepos([]);
			await persist({
				...config,
				githubToken: token.trim(),
				notesRepo: fullName,
			});
			await syncNow();
		} catch (e) {
			setError(String(e));
		} finally {
			setCreatingRepo(false);
		}
	};

	const useRepo = async (fullName: string) => {
		if (!config) return;
		setError(null);
		await persist({
			...config,
			githubToken: token.trim(),
			notesRepo: fullName,
		});
		await syncNow();
	};

	const saveSettings = async () => {
		if (!config) return;
		await persist({
			...config,
			vaultPath,
			syncIntervalSeconds: interval,
			theme,
		});
		setOpen(false);
	};

	const connected = Boolean(config?.githubLogin);

	const icloudVaultPath = vaultPath.startsWith("/Users/")
		? `${vaultPath.split("/").slice(0, 3).join("/")}/Library/Mobile Documents/com~apple~CloudDocs/Scratch`
		: null;
	const icloudOn = vaultPath.includes("Mobile Documents");

	const sortedOrgs = [...orgs].sort((a, b) => {
		const aFav = config?.favoriteOrgs.includes(a) ?? false;
		const bFav = config?.favoriteOrgs.includes(b) ?? false;
		if (aFav !== bFav) return aFav ? -1 : 1;
		return a.localeCompare(b);
	});

	return (
		<Modal open={open} onClose={() => setOpen(false)} title="Settings" width="max-w-lg">
			<div className="space-y-3">
				<SettingsCard
					title="GitHub"
					description="Scratch uses your token to search pull requests and sync your notes."
				>
					<div className="flex gap-2">
						<Input
							type={showToken ? "text" : "password"}
							value={token}
							onChange={(e) => setToken(e.currentTarget.value)}
							placeholder="GitHub Personal Access Token"
						/>
						<Button onClick={() => setShowToken((s) => !s)} variant="secondary">
							{showToken ? "Hide" : "Show"}
						</Button>
						<Button onClick={() => void connect()} disabled={connecting || !token.trim()}>
							{connecting ? <Spinner className="h-4 w-4" /> : "Connect"}
						</Button>
					</div>

					{connected && (
						<p className="flex items-center gap-1 text-[11px] font-medium text-[var(--success)]">
							<CheckmarkCircle01Icon className="h-3 w-3" />
							Connected as {config?.githubLogin}
						</p>
					)}

					<p className="text-[11px] leading-relaxed text-tertiary">
						Token needs <code className="rounded bg-[var(--surface-muted)] px-1">repo</code> scope
						for PR search and sync. It's stored locally on this machine.{" "}
						<button
							type="button"
							className="text-[var(--accent)] hover:underline"
							onClick={() => void openUrl("https://github.com/settings/tokens")}
						>
							Create one
						</button>
					</p>

					{connected && config?.githubToken && config.notesRepo ? (
						<div className="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
							<div>
								<div className="text-[13px] font-medium">Notes repo</div>
								<div className="text-[12px] text-tertiary">{config.notesRepo}</div>
							</div>
							<Button variant="secondary" size="sm" onClick={() => void useRepo("")}>
								Disconnect
							</Button>
						</div>
					) : (
						<div className="space-y-2">
							<Button
								variant="primary"
								onClick={() => void createNotesRepo()}
								disabled={creatingRepo}
							>
								{creatingRepo ? (
									<Spinner className="h-4 w-4" />
								) : (
									<PlusSignIcon className="h-4 w-4" />
								)}
								Create private scratch-notes repo
							</Button>
							{repos.length > 0 && (
								<div className="space-y-1">
									<p className="text-[11px] font-medium text-tertiary">
										Or sync to an existing repo:
									</p>
									<div className="max-h-40 space-y-1 overflow-y-auto">
										{repos.map((r) => (
											<button
												key={r.fullName}
												type="button"
												onClick={() => void useRepo(r.fullName)}
												className="flex w-full items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
											>
												<span className="text-[13px]">{r.fullName}</span>
												<span className="text-[11px] text-tertiary">
													{r.isPrivate ? "private" : "public"}
												</span>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</SettingsCard>

				<SettingsCard
					title="Vault & Sync"
					description="Notes are plain markdown files in a git repo, synced on a timer."
				>
					<div className="flex gap-2">
						<Input
							value={vaultPath}
							onChange={(e) => setVaultPath(e.currentTarget.value)}
							placeholder="/Users/you/Scratch"
						/>
						<Button
							variant="secondary"
							onClick={async () => {
								const dir = await openDialog({
									directory: true,
									multiple: false,
									title: "Choose notes vault",
								});
								if (typeof dir === "string") setVaultPath(dir);
							}}
						>
							Browse
						</Button>
					</div>

					{icloudVaultPath && (
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<CloudIcon className="h-4 w-4 text-[var(--ink-secondary)]" />
								<div>
									<div className="text-[13px]">iCloud Drive sync</div>
									<p className="text-[11px] text-tertiary">
										Store the vault in iCloud Drive (synced to your other devices)
									</p>
								</div>
							</div>
							<Toggle
								checked={icloudOn}
								onChange={(on) => {
									if (on) setVaultPath(icloudVaultPath);
								}}
							/>
						</div>
					)}

					<div className="flex items-center gap-3">
						<select
							value={interval}
							onChange={(e) => setIntervalSec(Number(e.currentTarget.value))}
							className="h-9 rounded-lg border border-transparent bg-[var(--surface-muted)] px-3 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-40"
						>
							<option value={60}>Every minute</option>
							<option value={180}>Every 3 minutes</option>
							<option value={300}>Every 5 minutes</option>
							<option value={600}>Every 10 minutes</option>
							<option value={1800}>Every 30 minutes</option>
						</select>
						<Button variant="secondary" onClick={() => void syncNow()}>
							<RefreshIcon className="h-4 w-4" />
							Sync now
						</Button>
					</div>
				</SettingsCard>

				{connected && config?.githubToken && (
					<SettingsCard
						title="Organizations"
						description="Hidden orgs are excluded from PR search; favorites sort to the top."
					>
						{orgsLoading ? (
							<div className="flex items-center gap-2 py-1 text-[13px] text-tertiary">
								<Spinner className="h-3.5 w-3.5" />
								Loading organizations...
							</div>
						) : (
							<ul className="space-y-1">
								{sortedOrgs.map((org) => {
									const hidden = config.hiddenOrgs.includes(org);
									const favorite = config.favoriteOrgs.includes(org);
									return (
										<li
											key={org}
											className="flex items-center justify-between gap-2 rounded-lg px-1 py-1"
										>
											<span className="min-w-0 truncate text-[13px]">{org}</span>
											<span className="flex shrink-0 items-center gap-2">
												<button
													type="button"
													role="switch"
													aria-checked={!hidden}
													title={hidden ? `Show ${org} in PR search` : `Hide ${org} from PR search`}
													onClick={() => void toggleOrgHidden(org)}
													className="flex h-6 w-10 items-center rounded-full transition-colors duration-200"
													style={{
														background: hidden ? "var(--surface-hover)" : "var(--accent)",
														justifyContent: hidden ? "flex-start" : "flex-end",
													}}
												>
													<span className="mx-0.5 h-5 w-5 rounded-full bg-white shadow-1" />
												</button>
												<Button
													variant="ghost"
													size="icon"
													title={favorite ? "Unfavorite" : "Favorite"}
													aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${org}`}
													onClick={() => void toggleOrgFavorite(org)}
													className={
														favorite
															? "text-[var(--warning)] hover:text-[var(--warning)]"
															: undefined
													}
												>
													<StarIcon className="h-4 w-4" />
												</Button>
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</SettingsCard>
				)}

				<SettingsCard title="Appearance">
					<div className="flex items-center gap-2">
						{(
							[
								["system", "System"],
								["light", "Light"],
								["dark", "Dark"],
							] as const
						).map(([value, label]) => (
							<button
								key={value}
								type="button"
								onClick={() => setTheme(value)}
								className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
									theme === value
										? "bg-[var(--accent)] text-white"
										: "bg-[var(--surface-muted)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
								}`}
							>
								{label}
							</button>
						))}
					</div>
				</SettingsCard>

				{error && (
					<div className="rounded-xl bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--danger)]">
						{error}
					</div>
				)}

				<div className="flex justify-end gap-2 pt-1">
					<Button variant="ghost" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button variant="primary" onClick={() => void saveSettings()}>
						Save
					</Button>
				</div>
			</div>
		</Modal>
	);
}
