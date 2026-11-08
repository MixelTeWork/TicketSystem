import { useQuery, useQueryClient } from "@tanstack/react-query";
import useUser from "./user";
import { useSessionVersion } from "./session";
import { fetchJsonGet, fetchJsonPost } from "../utils/fetch";
import { useSessionMutation } from "../utils/useSessionMutation";

export type HelpAudience = "organizers" | "staff";
export interface HelpArticleSummary
{
	id: string;
	title: string;
	audience: HelpAudience;
	section: string;
	order: number;
}
export interface HelpCatalog
{
	sections: { id: string; title: string }[];
	articles: HelpArticleSummary[];
	audiences: HelpAudience[];
}
export interface HelpArticle extends HelpArticleSummary { markdown: string; }
export interface HelpSearchResult { items: (HelpArticleSummary & { snippet: string })[]; total: number; }
export interface ReleaseItem
{
	id: string;
	audience: HelpAudience;
	title: string;
	text: string;
	articleId: string | null;
}
export interface HelpRelease
{
	id: string;
	title: string;
	version: string | null;
	date: string | null;
	approximateDate: boolean;
	status: "historical" | "upcoming" | "published";
	items: ReleaseItem[];
}
export interface HelpNotice extends ReleaseItem { releaseId: string; }
export interface HelpNotices { items: HelpNotice[]; sessionId: string; }

export const audienceName = (audience: HelpAudience) => audience == "organizers" ? "Для организаторов" : "Для сотрудников";

function useHelpQuery<T>(name: string, url: string, enabled = true)
{
	const version = useSessionVersion();
	const user = useUser();
	const query = useQuery({
		queryKey: ["help", version, name],
		queryFn: ({ signal }) => fetchJsonGet<T>(url, signal),
		enabled: enabled && user.data?.auth === true,
		staleTime: 0,
		refetchOnWindowFocus: false,
	});
	// A failed access recheck must not leave previously authorized text visible.
	return { ...query, data: query.isSuccess && !query.isFetching ? query.data : undefined };
}

export function useHelpCatalog() { return useHelpQuery<HelpCatalog>("catalog", "/api/help"); }
export function useHelpArticle(id: string) { return useHelpQuery<HelpArticle>(`article:${id}`, `/api/help/articles/${encodeURIComponent(id)}`); }
export function useHelpReleases() { return useHelpQuery<HelpRelease[]>("releases", "/api/help/releases"); }
export function useHelpNotices(enabled: boolean) { return useHelpQuery<HelpNotices>("notices", "/api/help/notices", enabled); }

export function useHelpSearch()
{
	return useSessionMutation<HelpSearchResult, string>({
		mutationFn: query => fetchJsonGet<HelpSearchResult>(`/api/help/search?q=${encodeURIComponent(query)}`),
	});
}

export function useAcknowledgeNotices(onSuccess: () => void)
{
	const client = useQueryClient();
	const version = useSessionVersion();
	return useSessionMutation<unknown, string[]>({
		mutationFn: noticeIds => fetchJsonPost("/api/help/notices/acknowledge", { noticeIds }),
		onSuccess: async () =>
		{
			onSuccess();
			await client.invalidateQueries({ queryKey: ["help", version, "notices"] });
		},
	});
}
