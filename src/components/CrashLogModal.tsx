import { Copy01Icon } from "hugeicons-react";
import { useState } from "react";
import { useCrashLog } from "../crashlog";
import { Modal } from "./ui/Modal";

export function CrashLogModal() {
	const crash = useCrashLog((s) => s.crash);
	const clear = useCrashLog((s) => s.clear);
	const [copied, setCopied] = useState(false);

	if (!crash) return null;

	const copy = async () => {
		const text = `Scratch crash report\noccurred at: ${crash.at}\n\n${crash.message}\n\n${crash.stack}`;
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// clipboard unavailable (e.g. no permission) — fall back to textarea select
			const ta = document.getElementById("crash-log-text") as HTMLTextAreaElement | null;
			ta?.select();
			document.execCommand("copy");
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		}
	};

	return (
		<Modal
			open
			onClose={() => clear()}
			title="Something went wrong"
			width="max-w-lg"
		>
			<div className="flex flex-col gap-3">
				<p className="text-[12px] leading-relaxed text-secondary">
					Scratch hit a crash. Copy the report below and paste it to the agent so it can
					fix the exact problem.
				</p>
				<textarea
					id="crash-log-text"
					readOnly
					value={`Scratch crash report\noccurred at: ${crash.at}\n\n${crash.message}\n\n${crash.stack}`}
					className="h-48 w-full resize-none rounded-xl bg-[var(--surface-muted)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ink)] outline-none"
					onFocus={(e) => e.currentTarget.select()}
				/>
				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={copy}
						className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
					>
						<Copy01Icon className="h-3.5 w-3.5" />
						{copied ? "Copied!" : "Copy crash report"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
