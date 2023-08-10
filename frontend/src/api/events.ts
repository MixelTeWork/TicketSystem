import { useQuery } from "react-query";
import { EventData, ResponseEvent, ResponseMsg } from "./dataTypes";
import ApiError from "./apiError";

export function useEvents()
{
	return useQuery("events", getEvents);
}

async function getEvents(): Promise<EventData[]>
{
	const res = await fetch("/api/events");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	const events = data as ResponseEvent[];
	return events.map(parseEventResponse);
}

export function useEvent(eventId: number | string)
{
	return useQuery(["event", eventId], () => getEvent(eventId));
}

async function getEvent(eventId: number | string): Promise<EventData>
{
	const res = await fetch("/api/events/" + eventId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return parseEventResponse(data as ResponseEvent);
}

export function useScannerEvent(eventId: number | string)
{
	return useQuery(["event", eventId], () => getScannerEvent(eventId));
}

async function getScannerEvent(eventId: number | string): Promise<EventData | typeof NaN>
{
	const res = await fetch("/api/scanner_event/" + eventId);
	const data = await res.json();
	if (!res.ok) return NaN;
	return parseEventResponse(data as ResponseEvent);
}

export function parseEventResponse(responseEvent: ResponseEvent)
{
	const event = <EventData><unknown>responseEvent;
	event.date = new Date(responseEvent.date);
	return event;
}
