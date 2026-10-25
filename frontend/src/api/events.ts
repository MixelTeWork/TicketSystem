import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";
import { type UserData, queryKeyList as usersKey } from "./user";
import { queryKey as ticketsKey, queryKeyStats as ticketStatsKey, queryKeyPages as ticketPagesKey } from "./tickets";
import { queryKeyList as ticketTypesKey } from "./ticketTypes";
import { queryKeyEvent as eventStaffKey } from "./staff";
import { fetchJsonGet } from "../utils/fetch";
import { parseUtcDate } from "../utils/dates";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, useQueryListItems, stdQuery, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, stdMutationNoRes, itemMutation, itemDeleteMutation } from "../utils/mutations";

const url = "/api/events";
export const queryKeyList = () => ["events"];
export const queryKeyFull = () => ["events_full"];
export const queryKey = (id: ItemId) => ["event", `${id}`];
export const queryKeyScanner = (id: ItemId) => ["scanner_event", `${id}`];

export function parseEventResponse<T extends ResponseEvent>(event: T): Omit<T, "date"> & { date: Date }
{
	return { ...event, date: parseUtcDate(event.date) };
}

export function useEvents(options: { staleTime?: number, enabled?: boolean } = {})
{
	const query = useQuery({
		queryKey: queryKeyList(),
		queryFn: async ({ signal }) => (await fetchJsonGet<ResponseEventList[]>(url, signal)).map(parseEventResponse),
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
			try
			{
				const event = parseEventResponse(await fetchJsonGet<ResponseEvent>(`/api/scanner_events/${eventId}`, signal));
				return { status: "active", event } as const;
			}
			catch (error)
			{
				if (error instanceof ApiError && error.status == 403 && error.code == "event_inactive")
					return { status: "inactive" } as const;
				throw error;
			}
		},
		enabled: Number.isInteger(Number(eventId)) && Number(eventId) > 0,
		staleTime: 0,
		refetchOnMount: "always",
	});
}

interface NewEventData { name: string; date: Date | string; }
interface UpdateEventData extends NewEventData { active?: boolean; }
export const useMutationNewEvent = stdMutation<NewEventData, ResponseEvent, EventData>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	queryListAddItem(client, queryKeyList(), { ...data, ticketCount: 0 });
	return queryInvalidate(client, queryKeyFull());
}, undefined, parseEventResponse);
export const useMutationUpdateEvent = itemMutation<UpdateEventData, ResponseEvent, EventData>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	const existing = client.getQueryData<EventListData[]>(queryKeyList())?.find(event => event.id == data.id);
	queryListUpdateItem(client, queryKeyList(), { ...existing, ...data });
	return Promise.all([queryInvalidate(client, queryKeyFull()), queryInvalidate(client, queryKeyScanner(data.id))]);
}, undefined, parseEventResponse);

export function removeEventQueries(client: QueryClient, id: ItemId)
{
	client.removeQueries({ queryKey: ticketPagesKey(id) });
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

export type ResponseEvent = Omit<EventData, "date"> & { date: string };
type ResponseEventList = Omit<EventListData, "date"> & { date: string };

export interface EventData
{
	id: number,
	name: string,
	date: Date,
	active: boolean,
}
export interface EventListData extends EventData
{
	// The scanner-only list omits ticket counts.
	ticketCount?: number;
}
export interface EventDataFull extends EventData
{
	deleted: boolean,
	access: UserData[],
}


export type ResponseEventFull = Omit<EventDataFull, "date"> & { date: string };
