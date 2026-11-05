import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";
import { type UserData, queryKeyList as usersKey } from "./user";
import { queryKey as ticketsKey, queryKeyStats as ticketStatsKey, queryKeyPages as ticketPagesKey } from "./tickets";
import { queryKeyList as ticketTypesKey, queryKeyCatalog } from "./ticketTypes";
import { queryKeyEvent as eventStaffKey } from "./staff";
import { fetchJsonGet } from "../utils/fetch";
import { isCalendarDate, type CalendarDate } from "../utils/dates";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, useQueryListItems, stdQuery, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, stdMutationNoRes, itemMutation, itemDeleteMutation } from "../utils/mutations";

const url = "/api/events";
export const queryKeyList = () => ["events"];
export const queryKeyFull = () => ["events_full"];
export const queryKey = (id: ItemId) => ["event", `${id}`];
export const queryKeyScanner = (id: ItemId) => ["scanner_event", `${id}`];

export function parseEventResponse<T extends EventData>(event: T): T
{
	if (!event || !Number.isInteger(event.id) || typeof event.name != "string" || typeof event.active != "boolean" || !isCalendarDate(event.date) || !isCalendarDate(event.endDate) || !Number.isInteger(event.dayCount) || event.dayCount < 1 || !Array.isArray(event.days) || event.days.some(day => !day || !Number.isInteger(day.id) || !Number.isInteger(day.dayOffset) || day.dayOffset < 0 || !isCalendarDate(day.date)))
		throw new ApiError("Некорректный ответ мероприятия");
	return event;
}

export function useEvents(options: { staleTime?: number, enabled?: boolean } = {})
{
	const query = useQuery({
		queryKey: queryKeyList(),
		queryFn: async ({ signal }) => (await fetchJsonGet<EventListData[]>(url, signal)).map(parseEventResponse),
		...options,
	});
	useQueryListItems(query.data, query.dataUpdatedAt, queryKey);
	return query;
}
export const useEventsFull = stdQuery<EventDataFull[], EventDataFull[]>(queryKeyFull(), "/api/events_full", events => events.map(parseEventResponse));
export const useEvent = itemQuery<EventData, EventData>(queryKey, url, parseEventResponse);

export function useScannerEvent(eventId: ItemId)
{
	return useQuery({
		queryKey: queryKeyScanner(eventId),
		queryFn: async ({ signal }) =>
		{
			try
			{
				const event = parseEventResponse(await fetchJsonGet<EventData>(`/api/scanner_events/${eventId}`, signal));
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

interface NewEventData { name: string; date: CalendarDate; twoDays?: boolean; }
interface UpdateEventData extends NewEventData { active?: boolean; }
export const useMutationNewEvent = stdMutation<NewEventData, EventData, EventData>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	queryListAddItem(client, queryKeyList(), { ...data, ticketCount: 0 });
	return queryInvalidate(client, queryKeyFull());
}, undefined, parseEventResponse);
export const useMutationUpdateEvent = itemMutation<UpdateEventData, EventData, EventData>(url, (client, data) =>
{
	void client.invalidateQueries({ queryKey: ["ticket_type"] });
	client.setQueryData(queryKey(data.id), data);
	const existing = client.getQueryData<EventListData[]>(queryKeyList())?.find(event => event.id == data.id);
	queryListUpdateItem(client, queryKeyList(), { ...existing, ...data });
	return Promise.all([queryKeyFull(), queryKeyScanner(data.id), ticketTypesKey(data.id), queryKeyCatalog(data.id), ticketsKey(data.id), ticketStatsKey(data.id), ticketPagesKey(data.id)].map(key => queryInvalidate(client, key, false)));
}, undefined, parseEventResponse);

export function removeEventQueries(client: QueryClient, id: ItemId)
{
	client.removeQueries({ queryKey: ticketPagesKey(id) });
	for (const key of [queryKey(id), queryKeyScanner(id), ticketsKey(id), ticketStatsKey(id), ticketTypesKey(id), queryKeyCatalog(id), eventStaffKey(id)])
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

export interface EventData
{
	id: number,
	name: string,
	date: CalendarDate,
	active: boolean,
	endDate: CalendarDate,
	dayCount: number,
	days: EventDayData[],
}
export interface EventDayData { id: number; dayOffset: number; date: CalendarDate; }
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
