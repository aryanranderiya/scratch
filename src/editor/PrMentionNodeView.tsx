import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback } from "react";
import { openUrl } from "../lib/open";
import { PrRichCard } from "./PrRichCard";

/** Renders a prMention node as the same rich chip used in the @ picker. */
export function PrMentionNodeView({ node }: NodeViewProps) {
	const attrs = node.attrs as unknown as {
		id: string;
		repo: string;
		org: string;
		number: number;
		title: string;
		url: string;
		checkStatus: string | null;
	};

	const onSelect = useCallback(() => {
		void openUrl(attrs.url);
	}, [attrs.url]);

	return (
		<NodeViewWrapper as="span" className="pr-mention-view" contentEditable={false}>
			<PrRichCard
				variant="chip"
				pr={{
					id: attrs.id,
					repo: attrs.repo,
					org: attrs.org,
					number: attrs.number,
					title: attrs.title,
					url: attrs.url,
					isDraft: false,
					checkStatus: attrs.checkStatus as never,
				}}
				onSelect={onSelect}
			/>
		</NodeViewWrapper>
	);
}
