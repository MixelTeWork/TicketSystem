import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, type EventData, type ResponseEvent, type ResponseMsg, type EventDataFull } from "./dataTypes";
import { fetchDelete, fetchJsonGet, fetchJsonPost, fetchPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, useQueryListItems } from "../utils/query";

export function parseEventResponse(responseEvent: ResponseEvent)
{
	return { ...responseEvent, date: new Date(responseEvent.date) } as EventData;
}

export function useEvents()
{
	const query = useQuery({ queryKey: ["events"], queryFn: async () =>
	{
		const events = await fetchJsonGet<ResponseEvent[]>("/api/events");
		return events.map(parseEventResponse);
	},
	});
	useQueryListItems(query.data, query.dataUpdatedAt, "event");
	return query;
}

export function useEventsFull()
{
	return useQuery({ queryKey: ["events_full"], queryFn: async () =>
	{
		const events = await fetchJsonGet<ResponseEvent[]>("/api/events_full");
		return events.map(parseEventResponse) as EventDataFull[];
	},
	});
}

export function useEvent(eventId: number | string)
{
	return useQuery({ queryKey: ["event", `${eventId}`], queryFn: async () =>
	{
		const event = await fetchJsonGet<ResponseEvent>("/api/events/" + eventId);
		return parseEventResponse(event);
	},
	});
}

export function useScannerEvent(eventId: number | string)
{
	return useQuery({ queryKey: ["scanner_event", `${eventId}`], queryFn: async () =>
	{
		const res = await fetch("/api/scanner_events/" + eventId);
		const data = await res.json();
		if (!res.ok)
		{
			if (res.status == 403)
				return NaN;
			throw new ApiError((data as ResponseMsg).msg);
		}
		return parseEventResponse(data as ResponseEvent);
	}, retry: 3 });
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
		onSuccess: data =>
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
		onSuccess: data =>
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

export function useMutationGetAccessToEvent()
{
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (eventId: number | string) =>
			await fetchPost(`/api/events/${eventId}/add_access`),
		onSuccess: () =>
		{
			queryInvalidate(queryClient, "events");
			queryInvalidate(queryClient, "events_full");
		},
	});
}
