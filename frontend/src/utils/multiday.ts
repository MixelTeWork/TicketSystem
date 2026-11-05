import type { EventData } from "../api/events";
import { isCalendarDate } from "./dates";

const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function calendarDayLabel(date: string)
{
	const [, month, day] = date.split("-");
	return `${Number(day)} ${months[Number(month) - 1]}`;
}

export function eventEndDate(date: string, twoDays: boolean): string | null
{
	if (!isCalendarDate(date)) return null;
	if (!twoDays) return date;
	const end = new Date(`${date}T00:00:00Z`);
	end.setUTCDate(end.getUTCDate() + 1);
	const result = end.toISOString().slice(0, 10);
	return isCalendarDate(result) ? result : null;
}

export function calendarDate(date: string, full = false)
{
	const [year, month, day] = date.split("-");
	return full ? `${day}.${month}.${year}` : `${month}.${day}`;
}
export function eventDateRange(event: EventData)
{
	const start = calendarDate(event.date, true);
	return event.dayCount > 1 ? `${start} – ${calendarDate(event.endDate, true)}` : start;
}
