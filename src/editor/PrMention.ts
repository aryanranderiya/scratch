import { type Editor, Node, mergeAttributes } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import type { PrGroup, PrItem } from "../lib/types";
import { useAppStore } from "../store";
import { PrMentionPopup } from "./PrMentionPopup";

export interface PrMentionAttrs {
	id: string;
	repo: string;
	org: string;
	number: number;
	title: string;
	url: string;
}

function allPrs(groups: PrGroup[]): PrItem[] {
	return groups.flatMap((g) => g.prs);
}

function filterPrs(prs: PrItem[], query: string): PrItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return prs;
	return prs.filter(
		(p) =>
			p.title.toLowerCase().includes(q) ||
			p.repo.toLowerCase().includes(q) ||
			p.id.toLowerCase().includes(q) ||
			`${p.number}`.includes(q),
	);
}

export const PrMentionPluginKey = new PluginKey("prMention");

export const PrMention = Node.create({
	name: "prMention",

	group: "inline",
	inline: true,
	selectable: true,
	atom: true,

	addOptions() {
		return {
			suggestion: {
				char: "@",
				pluginKey: PrMentionPluginKey,
				startOfLine: false,
				items: async ({ query }: { query: string }) => {
					const groups = useAppStore.getState().prGroups;
					if (groups.length === 0) {
						await useAppStore.getState().loadPrs();
					}
					const all = allPrs(useAppStore.getState().prGroups);
					return filterPrs(all, query);
				},
				command: ({
					editor,
					range,
					props,
				}: {
					editor: Editor;
					range: { from: number; to: number };
					props: PrItem;
				}) => {
					editor
						.chain()
						.focus()
						.insertContentAt(range, [
							{
								type: this.name,
								attrs: {
									id: props.id,
									repo: props.repo,
									org: props.org,
									number: props.number,
									title: props.title,
									url: props.url,
								},
							},
							{ type: "text", text: " " },
						])
						.run();
				},
				render: () => {
					let component: ReactRenderer<unknown> | null = null;
					let unmount: (() => void) | null = null;

					return {
						onStart: (props: SuggestionProps<PrItem>) => {
							component = new ReactRenderer(PrMentionPopup, {
								props,
								editor: props.editor as never,
							});
							unmount = props.mount(component.element);
						},
						onUpdate: (props: SuggestionProps<PrItem>) => {
							component?.updateProps(props);
						},
						onExit: () => {
							component?.destroy();
							unmount?.();
						},
						onKeyDown: ({ event }: { event: KeyboardEvent }) => {
							if (
								event.key === "ArrowDown" ||
								event.key === "ArrowUp" ||
								event.key === "Enter" ||
								event.key === "Escape"
							) {
								const ref = component?.ref as
									| { onKeyDown: (event: KeyboardEvent) => boolean }
									| undefined;
								if (ref?.onKeyDown) {
									return ref.onKeyDown(event);
								}
							}
							return false;
						},
					};
				},
			},
		};
	},

	addAttributes() {
		const dataAttr = (name: string) => ({
			parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`),
			renderHTML: (attrs: Record<string, unknown>) => {
				if (attrs[name] === null || attrs[name] === undefined) return {};
				return { [`data-${name}`]: String(attrs[name]) };
			},
		});
		return {
			id: { ...dataAttr("id"), default: null },
			repo: { ...dataAttr("repo"), default: null },
			org: { ...dataAttr("org"), default: null },
			number: { ...dataAttr("number"), default: null },
			title: { ...dataAttr("title"), default: null },
			url: { ...dataAttr("url"), default: null },
		};
	},

	parseHTML() {
		return [{ tag: 'span[data-type="prMention"]' }];
	},

	renderHTML({ node, HTMLAttributes }) {
		const attrs = node.attrs as unknown as PrMentionAttrs;
		return [
			"span",
			mergeAttributes({ "data-type": this.name, class: "pr-mention" }, HTMLAttributes),
			["span", { class: "pr-mention-repo" }, `${attrs.repo}#${attrs.number}`],
		];
	},

	addStorage() {
		return {
			markdown: {
				serialize: (
					state: {
						write: (text: string) => void;
						ensureNewLine: () => void;
					},
					node: { attrs: PrMentionAttrs },
				) => {
					state.write(`[@${node.attrs.repo}#${node.attrs.number}](${node.attrs.url})`);
				},
				parse: {
					setup() {},
					updateDOM(element: HTMLElement) {
						for (const a of Array.from(element.querySelectorAll("a"))) {
							const match = a
								.getAttribute("href")
								?.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
							if (!match) continue;
							const [, fullName, number] = match;
							const org = fullName.split("/")[0];
							const text = a.textContent ?? "";
							const id = text.startsWith("@") ? text.slice(1) : `${fullName}#${number}`;
							const span = document.createElement("span");
							span.setAttribute("data-type", "prMention");
							span.setAttribute("data-id", id);
							span.setAttribute("data-repo", fullName);
							span.setAttribute("data-org", org);
							span.setAttribute("data-number", number);
							span.setAttribute("data-title", a.textContent ?? "");
							span.setAttribute("data-url", a.getAttribute("href") ?? "");
							span.textContent = a.textContent;
							a.replaceWith(span);
						}
					},
				},
			},
		};
	},

	addProseMirrorPlugins() {
		return [Suggestion({ ...this.options.suggestion, editor: this.editor })];
	},
});
