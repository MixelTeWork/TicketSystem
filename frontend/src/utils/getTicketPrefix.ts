import { padNum } from "./nums";

export default function getTicketPrefix(id: number, date: Date)
{
	return `${padNum(id, 3)}-${date.getFullYear().toString().at(-1)}${padNum(date.getMonth() + 1, 2)}${padNum(date.getDate(), 2)}-`;
}