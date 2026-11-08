import type { Nodes, PhrasingContent, Root } from "mdast";
import styles from "./styles.module.css";

function textContent(nodes: PhrasingContent[]): string
{
	return nodes.map(node => node.type == "html" ? "" : "value" in node ? node.value : "children" in node ? textContent(node.children) : node.type == "image" ? node.alt || "" : "").join("");
}

export default function remarkCallouts({ idPrefix }: { idPrefix: string })
{
	return function transform(tree: Root)
	{
		let index = 0;
		function visit(node: Nodes)
		{
			if (node.type == "blockquote")
			{
				const paragraph = node.children[0];
				const first = paragraph?.type == "paragraph" ? paragraph.children[0] : undefined;
				const marker = first?.type == "text" ? /^\[!(NOTE|WARNING)\](?=[\t \n]|$)[\t ]*/.exec(first.value) : null;
				if (marker && paragraph.type == "paragraph" && first?.type == "text")
				{
					const title: PhrasingContent[] = [];
					const body: PhrasingContent[] = [];
					let inBody = false;
					const contents = [{ ...first, value: first.value.slice(marker[0].length) }, ...paragraph.children.slice(1)];
					for (const child of contents)
					{
						if (inBody) body.push(child);
						else if (child.type == "break") inBody = true;
						else if (child.type == "text" && child.value.includes("\n"))
						{
							const newline = child.value.indexOf("\n");
							if (newline > 0) title.push({ ...child, value: child.value.slice(0, newline) });
							if (newline < child.value.length - 1) body.push({ ...child, value: child.value.slice(newline + 1) });
							inBody = true;
						}
						else title.push(child);
					}
					const titleId = `${idPrefix}-callout-${index++}`;
					const hasTitle = !!textContent(title).trim();
					const children = node.children.slice(1);
					if (body.length) children.unshift({ ...paragraph, children: body });
					if (hasTitle) children.unshift({ type: "paragraph", children: title, data: { hProperties: { id: titleId, className: [styles.calloutTitle] } } });
					node.children = children;
					node.data = { ...node.data, hName: "aside", hProperties: {
						className: [styles.callout, marker[1] == "NOTE" ? styles.note : styles.warning],
						role: "note",
						...(hasTitle ? { ariaLabelledBy: [titleId] } : {}),
					} };
				}
			}
			if ("children" in node) node.children.forEach(visit);
		}
		visit(tree);
	};
}
