import { useEffect } from "react"

export function useTitle(title: string | (string | undefined | null | false)[], prefis = "Билетная система")
{
	useEffect(() =>
	{
		const prevTitle = document.title;
		if (typeof title != "object") title = [title];
		document.title = [prefis, ...title].filter(v => !!v).join(" | ");
		return () => { document.title = prevTitle; }
	}, [title]);
}
