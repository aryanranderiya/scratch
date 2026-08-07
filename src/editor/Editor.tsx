import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Extension } from "@tiptap/core";
import { EditorContent, mergeAttributes, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PlusSignIcon } from "hugeicons-react";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import appIcon from "../assets/icon.png";
import { api } from "../lib/api";
import { useAppStore } from "../store";
import { PrMention } from "./PrMention";
import { SlashCommand } from "./SlashCommand";
import { Toolbar } from "./Toolbar";

// ProseMirror binds select-all to Mod-a (Cmd on macOS), leaving Ctrl+A unbound.
// Map Control-a to the same command so Ctrl+A selects the whole note too.
export const ControlSelectAll = Extension.create({
	name: "controlSelectAll",

	addKeyboardShortcuts() {
		return {
			"Control-a": ({ editor }) => {
				editor.commands.selectAll();
				return true;
			},
		};
	},
});

/** Handle pasting image files: save to the vault and insert into the editor. */
async function handleImagePaste(file: File, editor: TiptapEditor | null) {
	if (!file.type.startsWith("image/")) return;
	try {
		const buf = new Uint8Array(await file.arrayBuffer());
		const ext = file.type.split("/")[1] ?? "png";
		const relPath = await api.saveImage(Array.from(buf), ext);
		editor
			?.chain()
			.focus()
			.setImage({ src: relPath, alt: file.name })
			.run();
	} catch (e) {
		console.error("failed to save pasted image", e);
	}
}

export function Editor() {
	const active = useAppStore((s) => s.active);
	const updateActive = useAppStore((s) => s.updateActive);
	const saveActive = useAppStore((s) => s.saveActive);
	const createNote = useAppStore((s) => s.createNote);
	const collapsed = useAppStore((s) => s.config?.toolbarCollapsed ?? false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const loadedNoteId = useRef<string | null>(null);
	const editorRef = useRef<TiptapEditor | null>(null);

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
			Image.extend({
				renderHTML({ HTMLAttributes }) {
					const { src, ...rest } = HTMLAttributes;
					return [
						"img",
						mergeAttributes(this.options.HTMLAttributes, {
							...rest,
							src: `scratch-asset://${src}`,
						}),
					];
				},
			}).configure({
				inline: false,
				allowBase64: false,
				HTMLAttributes: {
					class: "scratch-image",
				},
			}),
			Placeholder.configure({
				placeholder: "Type / for commands, or @ to link a pull request…",
			}),
			PrMention,
			SlashCommand,
			ControlSelectAll,
			Markdown.configure({
				html: false,
				tightLists: true,
			}),
		],
		content: "",
		autofocus: false,
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: "tiptap min-h-[60vh] focus:outline-none",
			},
			handlePaste: (_view, event) => {
				const items = event.clipboardData?.items;
				if (!items) return false;
				for (const item of Array.from(items)) {
					const file = item.getAsFile();
					if (file?.type.startsWith("image/")) {
						event.preventDefault();
						void handleImagePaste(file, editorRef.current);
						return true;
					}
				}
				return false;
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
		if (!editor) return;
		editorRef.current = editor;
	}, [editor]);

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
				<div className="flex flex-1 flex-col items-center justify-center gap-4">
					<button
						type="button"
						title="New note"
						onClick={() => void createNote()}
						className="flex flex-col items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]"
					>
						<img
							src={appIcon}
							alt="Scratch"
							className="h-12 w-12 rounded-[14px] opacity-70"
							draggable={false}
						/>
						<p className="text-[13px] text-tertiary">No note selected</p>
					</button>
					<button
						type="button"
						title="New note"
						onClick={() => void createNote()}
						className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] active:opacity-90"
					>
						<PlusSignIcon className="h-4 w-4" />
						New note
					</button>
				</div>
			)}
		</div>
	);
}
