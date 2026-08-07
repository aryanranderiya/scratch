import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import { type SlashItem, SlashMenuComponent, getSlashItems } from "./SlashMenu";

export const SlashPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
	name: "slashCommand",

	addProseMirrorPlugins() {
		return [
			Suggestion<SlashItem>({
				editor: this.editor,
				char: "/",
				pluginKey: SlashPluginKey,
				startOfLine: true,
				allowedPrefixes: ["\n"],
				items: ({ query }) => {
					const all = getSlashItems();
					const q = query.trim().toLowerCase();
					if (!q) return all;
					return all.filter(
						(item) =>
							item.title.toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q),
					);
				},
				command: ({ editor, range, props }) => {
					props.run(editor, range);
				},
				render: () => {
					let component: ReactRenderer<unknown> | null = null;
					let unmount: (() => void) | null = null;
					return {
						onStart: (props: SuggestionProps<SlashItem>) => {
							component = new ReactRenderer(SlashMenuComponent, {
								props: { ...props, items: props.items },
								editor: props.editor as never,
							});
							unmount = props.mount(component.element);
						},
						onUpdate: (props: SuggestionProps<SlashItem>) => {
							component?.updateProps({ ...props, items: props.items });
						},
						onExit: () => {
							component?.destroy();
							unmount?.();
						},
						onKeyDown: ({ event }: { event: KeyboardEvent }) => {
							if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
								const ref = component?.ref as
									| { onKeyDown: (event: KeyboardEvent) => boolean }
									| undefined;
								if (ref?.onKeyDown) return ref.onKeyDown(event);
							}
							return false;
						},
					};
				},
			}),
		];
	},
});
