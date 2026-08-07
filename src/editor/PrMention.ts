import { type Editor, Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import type { PrGroup, PrItem } from "../lib/types";
import { useAppStore } from "../store";
import { PrMentionNodeView } from "./PrMentionNodeView";
import { PrMentionPopup } from "./PrMentionPopup";

export interface PrMentionAttrs {
	id: string;
	repo: string;
	org: string;
	number: number;
	title: string;
	url: string;
	checkStatus: string | null;
	isDraft: boolean;
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

	group: "block",
	selectable: true,
	atom: true,
	draggable: true,

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
					// Insert the mention as its own block so the card renders
					// full-width and the caret can sit below it (Notion-style).
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
									checkStatus: props.checkStatus,
									isDraft: props.isDraft,
								},
							},
							{ type: "paragraph" },
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
			checkStatus: { ...dataAttr("check-status"), default: null },
			isDraft: {
				...dataAttr("is-draft"),
				default: false,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-is-draft") === "true",
				renderHTML: (attrs: Record<string, unknown>) => {
					if (!attrs.isDraft) return {};
					return { "data-is-draft": "true" };
				},
			},
		};
	},

	parseHTML() {
		return [{ tag: 'span[data-type="prMention"]' }];
	},

	addNodeView() {
		return ReactNodeViewRenderer(PrMentionNodeView);
	},

	addStorage() {
		return {
			markdown: {
				serialize: (
					state: {
						write: (text: string) => void;
						closeBlock: (node: unknown) => void;
					},
					node: { attrs: PrMentionAttrs },
				) => {
					state.write(`[@${node.attrs.repo}#${node.attrs.number}](${node.attrs.url})`);
					state.closeBlock(node);
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
							span.setAttribute("data-check-status", "success");
							span.setAttribute("data-is-draft", "false");
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
