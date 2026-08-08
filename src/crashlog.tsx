import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { Copy01Icon } from "hugeicons-react";
import { create } from "zustand";

export interface CrashInfo {
	message: string;
	stack: string;
	at: string;
}

interface CrashLogState {
	crash: CrashInfo | null;
	report: (info: CrashInfo) => void;
	clear: () => void;
}

export const useCrashLog = create<CrashLogState>((set) => ({
	crash: null,
	report: (info) => set({ crash: info }),
	clear: () => set({ crash: null }),
}));

function describeError(error: unknown): CrashInfo {
	if (error instanceof Error) {
		return { message: error.message || String(error), stack: error.stack ?? "", at: new Date().toISOString() };
	}
	return {
		message: typeof error === "string" ? error : JSON.stringify(error),
		stack: "",
		at: new Date().toISOString(),
	};
}

/** Persist a crash report to crash.log in the app config dir (fire-and-forget). */
function persistReport(info: CrashInfo) {
	const text = `Scratch crash report\noccurred at: ${info.at}\n\n${info.message}\n\n${info.stack}`;
	void import("./lib/api").then(({ api }) => api.saveCrashReport(text)).catch(() => {
		// If the crash broke IPC, fall back to localStorage so the report survives.
		try {
			const prev = JSON.parse(localStorage.getItem("scratch-crash-log") ?? "[]") as CrashInfo[];
			prev.push(info);
			localStorage.setItem("scratch-crash-log", JSON.stringify(prev.slice(-5)));
		} catch {
			/* no storage either */
		}
	});
}

/** Capture uncaught errors + promise rejections into the crash log. */
export function installGlobalErrorHandlers(): () => void {
	const onError = (event: ErrorEvent) => {
		const info = describeError(event.error ?? new Error(event.message));
		useCrashLog.getState().report(info);
		persistReport(info);
	};
	const onRejection = (event: PromiseRejectionEvent) => {
		const info = describeError(event.reason);
		useCrashLog.getState().report(info);
		persistReport(info);
	};
	window.addEventListener("error", onError);
	window.addEventListener("unhandledrejection", onRejection);
	return () => {
		window.removeEventListener("error", onError);
		window.removeEventListener("unhandledrejection", onRejection);
	};
}

interface CrashBoundaryProps {
	children: ReactNode;
}

/** React error boundary that surfaces render crashes instead of a blank screen. */
export class CrashBoundary extends Component<CrashBoundaryProps> {
	override state: { error: CrashInfo | null } = { error: null };

	static getDerivedStateFromError(error: unknown): { error: CrashInfo | null } {
		return { error: describeError(error) };
	}

	override componentDidCatch(error: unknown, info: ErrorInfo) {
		const crash = describeError(error);
		if (info.componentStack) {
			crash.stack += `\n\ncomponent stack:\n${info.componentStack}`;
		}
		useCrashLog.getState().report(crash);
		persistReport(crash);
	}

	override render() {
		if (this.state.error) {
			return <CrashLogFallback />;
		}
		return this.props.children;
	}
}

/** Fallback UI rendered in place of the crashed subtree — shows the crash inline. */
export function CrashLogFallback() {
	const crash = useCrashLog((s) => s.crash);
	const clear = useCrashLog((s) => s.clear);
	const [copied, setCopied] = useState(false);

	const report = crash ?? {
		message: "Unknown render crash",
		stack: "",
		at: new Date().toISOString(),
	};

	const copy = async () => {
		const text = `Scratch crash report\noccurred at: ${report.at}\n\n${report.message}\n\n${report.stack}`;
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			const ta = document.getElementById("crash-log-text") as HTMLTextAreaElement | null;
			ta?.select();
			document.execCommand("copy");
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		}
	};

	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-6">
			<span className="text-[14px] font-semibold text-[var(--ink)]">Something went wrong</span>
			<span className="text-[12px] text-tertiary">
				Copy the crash report below and paste it to the agent to fix it.
			</span>
			<textarea
				id="crash-log-text"
				readOnly
				value={`Scratch crash report\noccurred at: ${report.at}\n\n${report.message}\n\n${report.stack}`}
				onFocus={(e) => e.currentTarget.select()}
				autoFocus
				className="h-52 w-full max-w-md resize-none rounded-xl bg-[var(--surface-muted)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ink)] outline-none"
			/>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={copy}
					className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
				>
					<Copy01Icon className="h-3.5 w-3.5" />
					{copied ? "Copied!" : "Copy crash report"}
				</button>
				<button
					type="button"
					onClick={() => {
						clear();
						window.location.reload();
					}}
					className="flex h-8 items-center rounded-lg bg-[var(--surface-muted)] px-3.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
				>
					Reload
				</button>
			</div>
		</div>
	);
}
