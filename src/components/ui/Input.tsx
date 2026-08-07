import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
	return (
		<input
			className={cn(
				"h-9 w-full rounded-lg bg-[var(--surface-muted)] px-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)]",
				"focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-40",
				"border border-transparent transition-shadow",
				className,
			)}
			{...props}
		/>
	);
}
