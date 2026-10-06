import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Modify } from "./dataTypes";
import { fetchJsonGet } from "../utils/fetch";
import { stdQuery } from "../utils/query";
import { useEffect } from "react";

export const queryKeyAll = () => ["log"];
export const queryKey = (page: number) => [...queryKeyAll(), page];

function logQuery(page: number)
{
	return { queryKey: queryKey(page), queryFn: async ({ signal }: { signal: AbortSignal }) =>
		(await fetchJsonGet<LogItemResponse[]>(`/api/debug/log?p=${page}`, signal)).map(parseLogResponse) };
}

export function useLog(page = 0)
{
	const queryClient = useQueryClient();
	const query = useQuery(logQuery(page));
	useEffect(() =>
	{
		if (page > 0)
			void queryClient.prefetchQuery(logQuery(page - 1));
		void queryClient.prefetchQuery(logQuery(page + 1));
	}, [page, queryClient, query.dataUpdatedAt]);
	return query;
}

export function useLogCacheClear()
{
	const queryClient = useQueryClient();
	return () =>
	{
		queryClient.removeQueries({ queryKey: queryKeyAll() });
		queryClient.invalidateQueries({ queryKey: queryKeyLen() });
	};
}

export const queryKeyLen = () => ["logLen"];
export const useLogLen = stdQuery<LogLenResponse>(queryKeyLen(), "/api/debug/log_len");

export function parseLogResponse(responseLog: LogItemResponse): LogItem
{
	return { ...responseLog, date: new Date(responseLog.date) };
}

export interface LogItem
{
	id: number,
	actionCode: "added" | "updated" | "deleted" | "restored",
	date: Date,
	recordId: number,
	userId: number | null,
	userName: string,
	tableName: "User" | "Role" | "Event" | "Ticket" | "TicketType" | "PermissionAccess",
	changes: [string, unknown, unknown][],
}

type LogItemResponse = Modify<LogItem, {
	date: string,
}>;

export interface LogLenResponse
{
	len: number,
}
