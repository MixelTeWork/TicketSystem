import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Modify } from "./dataTypes";
import { fetchJsonGet } from "../utils/fetch";
import { useEffect } from "react";

function logQuery(page: number)
{
	return { queryKey: ["log", page], queryFn: async () =>
		(await fetchJsonGet<LogItemResponse[]>(`/api/debug/log?p=${page}`)).map(parseLogResponse) };
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
		queryClient.removeQueries({ queryKey: ["log"] });
		queryClient.invalidateQueries({ queryKey: ["logLen"] });
	};
}

export function useLogLen()
{
	return useQuery({ queryKey: ["logLen"], queryFn: async () =>
		await fetchJsonGet<LogLenResponse>("/api/debug/log_len"),
	});
}

export function parseLogResponse(responseLog: LogItemResponse)
{
	return { ...responseLog, date: new Date(responseLog.date) } as LogItem;
}

export interface LogItem
{
	id: number,
	actionCode: "added" | "updated" | "deleted" | "restored",
	date: Date,
	recordId: number,
	userId: number,
	userName: string,
	tableName: "User" | "Role" | "Event" | "Ticket" | "TicketType" | "PermissionAccess",
	changes: [string, any, any][],
}

type LogItemResponse = Modify<LogItem, {
	date: string,
}>;

export interface LogLenResponse
{
	len: number,
}
