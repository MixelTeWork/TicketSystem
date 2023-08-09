import { useQuery } from "react-query";
import { EventData, ResponseEvent } from "./dataTypes";

export default function useEvents()
{
	return useQuery("events", getEvents);
}

async function getEvents(): Promise<EventData[]>
{
	const res = await fetch("/api/events");
	const data = await res.json();
	const events = data as ResponseEvent[];
	return events.map(e => ({ ...e, date: new Date(e.date) }));
}
