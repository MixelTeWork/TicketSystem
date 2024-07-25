import { useQuery } from "react-query";
import { Modify } from "./dataTypes";
import { fetchJsonGet } from "../utils/fetch";

export function useLog()
{
	return useQuery("log", async () =>
	{
		const log = await fetchJsonGet<LogItemResponse[]>("/api/debug/log");
		return log.map(parseLogResponse);
	});
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
