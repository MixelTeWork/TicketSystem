import { useEffect } from "react";

export function useTitle(title: string | (string | undefined | null | false)[], prefix = "Билетная система")
{
	const nextTitle = [prefix, ...(typeof title == "string" ? [title] : title)].filter(Boolean).join(" | ");
	useEffect(() =>
	{
		const prevTitle = document.title;
		document.title = nextTitle;
		return () => { document.title = prevTitle; };
	}, [nextTitle]);
}
