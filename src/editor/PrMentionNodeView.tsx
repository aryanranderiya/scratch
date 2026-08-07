import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback } from "react";
import { openUrl } from "../lib/open";
import { PrRichCard } from "./PrRichCard";

/** Renders a prMention node as a full-width card: title on line 1, repo #num on line 2. */
export function PrMentionNodeView({ node }: NodeViewProps) {
	const attrs = node.attrs as unknown as {
		id: string;
		repo: string;
		org: string;
		number: number;
		title: string;
		url: string;
		checkStatus: string | null;
		isDraft: boolean;
	};

	const onSelect = useCallback(() => {
		void openUrl(attrs.url);
	}, [attrs.url]);

	return (
		<NodeViewWrapper
			as="span"
			className="pr-mention-view my-1 block w-full"
			contentEditable={false}
		>
			<PrRichCard
				variant="card"
				pr={{
					id: attrs.id,
					repo: attrs.repo,
					org: attrs.org,
					number: attrs.number,
					title: attrs.title,
					url: attrs.url,
					isDraft: attrs.isDraft,
					checkStatus: attrs.checkStatus as never,
				}}
				onSelect={onSelect}
			/>
		</NodeViewWrapper>
	);
}
