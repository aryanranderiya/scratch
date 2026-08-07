import type { Editor, Range } from "@tiptap/core";
import {
	CheckListIcon,
	CodeSquareIcon,
	HeadingIcon,
	ListViewIcon,
	QuoteUpIcon,
	TextAlignCenterIcon,
	TextAlignLeftIcon,
	TextAlignRightIcon,
} from "hugeicons-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactElement } from "react";
import { cn } from "../lib/utils";

export interface SlashItem {
	title: string;
	description: string;
	icon: ReactElement;
	keywords: string;
	run: (editor: Editor, range: Range) => void;
}

const prChecklistItems = ["Tested Autonomously", "Files Reviewed", "Manually Tested"];

export function getSlashItems(): SlashItem[] {
	return [
		{
			title: "Heading 1",
			description: "Big section heading",
			icon: <HeadingIcon className="h-4 w-4" />,
			keywords: "h1 title heading",
			run: (e, range) => e.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
		},
		{
			title: "Heading 2",
			description: "Medium section heading",
			icon: <HeadingIcon className="h-4 w-4" />,
			keywords: "h2 heading",
			run: (e, range) => e.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
		},
		{
			title: "Heading 3",
			description: "Small section heading",
			icon: <HeadingIcon className="h-4 w-4" />,
			keywords: "h3 heading",
			run: (e, range) => e.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
		},
		{
			title: "Task list",
			description: "Todo list with checkboxes",
			icon: <CheckListIcon className="h-4 w-4" />,
			keywords: "todo checkbox task",
			run: (e, range) => {
				e.chain().focus().deleteRange(range).toggleTaskList().run();
			},
		},
		{
			title: "PR checklist",
			description: "Predefined QA checklist for a pull request",
			icon: <CheckListIcon className="h-4 w-4" />,
			keywords: "pr pull request qa checklist tested reviewed",
			run: (e, range) => {
				e.chain()
					.focus()
					.deleteRange(range)
					.insertContent([
						{
							type: "taskList",
							content: prChecklistItems.map((text) => ({
								type: "taskItem",
								attrs: { checked: false },
								content: [{ type: "paragraph", content: [{ type: "text", text }] }],
							})),
						},
						{ type: "paragraph" },
					])
					.run();
			},
		},
		{
			title: "Bullet list",
			description: "Simple bullet points",
			icon: <ListViewIcon className="h-4 w-4" />,
			keywords: "bullet ul list",
			run: (e, range) => e.chain().focus().deleteRange(range).toggleBulletList().run(),
		},
		{
			title: "Quote",
			description: "Quote text",
			icon: <QuoteUpIcon className="h-4 w-4" />,
			keywords: "quote blockquote",
			run: (e, range) => e.chain().focus().deleteRange(range).toggleBlockquote().run(),
		},
		{
			title: "Code block",
			description: "Code with syntax highlighting",
			icon: <CodeSquareIcon className="h-4 w-4" />,
			keywords: "code block",
			run: (e, range) => e.chain().focus().deleteRange(range).toggleCodeBlock().run(),
		},
		{
			title: "Align left",
			description: "Align text left",
			icon: <TextAlignLeftIcon className="h-4 w-4" />,
			keywords: "align left",
			run: (e, range) => e.chain().focus().deleteRange(range).setTextAlign("left").run(),
		},
		{
			title: "Align center",
			description: "Center text",
			icon: <TextAlignCenterIcon className="h-4 w-4" />,
			keywords: "align center",
			run: (e, range) => e.chain().focus().deleteRange(range).setTextAlign("center").run(),
		},
		{
			title: "Align right",
			description: "Align text right",
			icon: <TextAlignRightIcon className="h-4 w-4" />,
			keywords: "align right",
			run: (e, range) => e.chain().focus().deleteRange(range).setTextAlign("right").run(),
		},
		{
			title: "Link a pull request",
			description: "Type @ to search and link a PR",
			icon: <QuoteUpIcon className="h-4 w-4" />,
			keywords: "pr pull request link github",
			run: (e, range) => {
				e.chain().focus().deleteRange(range).insertContent("@").run();
			},
		},
	];
}

interface SlashMenuHandle {
	onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
	items: SlashItem[];
	command: (item: SlashItem) => void;
	query: string;
}

export const SlashMenuComponent = forwardRef<SlashMenuHandle, SlashMenuProps>(
	function SlashMenuComponent({ items, command, query }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const listRef = useRef<HTMLDivElement>(null);

		useEffect(() => {
			setSelectedIndex((i) => Math.min(i, Math.max(items.length - 1, 0)));
		}, [items.length]);

		useEffect(() => {
			const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
			el?.scrollIntoView({ block: "nearest" });
		}, [selectedIndex]);

		useImperativeHandle(ref, () => ({
			onKeyDown: (event: KeyboardEvent) => {
				if (event.key === "ArrowDown") {
					setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
					return true;
				}
				if (event.key === "ArrowUp") {
					setSelectedIndex((i) => Math.max(i - 1, 0));
					return true;
				}
				if (event.key === "Enter") {
					const item = items[selectedIndex];
					if (item) {
						command(item);
						return true;
					}
					return false;
				}
				if (event.key === "Escape") {
					return true;
				}
				return false;
			},
		}));

		if (items.length === 0) {
			return (
				<div className="rounded-xl bg-[var(--surface-raised)] px-4 py-3 shadow-2">
					<span className="text-[13px] text-secondary">No commands match "{query}"</span>
				</div>
			);
		}

		return (
			<div
				ref={listRef}
				data-scratch-popup="slash"
				className="max-h-80 w-64 overflow-y-auto rounded-xl bg-[var(--surface-raised)] p-1.5 shadow-2"
			>
				{items.map((item, idx) => (
					<button
						key={item.title}
						type="button"
						data-index={idx}
						onMouseEnter={() => setSelectedIndex(idx)}
						onMouseDown={(e) => {
							e.preventDefault();
							command(item);
						}}
						className={cn(
							"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
							idx === selectedIndex && "bg-[var(--surface-muted)]",
						)}
					>
						<span
							className={cn(
								"flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
								idx === selectedIndex
									? "bg-[var(--accent-soft)] text-[var(--accent)]"
									: "bg-[var(--surface-muted)] text-[var(--ink-secondary)]",
							)}
						>
							{item.icon}
						</span>
						<div className="min-w-0">
							<div className="truncate text-[13px] font-medium text-[var(--ink)]">{item.title}</div>
							<div className="truncate text-[11px] text-tertiary">{item.description}</div>
						</div>
					</button>
				))}
			</div>
		);
	},
);
