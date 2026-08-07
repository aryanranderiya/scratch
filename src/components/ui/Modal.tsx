import { Cancel01Icon } from "hugeicons-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
	width?: string;
}

export function Modal({ open, onClose, title, children, width = "max-w-md" }: ModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;

		previouslyFocused.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;

		const focusPanel = () => {
			// Focus the first focusable element inside the panel, else the panel itself.
			const panel = panelRef.current;
			if (!panel) return;
			const focusable = panel.querySelector<HTMLElement>(
				"button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
			);
			(focusable ?? panel).focus();
		};

		const id = window.setTimeout(focusPanel, 0);

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				onClose();
			}
			// Trap Tab inside the panel.
			if (e.key !== "Tab") return;
			const panel = panelRef.current;
			if (!panel) return;
			const focusable = Array.from(
				panel.querySelectorAll<HTMLElement>(
					"button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
				),
			).filter((el) => !el.hasAttribute("disabled"));
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		window.addEventListener("keydown", onKeyDown, true);
		return () => {
			window.clearTimeout(id);
			window.removeEventListener("keydown", onKeyDown, true);
			const prev = previouslyFocused.current;
			if (prev?.isConnected) prev.focus();
		};
	}, [open, onClose]);

	if (!open) return null;
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="absolute inset-0 bg-black/20 backdrop-blur-[4px]" />
			<div
				ref={panelRef}
				className={`relative flex max-h-[calc(100vh-2rem)] w-full flex-col ${width} glass-strong rounded-2xl p-5 shadow-3`}
				style={{ animation: "scale-in 0.15s ease-out" }}
				tabIndex={-1}
			>
				{title && (
					<div className="mb-4 flex shrink-0 items-center justify-between">
						<h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
						<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
							<Cancel01Icon className="h-4 w-4" />
						</Button>
					</div>
				)}
				<div className="min-h-0 overflow-y-auto">{children}</div>
			</div>
			<style>
				{
					"@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }"
				}
			</style>
		</div>
	);
}
