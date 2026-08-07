import {
	ArrowRight01Icon,
	CheckmarkCircle01Icon,
	Folder02Icon,
	GithubIcon,
	PlusSignIcon,
} from "hugeicons-react";
import { useState } from "react";
import { api } from "../lib/api";
import { openUrl } from "../lib/open";
import type { RepoChoice } from "../lib/types";
import { useAppStore } from "../store";
import { Logo } from "./Logo";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Spinner } from "./ui/Spinner";

type Step = "token" | "repo" | "done";

export function Onboarding() {
	const config = useAppStore((s) => s.config);
	const saveConfig = useAppStore((s) => s.saveConfig);
	const syncNow = useAppStore((s) => s.syncNow);

	const [step, setStep] = useState<Step>("token");
	const [token, setToken] = useState("");
	const [connecting, setConnecting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [repos, setRepos] = useState<RepoChoice[]>([]);
	const [loadingRepos, setLoadingRepos] = useState(false);
	const [creating, setCreating] = useState(false);

	const connect = async () => {
		if (!config) return;
		setConnecting(true);
		setError(null);
		try {
			const user = await api.getGithubUser(token.trim());
			await saveConfig({
				...config,
				githubToken: token.trim(),
				githubLogin: user.login,
			});
			setLoadingRepos(true);
			try {
				const available = await api.listUserRepos(token.trim());
				setRepos(available);
			} finally {
				setLoadingRepos(false);
			}
			setStep("repo");
		} catch (e) {
			setError(String(e));
		} finally {
			setConnecting(false);
		}
	};

	const createRepo = async () => {
		if (!config) return;
		setCreating(true);
		setError(null);
		try {
			const fullName = await api.createNotesRepo(token.trim());
			await saveConfig({ ...config, notesRepo: fullName });
			await syncNow();
			setStep("done");
		} catch (e) {
			setError(String(e));
		} finally {
			setCreating(false);
		}
	};

	const useExisting = async (fullName: string) => {
		if (!config) return;
		setError(null);
		try {
			await saveConfig({ ...config, notesRepo: fullName });
			await syncNow();
			setStep("done");
		} catch (e) {
			setError(String(e));
		}
	};

	return (
		<div className="flex h-full items-center justify-center p-5">
			<div
				className="glass-strong w-full max-w-sm rounded-2xl p-6 shadow-3"
				style={{ animation: "scale-in 0.2s ease-out" }}
			>
				<div className="mb-6 flex items-center gap-3">
					<Logo size={34} />
					<div>
						<h1 className="text-[17px] font-semibold tracking-tight">Welcome to Scratch</h1>
						<p className="text-[13px] text-tertiary">A scratchpad for your mind</p>
					</div>
				</div>

				{step === "token" && (
					<>
						<div className="mb-4 flex items-center gap-2 text-[13px] text-tertiary">
							<GithubIcon className="h-4 w-4" />
							Step 1 of 2 — Connect GitHub
						</div>
						<Input
							type="password"
							value={token}
							onChange={(e) => setToken(e.currentTarget.value)}
							placeholder="GitHub Personal Access Token"
							autoFocus
						/>
						<p className="mb-4 mt-2 text-[11px] leading-relaxed text-tertiary">
							Scratch uses your token to search pull requests across your repos and organisations,
							and to sync your notes to a private repo. The token never leaves this machine.
						</p>
						<Button
							variant="primary"
							className="w-full"
							disabled={connecting || !token.trim()}
							onClick={() => void connect()}
						>
							{connecting ? <Spinner className="h-4 w-4" /> : "Connect"}
						</Button>
						<button
							type="button"
							className="mt-3 w-full text-center text-[12px] text-[var(--accent)] hover:underline"
							onClick={() => void openUrl("https://github.com/settings/tokens")}
						>
							Create a token
						</button>
						{error && (
							<div className="mt-3 rounded-xl bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--danger)]">
								{error}
							</div>
						)}
					</>
				)}

				{step === "repo" && (
					<>
						<div className="mb-4 flex items-center gap-2 text-[13px] text-tertiary">
							<Folder02Icon className="h-4 w-4" />
							Step 2 of 2 — Where should your notes sync?
						</div>
						<div className="space-y-2">
							<button
								type="button"
								onClick={() => void createRepo()}
								disabled={creating}
								className="flex w-full items-center gap-3 rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
							>
								{creating ? (
									<Spinner className="h-5 w-5 text-[var(--accent)]" />
								) : (
									<PlusSignIcon className="h-5 w-5 text-[var(--accent)]" />
								)}
								<div>
									<div className="text-[13px] font-medium">Create a new private repo</div>
									<div className="text-[12px] text-tertiary">scratch-notes under your account</div>
								</div>
								<ArrowRight01Icon className="ml-auto h-4 w-4 text-tertiary" />
							</button>

							<div className="py-1 text-center text-[11px] text-tertiary">or</div>

							{loadingRepos ? (
								<div className="flex items-center gap-2 px-2 py-2 text-[12px] text-tertiary">
									<Spinner className="h-4 w-4" /> Loading your repos…
								</div>
							) : repos.length > 0 ? (
								<>
									<div className="px-2 text-[11px] font-medium text-tertiary">
										Sync to an existing repo
									</div>
									<div className="max-h-48 space-y-1 overflow-y-auto">
										{repos.map((r) => (
											<button
												key={r.fullName}
												type="button"
												onClick={() => void useExisting(r.fullName)}
												className="flex w-full items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
											>
												<span className="text-[13px]">{r.fullName}</span>
												<span className="text-[11px] text-tertiary">
													{r.isPrivate ? "private" : "public"}
												</span>
											</button>
										))}
									</div>
								</>
							) : null}
						</div>
						{error && (
							<div className="mt-3 rounded-xl bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--danger)]">
								{error}
							</div>
						)}
					</>
				)}

				{step === "done" && (
					<div className="text-center">
						<CheckmarkCircle01Icon className="mx-auto mb-3 h-12 w-12 text-[var(--success)]" />
						<h2 className="text-[15px] font-semibold">All set!</h2>
						<p className="mb-4 text-[13px] text-tertiary">
							Start jotting. Type <code className="rounded bg-[var(--surface-muted)] px-1">/</code>{" "}
							for commands or <code className="rounded bg-[var(--surface-muted)] px-1">@</code> to
							link a pull request.
						</p>
						<Button variant="primary" className="w-full" onClick={() => setStep("token")}>
							Get started
						</Button>
					</div>
				)}

				<style>
					{
						"@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }"
					}
				</style>
			</div>
		</div>
	);
}
