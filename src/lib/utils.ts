import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function uid(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function formatRelative(ts: number): string {
	const diff = Date.now() / 1000 - ts;
	const minutes = Math.floor(diff / 60);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(ts * 1000).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}
