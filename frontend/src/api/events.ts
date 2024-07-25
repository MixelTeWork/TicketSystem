import { useMutation, useQuery, useQueryClient } from "react-query";
import { ApiError, EventData, ResponseEvent, ResponseMsg } from "./dataTypes";
import { fetchDelete, fetchJsonGet, fetchJsonPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate } from "../utils/query";

export function parseEventResponse(responseEvent: ResponseEvent)
{
	const event = responseEvent as unknown as EventData;
	event.date = new Date(responseEvent.date);
	return event;
}

export function useEvents()
{
	const queryClient = useQueryClient();
	return useQuery("events", async () =>
	{
		const events = await fetchJsonGet<ResponseEvent[]>("/api/events");
		return events.map(parseEventResponse);
	}, {
		onSuccess: data =>
			data.forEach(v => queryClient.setQueryData(["event", `${v.id}`], v)),
	});
}

export function useEvent(eventId: number | string)
{
	return useQuery(["event", `${eventId}`], async () =>
	{
		const event = await fetchJsonGet<ResponseEvent>("/api/events/" + eventId);
		return parseEventResponse(event);
	});
}

export function useScannerEvent(eventId: number | string)
{
	return useQuery(["event", `${eventId}`], async () =>
	{
		const res = await fetch("/api/scanner_events/" + eventId);
		const data = await res.json();
		if (!res.ok)
		{
			if (res.status == 403)
				return NaN;
			throw new ApiError((await res.json() as ResponseMsg).msg);
		}
		return parseEventResponse(data as ResponseEvent);
	}, { retry: 3 });
}


export function useMutationNewEvent(onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (eventData: NewEventData) =>
		{
			const event = await fetchJsonPost<ResponseEvent>("/api/events", eventData);
			return parseEventResponse(event);
		},
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["event", `${data.id}`], data);
			queryListAddItem(queryClient, "events", data);
			onSuccess?.();
		},
	});
}

interface NewEventData
{
	name: string,
	date: Date | string,
}

export function useMutationUpdateEvent(eventId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (eventData: NewEventData) =>
		{
			const event = await fetchJsonPost<ResponseEvent>("/api/events/" + eventId, eventData);
			return parseEventResponse(event);
		},
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["event", `${data.id}`], data);
			queryListUpdateItem(queryClient, "events", data);
			onSuccess?.();
		},
	});
}

export function useMutationDeleteEvent(eventId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () =>
			await fetchDelete("/api/events/" + eventId),
		onSuccess: () =>
		{
			queryInvalidate(queryClient, ["event", eventId]);
			queryListDeleteItem(queryClient, "events", eventId);
			onSuccess?.();
		},
	});
}
