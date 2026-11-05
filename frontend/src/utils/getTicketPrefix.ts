import { padNum } from "./nums";
import type { CalendarDate } from "./dates";

export default function getTicketPrefix(id: number, date: CalendarDate)
{
	const day = date.replaceAll("-", "");
	return `${padNum(id, 3)}-${day.slice(3)}-`;
}

export function getCommonTicketPrefix(codes: string[])
{
	if (!codes.length) return "";
	const pattern = /^([0-9]{3,}-[0-9]{5}-)[0-9]{2}-[0-9]{2,}-[0-9]{4,}$/;
	const prefix = pattern.exec(codes[0])?.[1];
	return prefix && codes.every(code => pattern.exec(code)?.[1] == prefix) ? prefix : "";
}
