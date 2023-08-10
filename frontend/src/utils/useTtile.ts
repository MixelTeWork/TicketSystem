import { useEffect } from "react"

export function useTitle(title: string | (string | undefined | null | false)[], prefis = "Билетная система")
{
	useEffect(() =>
	{
		const prevTitle = document.title;
		const t = typeof title != "object" ? [title] : title;
		document.title = [prefis, ...t].filter(v => !!v).join(" | ");
		return () => { document.title = prevTitle; }
	}, [title, prefis]);
}
