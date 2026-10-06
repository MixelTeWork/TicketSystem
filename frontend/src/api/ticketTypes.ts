import type { TicketPattern } from "../components/TicketEditor/editor";
import { queryInvalidate, queryListUpdateItem, useQueryListItems, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, itemMutation } from "../utils/mutations";
import { queryKey as ticketsKey, queryKeyStats } from "./tickets";

const url = "/api/ticket_types";
export const queryKey = (id: ItemId) => ["ticket_type", `${id}`];
export const queryKeyLists = () => ["ticket_types"];
export const queryKeyList = (id: ItemId) => [...queryKeyLists(), `${id}`];

export interface UpdateTicketTypesData
{
	name: string;
	price?: number | null;
	id?: number;
	action: "add" | "update" | "delete";
}
const useTypes = itemQuery<TicketType[]>(queryKeyList, id => `/api/events/${id}/ticket_types`);
export function useTicketTypes(eventId: ItemId)
{
	const query = useTypes(eventId);
	useQueryListItems(query.data, query.dataUpdatedAt, queryKey);
	return query;
}
export const useTicketType = itemQuery<TicketType>(queryKey, url);
export function useMutationUpdateTicketTypes(eventId: ItemId, onSuccess?: (types: TicketType[]) => void)
{
	const useUpdate = stdMutation<UpdateTicketTypesData[], TicketType[]>(`/api/events/${eventId}/ticket_types`, (client, data, input) =>
	{
		for (const change of input)
			if (change.action == "delete" && change.id != null)
				client.removeQueries({ queryKey: queryKey(change.id), exact: true });
		client.setQueryData(queryKeyList(eventId), data);
		data.forEach(type => client.setQueryData(queryKey(type.id), type));
		if (input.some(change => change.action != "add"))
			return Promise.all([queryInvalidate(client, ticketsKey(eventId)), queryInvalidate(client, queryKeyStats(eventId))]);
	});
	return useUpdate(onSuccess);
}
export const useMutationUpdateTicketType = itemMutation<UpdateTicketTypeData, TicketType>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	for (const [key, items] of client.getQueriesData<TicketType[]>({ queryKey: queryKeyLists() }))
		if (items?.some(item => item.id == data.id))
			queryListUpdateItem(client, key, data);
});

export interface UpdateTicketTypeData
{
	img: ImgData | null,
	pattern: TicketPattern,
}

export interface ImgData
{
	data: string,
	name: string,
	accessEventId: number,
}

export interface TicketType
{
	id: number,
	name: string,
	price?: number | null,
	imageId: number | null,
	pattern: TicketPattern | null,
}
