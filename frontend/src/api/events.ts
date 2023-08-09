import { useQuery } from "react-query";
import { EventData, ResponseEvent, ResponseMsg } from "./dataTypes";
import ApiError from "./apiError";

export default function useEvents()
{
	return useQuery("events", getEvents);
}

async function getEvents(): Promise<EventData[]>
{
	const res = await fetch("/api/events");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	const events = data as ResponseEvent[];
	return events.map(e => ({ ...e, date: new Date(e.date) }));
}
