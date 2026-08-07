import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowUp01Icon } from "hugeicons-react";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { Logo } from "../components/Logo";
import { openUrl } from "../lib/open";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";
import { PrMention } from "./PrMention";
import { SlashCommand } from "./SlashCommand";
import { Toolbar } from "./Toolbar";

export function Editor() {
	const active = useAppStore((s) => s.active);
	const updateActive = useAppStore((s) => s.updateActive);
	const saveActive = useAppStore((s) => s.saveActive);
	const collapsed = useAppStore((s) => s.config?.toolbarCollapsed ?? false);
	const persistToolbarCollapsed = useAppStore((s) => s.persistToolbarCollapsed);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const loadedNoteId = useRef<string | null>(null);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
			}),
			Underline,
			TaskList,
			TaskItem.configure({ nested: true }),
			Link.configure({
				openOnClick: false,
				autolink: true,
				HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
			}),
			TextAlign.configure({
				types: ["heading", "paragraph"],
			}),
			Placeholder.configure({
				placeholder: "Type / for commands, or @ to link a pull request…",
			}),
			PrMention,
			SlashCommand,
			Markdown.configure({
				html: false,
				tightLists: true,
			}),
		],
		content: "",
		autofocus: false,
		editorProps: {
			attributes: {
				class: "tiptap min-h-[60vh] focus:outline-none",
			},
		},
		onUpdate: ({ editor }) => {
			const md = (
				editor.storage as unknown as {
					markdown: { getMarkdown: () => string };
				}
			).markdown.getMarkdown();
			updateActive({ content: md });

			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				void saveActive();
			}, 800);
		},
	});

	useEffect(() => {
		if (!editor || !active) return;
		if (loadedNoteId.current !== active.id) {
			loadedNoteId.current = active.id;
			editor.commands.setContent(active.content);
			editor.commands.focus("end");
		}
	}, [active, editor]);

	// When the settings modal closes, hand focus back to the editor so typing
	// resumes naturally instead of landing on a removed DOM node.
	const settingsOpen = useAppStore((s) => s.settingsOpen);
	const prevSettingsOpen = useRef(settingsOpen);
	useEffect(() => {
		if (prevSettingsOpen.current && !settingsOpen && active) {
			editor?.commands.focus();
		}
		prevSettingsOpen.current = settingsOpen;
	}, [settingsOpen, editor, active]);

	useEffect(() => {
		if (!editor) return;
		const onClick = (event: MouseEvent) => {
			const target = (event.target as HTMLElement).closest(".pr-mention");
			if (!target) return;
			const url = target.getAttribute("data-url");
			if (url) void openUrl(url);
		};
		editor.view.dom.addEventListener("click", onClick);
		return () => editor.view.dom.removeEventListener("click", onClick);
	}, [editor]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	return (
		<div className="flex h-full flex-col">
			{!collapsed && (
				<div className="flex h-9 shrink-0 items-center border-b border-[var(--separator)] px-2">
					<Toolbar editor={editor} />
				</div>
			)}
			{active ? (
				<div className="flex-1 overflow-y-auto">
					<EditorContent editor={editor} className="px-5 py-4" />
				</div>
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-3">
					<Logo size={28} className="opacity-40" />
					<p className="text-[13px] text-tertiary">No note selected</p>
				</div>
			)}
			<button
				type="button"
				title={collapsed ? "Show formatting toolbar" : "Hide formatting toolbar"}
				onClick={() => void persistToolbarCollapsed(!collapsed)}
				className="flex h-6 shrink-0 items-center justify-center gap-1 self-end border-t border-[var(--separator)] px-2 text-tertiary transition-colors hover:text-[var(--ink-secondary)]"
			>
				<ArrowUp01Icon className={cn("h-3 w-3", collapsed && "rotate-180")} />
			</button>
		</div>
	);
}
