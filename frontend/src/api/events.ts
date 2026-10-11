import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";
import { type UserData, queryKeyList as usersKey } from "./user";
import { queryKey as ticketsKey, queryKeyStats as ticketStatsKey } from "./tickets";
import { queryKeyList as ticketTypesKey } from "./ticketTypes";
import { queryKeyEvent as eventStaffKey } from "./staff";
import { fetchJsonGet } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, useQueryListItems, stdQuery, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, stdMutationNoRes, itemMutation, itemDeleteMutation } from "../utils/mutations";

const url = "/api/events";
export const queryKeyList = () => ["events"];
export const queryKeyFull = () => ["events_full"];
export const queryKey = (id: ItemId) => ["event", `${id}`];
export const queryKeyScanner = (id: ItemId) => ["scanner_event", `${id}`];

export function parseEventResponse<T extends ResponseEvent>(event: T): Omit<T, "date"> & { date: Date }
{
	return { ...event, date: new Date(event.date) };
}

export function useEvents(options: { staleTime?: number } = {})
{
	const query = useQuery({
		queryKey: queryKeyList(),
		queryFn: async ({ signal }) => (await fetchJsonGet<ResponseEvent[]>(url, signal)).map(parseEventResponse),
		...options,
	});
	useQueryListItems(query.data, query.dataUpdatedAt, queryKey);
	return query;
}
export const useEventsFull = stdQuery<ResponseEventFull[], EventDataFull[]>(queryKeyFull(), "/api/events_full", events => events.map(parseEventResponse));
export const useEvent = itemQuery<ResponseEvent, EventData>(queryKey, url, parseEventResponse);

export function useScannerEvent(eventId: ItemId)
{
	return useQuery({
		queryKey: queryKeyScanner(eventId),
		queryFn: async ({ signal }) =>
		{
			try { return parseEventResponse(await fetchJsonGet<ResponseEvent>(`/api/scanner_events/${eventId}`, signal)); }
			catch (error)
			{
				if (error instanceof ApiError && error.status == 403 && error.message == "Event is not active") return NaN;
				throw error;
			}
		},
		enabled: Number.isInteger(Number(eventId)) && Number(eventId) > 0,
		staleTime: 0,
		refetchOnMount: "always",
	});
}

interface NewEventData { name: string; date: Date | string; }
export const useMutationNewEvent = stdMutation<NewEventData, ResponseEvent, EventData>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	queryListAddItem(client, queryKeyList(), data);
	return queryInvalidate(client, queryKeyFull());
}, undefined, parseEventResponse);
export const useMutationUpdateEvent = itemMutation<NewEventData, ResponseEvent, EventData>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	queryListUpdateItem(client, queryKeyList(), data);
	return Promise.all([queryInvalidate(client, queryKeyFull()), queryInvalidate(client, queryKeyScanner(data.id))]);
}, undefined, parseEventResponse);

export function removeEventQueries(client: QueryClient, id: ItemId)
{
	for (const key of [queryKey(id), queryKeyScanner(id), ticketsKey(id), ticketStatsKey(id), ticketTypesKey(id), eventStaffKey(id)])
		client.removeQueries({ queryKey: key, exact: true });
}
export const useMutationDeleteEvent = itemDeleteMutation(url, (client, id) =>
{
	queryListDeleteItem(client, queryKeyList(), id);
	removeEventQueries(client, id);
	return queryInvalidate(client, queryKeyFull());
});
export const useMutationGetAccessToEvent = stdMutationNoRes<ItemId>(id => `${url}/${id}/add_access`, client =>
	Promise.all([queryInvalidate(client, queryKeyList()), queryInvalidate(client, queryKeyFull()), queryInvalidate(client, usersKey())]), () => undefined);

export interface ResponseEvent
{
	id: number,
	name: string,
	date: string,
}

export interface EventData
{
	id: number,
	name: string,
	date: Date,
}
export interface EventDataFull
{
	id: number,
	deleted: boolean,
	name: string,
	date: Date,
	active: boolean,
	access: UserData[],
}


export type ResponseEventFull = Omit<EventDataFull, "date"> & { date: string };
