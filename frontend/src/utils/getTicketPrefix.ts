import { padNum } from "./nums";
import { datetimeToInput } from "./dates";

export default function getTicketPrefix(id: number, date: Date)
{
	const day = datetimeToInput(date).slice(0, 10).replaceAll("-", "");
	return `${padNum(id, 3)}-${day.slice(3)}-`;
}
