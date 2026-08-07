import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: ReactNode;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className="flex items-center gap-2 select-none"
		>
			<span
				className={cn(
					"relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200",
					checked ? "bg-[var(--accent)]" : "bg-[var(--surface-hover)]",
				)}
			>
				<span
					className={cn(
						"inline-block h-5 w-5 transform rounded-full bg-white shadow-1 transition-transform duration-200",
						checked ? "translate-x-[18px]" : "translate-x-[2px]",
					)}
				/>
			</span>
			{label && <span className="text-[13px] text-[var(--ink)]">{label}</span>}
		</button>
	);
}
