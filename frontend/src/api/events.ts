import { useMutation, useQuery, useQueryClient } from "react-query";
import { EventData, ResponseEvent, ResponseMsg } from "./dataTypes";
import ApiError from "./apiError";
import fetchPost from "../utils/fetchPost";

export function useEvents()
{
	const queryClient = useQueryClient();
	const query = useQuery("events", getEvents, {
		onSuccess: data =>
		{
			data.forEach(v => queryClient.setQueryData(["event", `${v.id}`], v));
		}
	});
	return query;
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
	return useQuery(["event", `${eventId}`], () => getEvent(eventId));
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
	return useQuery(["event", `${eventId}`], () => getScannerEvent(eventId));
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
	const event = responseEvent as unknown as EventData;
	event.date = new Date(responseEvent.date);
	return event;
}

export function useMutationNewEvent(onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postNewEvent,
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["event", `${data.id}`], () => data);
			if (queryClient.getQueryState("events")?.status == "success")
				queryClient.setQueryData("events", (events?: EventData[]) => events ? [...events, data] : [data]);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postNewEvent(eventData: NewEventData)
{
	const res = await fetchPost("/api/event", eventData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return parseEventResponse(data as ResponseEvent);
}

interface NewEventData
{
	name: string,
	date: Date | string,
}

export function useMutationUpdateEvent(eventId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (eventData: NewEventData) => postUpdateEvent(eventId, eventData),
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["event", `${data.id}`], () => data);
			if (queryClient.getQueryState("events")?.status == "success")
				queryClient.setQueryData("events", (events?: EventData[]) => events ? [...events.filter(v => v.id != data.id), data] : [data]);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postUpdateEvent(eventId: number | string, eventData: NewEventData)
{
	const res = await fetchPost("/api/event/" + eventId, eventData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return parseEventResponse(data as ResponseEvent);
}

interface NewEventData
{
	name: string,
	date: Date | string,
}

