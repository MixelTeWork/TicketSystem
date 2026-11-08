import { useId } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import remarkCallouts from "./callouts";
import styles from "./styles.module.css";

function helpUrl(url: string, key: string, articleId: string)
{
	if ([...url].some(character => character <= " " || character == "\u007f" || character == "\\")) return undefined;
	if (key == "src")
	{
		const asset = /^assets\/([a-zA-Z0-9][a-zA-Z0-9_.-]{0,100})$/.exec(url);
		return asset && !asset[1].includes("..") ? `/api/help/articles/${encodeURIComponent(articleId)}/assets/${encodeURIComponent(asset[1])}` : undefined;
	}
	const safe = defaultUrlTransform(url);
	if (/^(?:https?:|mailto:)/i.test(safe) || safe.startsWith("#") || safe.startsWith("/") && !safe.startsWith("//")) return safe;
	return undefined;
}

export default function HelpMarkdown({ markdown, articleId }: { markdown: string; articleId: string })
{
	const idPrefix = useId();
	return <div className={styles.markdown}><Markdown
		skipHtml
		remarkPlugins={[remarkGfm, [remarkCallouts, { idPrefix }]]}
		urlTransform={(url, key) => helpUrl(url, key, articleId)}
		components={{
			a: ({ href, children, title, id, role, ...props }) =>
			{
				if (!href) return <span>{children}</span>;
				if (href.startsWith("/")) return <Link to={href} title={title}>{children}</Link>;
				return <a href={href} title={title} id={id} role={role} aria-label={props["aria-label"]} aria-describedby={props["aria-describedby"]} target={/^https?:/i.test(href) ? "_blank" : undefined} rel="noopener noreferrer">{children}</a>;
			},
			img: ({ src, alt, title }) => src ? <img src={src} alt={alt || ""} title={title} loading="lazy" decoding="async" /> : <span>{alt}</span>,
		}}
	>{markdown}</Markdown></div>;
}
