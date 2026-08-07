import type { Editor } from "@tiptap/react";
import {
	CheckListIcon,
	CodeSquareIcon,
	Link03Icon,
	ListViewIcon,
	QuoteUpIcon,
	TextStrikethroughIcon,
} from "hugeicons-react";
import { cn } from "../lib/utils";

interface ToolbarProps {
	editor: Editor | null;
}

const baseBtn =
	"flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] leading-none transition-colors";

function B({ active, onClick, title }: { active?: boolean; onClick: () => void; title: string }) {
	return (
		<button
			type="button"
			title={title}
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
			className={cn(
				baseBtn,
				active
					? "bg-[var(--accent-soft)] text-[var(--accent)]"
					: "text-[var(--ink-secondary)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]",
			)}
		>
			{title}
		</button>
	);
}

function IconBtn({
	active,
	onClick,
	title,
	children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
	return (
		<button
			type="button"
			title={title}
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
			className={cn(
				baseBtn,
				active
					? "bg-[var(--accent-soft)] text-[var(--accent)]"
					: "text-[var(--ink-secondary)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-[var(--ink)]",
			)}
		>
			{children}
		</button>
	);
}

export function Toolbar({ editor }: ToolbarProps) {
	if (!editor) return null;

	const setLink = () => {
		const prev = editor.getAttributes("link").href as string | undefined;
		const url = window.prompt("Link URL", prev ?? "https://");
		if (url === null) return;
		if (url === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
	};

	const insertChecklist = () => {
		editor
			.chain()
			.focus()
			.insertContent([
				{
					type: "taskList",
					content: [
						{
							type: "taskItem",
							attrs: { checked: false },
							content: [
								{ type: "paragraph", content: [{ type: "text", text: "Tested Autonomously" }] },
							],
						},
						{
							type: "taskItem",
							attrs: { checked: false },
							content: [{ type: "paragraph", content: [{ type: "text", text: "Files Reviewed" }] }],
						},
						{
							type: "taskItem",
							attrs: { checked: false },
							content: [
								{ type: "paragraph", content: [{ type: "text", text: "Manually Tested" }] },
							],
						},
					],
				},
				{ type: "paragraph" },
			])
			.run();
	};

	return (
		<div className="flex w-full items-center gap-[1px] overflow-x-auto">
			<B
				active={editor.isActive("bold")}
				onClick={() => editor.chain().focus().toggleBold().run()}
				title="B"
			/>
			<B
				active={editor.isActive("italic")}
				onClick={() => editor.chain().focus().toggleItalic().run()}
				title="I"
			/>
			<B
				active={editor.isActive("underline")}
				onClick={() => editor.chain().focus().toggleUnderline().run()}
				title="U"
			/>
			<B
				active={editor.isActive("strike")}
				onClick={() => editor.chain().focus().toggleStrike().run()}
				title="S"
			/>
			<div className="mx-0.5 h-3.5 w-px shrink-0 bg-[var(--separator)]" />
			<B
				active={editor.isActive("heading", { level: 1 })}
				onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				title="H1"
			/>
			<B
				active={editor.isActive("heading", { level: 2 })}
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				title="H2"
			/>
			<B
				active={editor.isActive("heading", { level: 3 })}
				onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				title="H3"
			/>
			<div className="mx-0.5 h-3.5 w-px shrink-0 bg-[var(--separator)]" />
			<IconBtn
				active={editor.isActive("bulletList")}
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				title="Bullet list"
			>
				<ListViewIcon className="h-3 w-3" />
			</IconBtn>
			<IconBtn
				active={editor.isActive("orderedList")}
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				title="Numbered list"
			>
				<span className="text-[10px] font-medium">1.</span>
			</IconBtn>
			<IconBtn
				active={editor.isActive("taskList")}
				onClick={() => editor.chain().focus().toggleTaskList().run()}
				title="Task list"
			>
				<CheckListIcon className="h-3 w-3" />
			</IconBtn>
			<IconBtn
				active={editor.isActive("blockquote")}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				title="Quote"
			>
				<QuoteUpIcon className="h-3 w-3" />
			</IconBtn>
			<IconBtn
				active={editor.isActive("codeBlock")}
				onClick={() => editor.chain().focus().toggleCodeBlock().run()}
				title="Code block"
			>
				<CodeSquareIcon className="h-3 w-3" />
			</IconBtn>
			<div className="mx-0.5 h-3.5 w-px shrink-0 bg-[var(--separator)]" />
			<IconBtn onClick={insertChecklist} title="PR checklist">
				<CheckListIcon className="h-3 w-3" />
			</IconBtn>
			<IconBtn active={editor.isActive("link")} onClick={setLink} title="Link">
				<Link03Icon className="h-3 w-3" />
			</IconBtn>
			<IconBtn
				onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
				title="Clear formatting"
			>
				<TextStrikethroughIcon className="h-3 w-3" />
			</IconBtn>
		</div>
	);
}
