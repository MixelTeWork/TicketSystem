import { stdMutation } from "../utils/mutations";
import { parseUtcDate } from "../utils/dates";
import { queryInvalidate, stdQuery } from "../utils/query";

const queryKey = ["bugReports"];

export const useReportBug = stdMutation<{ description: string, page: string }, { id: number }>("/api/bug_reports", client =>
{
	void queryInvalidate(client, queryKey, false);
});

export function useBugReports(page: number)
{
	const usePage = stdQuery([...queryKey, page], `/api/bug_reports?p=${page}`, (response: BugReportList) =>
		({ ...response, items: response.items.map(item => ({ ...item, createdAt: parseUtcDate(item.createdAt) })) }));
	return usePage({ staleTime: 0 });
}

interface BugReportList
{
	items: {
		id: number,
		userId: number,
		userName: string,
		userLogin: string,
		description: string,
		page: string,
		userAgent: string,
		createdAt: string,
	}[],
	total: number,
	pages: number,
}
