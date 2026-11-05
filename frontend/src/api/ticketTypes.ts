import { isCalendarDate } from "../utils/dates";
import type { TicketPattern } from "../components/TicketEditor/types";
import { queryInvalidate, queryListUpdateItem, useQueryListItems, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, itemMutation } from "../utils/mutations";
import { queryKey as ticketsKey, queryKeyStats, queryKeyPages } from "./tickets";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";

const url = "/api/ticket_types";
export const queryKey = (id: ItemId) => ["ticket_type", `${id}`];
export const queryKeyLists = () => ["ticket_types"];
export const queryKeyList = (id: ItemId) => [...queryKeyLists(), `${id}`];
export const queryKeyCatalog = (id: ItemId) => ["ticket_catalog", `${id}`];

export function parseTicketType(type: TicketType): TicketType
{
	if (!type || !Array.isArray(type.dayOffsets) || !Array.isArray(type.validDates) || type.validDates.some(date => !isCalendarDate(date)) || !Number.isInteger(type.categoryId) || !(type.quantity === null || Number.isInteger(type.quantity)) || !(type.price === null || typeof type.price == "number")) throw new ApiError("Некорректный ответ вида билета");
	return type;
}
export function parseTicketCatalog(catalog: TicketCatalog): TicketCatalog
{
	if (!catalog || !Array.isArray(catalog.categories)) throw new ApiError("Некорректный ответ каталога");
	for (const category of catalog.categories)
	{
		if (!Array.isArray(category.variants)) throw new ApiError("Некорректный ответ категории");
		for (const variant of category.variants)
		{
			parseTicketType(variant);
			if (typeof variant.deleted != "boolean" || typeof variant.available != "boolean") throw new ApiError("Некорректный ответ вида билета");
		}
	}
	return catalog;
}
const useTypes = itemQuery<TicketType[], TicketType[]>(queryKeyList, id => `/api/events/${id}/ticket_types`, types => types.map(parseTicketType));
export function useTicketTypes(eventId: ItemId)
{
	const query = useTypes(eventId);
	useQueryListItems(query.data, query.dataUpdatedAt, queryKey);
	return query;
}
export const useTicketType = itemQuery<TicketType, TicketType>(queryKey, url, parseTicketType);
export const useTicketCatalog = itemQuery<TicketCatalog, TicketCatalog>(queryKeyCatalog, id => `/api/events/${id}/ticket_categories`, parseTicketCatalog);
export interface CatalogVariant extends TicketType { deleted: boolean; available: boolean; }
export interface TicketCategory { id: number; name: string; variants: CatalogVariant[]; }
export interface TicketCatalog { eventId: number; categories: TicketCategory[]; }
export interface CatalogChanges
{
	categoryChanges: ({ action: "add", clientId: string, name: string } | { action: "update", id: number, name: string } | { action: "delete", id: number })[];
	typeChanges: (
		| { action: "add", name: string, categoryRef: { id: number } | { clientId: string }, dayOffsets: number[], price: number | null, quantity: number | null }
		| { action: "update", id: number, name?: string, price?: number | null, quantity?: number | null }
		| { action: "delete", id: number }
	)[];
}
export function useMutationUpdateCatalog(eventId: ItemId, onSuccess?: () => void)
{
	const client = useQueryClient();
	const useUpdate = stdMutation<CatalogChanges, TicketCatalog, TicketCatalog>(`/api/events/${eventId}/ticket_types`, (client, data, input) =>
	{
		const previous = client.getQueryData<TicketCatalog>(queryKeyCatalog(eventId));
		for (const category of previous?.categories ?? [])
			if (input.categoryChanges.some(change => change.action == "delete" && change.id == category.id))
				for (const variant of category.variants) client.removeQueries({ queryKey: queryKey(variant.id), exact: true });
		client.setQueryData(queryKeyCatalog(eventId), data);
		for (const variant of data.categories.flatMap(category => category.variants))
			if (variant.deleted) client.removeQueries({ queryKey: queryKey(variant.id), exact: true });
		void client.invalidateQueries({ queryKey: ["ticket_type"] });
		return Promise.all([queryKeyList(eventId), ticketsKey(eventId), queryKeyStats(eventId), queryKeyPages(eventId)].map(key => queryInvalidate(client, key, false)));
	}, undefined, parseTicketCatalog);
	return useUpdate(onSuccess, error =>
	{
		if (error instanceof ApiError && error.code == "catalog_outdated")
		{
			void queryInvalidate(client, queryKeyCatalog(eventId));
			void client.invalidateQueries({ queryKey: ["event", String(eventId)], exact: true });
		}
	});
}
export const useMutationUpdateTicketType = itemMutation<UpdateTicketTypeData, TicketType, TicketType>(url, (client, data) =>
{
	client.setQueryData(queryKey(data.id), data);
	void client.invalidateQueries({ queryKey: ["ticket_catalog"] });
	for (const [key, items] of client.getQueriesData<TicketType[]>({ queryKey: queryKeyLists() }))
		if (items?.some(item => item.id == data.id))
			queryListUpdateItem(client, key, data);
}, undefined, parseTicketType);

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
	price: number | null,
	imageId: number | null,
	pattern: TicketPattern | null,
	categoryId: number,
	dayOffsets: number[],
	validDates: string[],
	quantity: number | null,
}
