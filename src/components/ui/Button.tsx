import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "icon";
	children?: ReactNode;
}

export function Button({
	variant = "secondary",
	size = "md",
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-100",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-opacity-40",
				"disabled:opacity-40 disabled:pointer-events-none select-none",
				size === "sm" && "h-7 px-2.5 text-[13px]",
				size === "md" && "h-9 px-3.5 text-[13px]",
				size === "icon" && "h-7 w-7",
				variant === "primary" &&
					"bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:opacity-90",
				variant === "secondary" &&
					"bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--surface-hover)] active:opacity-80",
				variant === "ghost" &&
					"bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] active:opacity-80",
				variant === "danger" &&
					"bg-[var(--surface-muted)] text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] active:opacity-80",
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}
