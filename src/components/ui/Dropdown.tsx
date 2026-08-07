import {
	type ReactElement,
	type ReactNode,
	cloneElement,
	isValidElement,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "../../lib/utils";

interface DropdownItem {
	key: string;
	label: string;
	icon?: ReactNode;
	onClick: () => void;
	danger?: boolean;
	separator?: boolean;
}

interface DropdownProps {
	trigger: ReactElement;
	items: DropdownItem[];
	align?: "left" | "right";
	width?: string;
}

export function Dropdown({ trigger, items, align = "right", width = "w-48" }: DropdownProps) {
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

	const triggerEl = isValidElement(trigger)
		? cloneElement(
				trigger as ReactElement<{
					"aria-expanded"?: boolean;
					onClick?: (e: React.MouseEvent) => void;
				}>,
				{
					"aria-expanded": open,
					onClick: (e: React.MouseEvent) => {
						e.stopPropagation();
						setOpen((o) => !o);
					},
				},
			)
		: trigger;

	return (
		<div ref={ref} className="relative">
			{triggerEl}
			{open && (
				<div
					className={cn(
						"glass-strong absolute top-full z-50 mt-1 rounded-xl p-1 shadow-3",
						width,
						align === "right" ? "right-0" : "left-0",
					)}
					style={{ animation: "menu-in 0.12s ease-out" }}
				>
					{items.map((item, i) => (
						<div key={item.key}>
							{item.separator && i > 0 && <div className="mx-2 my-1 h-px bg-[var(--separator)]" />}
							<button
								type="button"
								onClick={() => {
									item.onClick();
									setOpen(false);
								}}
								className={cn(
									"flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
									item.danger
										? "text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]"
										: "text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]",
								)}
							>
								{item.icon && (
									<span className="flex h-4 w-4 items-center justify-center text-[var(--ink-secondary)]">
										{item.icon}
									</span>
								)}
								{item.label}
							</button>
						</div>
					))}
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
