import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback } from "react";
import { openUrl } from "../lib/open";
import { useAppStore } from "../store";
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

	// Markdown only stores the reference (org/repo#number), not the title or
	// CI state. Look the PR up in the live PR cache so cards show the real
	// title and current check status even after the note is re-loaded from
	// disk; fall back to the stored attrs when the PR is no longer open.
	const livePr = useAppStore((s) =>
		s.prGroups.flatMap((g) => g.prs).find((p) => p.id === attrs.id),
	);

	const onSelect = useCallback(() => {
		void openUrl(attrs.url);
	}, [attrs.url]);

	return (
		<NodeViewWrapper
			as="div"
			className="pr-mention-view my-1 w-full"
			contentEditable={false}
		>
			<PrRichCard
				variant="card"
				pr={{
					id: attrs.id,
					repo: attrs.repo,
					org: attrs.org,
					number: attrs.number,
					title: livePr?.title ?? attrs.title,
					url: attrs.url,
					isDraft: livePr?.isDraft ?? attrs.isDraft,
					checkStatus: (livePr?.checkStatus ?? attrs.checkStatus) as never,
				}}
				onSelect={onSelect}
			/>
		</NodeViewWrapper>
	);
}
