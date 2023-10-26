import { useQuery } from "react-query";
import { Modify, ResponseMsg } from "./dataTypes";
import ApiError from "./apiError";

export function useLog()
{
	return useQuery("log", getLog);
}

async function getLog(): Promise<LogItem[]>
{
	const res = await fetch("/api/debug/log");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return (data as LogItemResponse[]).map(parseLogResponse);
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
