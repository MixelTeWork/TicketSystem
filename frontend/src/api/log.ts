import { useQuery, useQueryClient } from "react-query";
import { Modify } from "./dataTypes";
import { fetchJsonGet } from "../utils/fetch";

export function useLog(page = 0)
{
	const queryClient = useQueryClient();
	const fn = async (p: number) =>
		(await fetchJsonGet<LogItemResponse[]>(`/api/debug/log?p=${p}`)).map(parseLogResponse);
	queryClient.prefetchQuery(["log", page - 1], () => fn(page - 1));
	queryClient.prefetchQuery(["log", page + 1], () => fn(page + 1));
	return useQuery(["log", page], () => fn(page));
}

export function useLogCacheClear()
{
	const queryClient = useQueryClient();
	return () =>
	{
		queryClient.removeQueries("log");
		queryClient.invalidateQueries("logLen");
	}
}

export function useLogLen()
{
	return useQuery("logLen", async () =>
		await fetchJsonGet<LogLenResponse>("/api/debug/log_len")
	);
}

export function parseLogResponse(responseLog: LogItemResponse)
{
	const log = responseLog as unknown as LogItem;
	log.date = new Date(responseLog.date);
	return log;
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
}>

export interface LogLenResponse
{
	len: number,
}
