import { isCalendarDate, parseUtcDate } from "../utils/dates";
import type { EventData } from "./events";
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchJsonPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, stdMutationNoRes } from "../utils/mutations";
import { ApiError } from "./dataTypes";

const url = "/api/tickets";
export const queryKey = (id: ItemId) => ["tickets", `${id}`];
export const queryKeyStats = (id: ItemId) => ["ticket_stats", `${id}`];
export const queryKeyPages = (id: ItemId) => ["ticket_pages", `${id}`];

export interface TicketFilters
{
	search: string;
	typeId: string;
	promocode: string;
	noPromocode: boolean;
	auth: string;
	dateFrom: string;
	dateTo: string;
}
export const emptyTicketFilters: TicketFilters = { search: "", typeId: "", promocode: "", noPromocode: false, auth: "all", dateFrom: "", dateTo: "" };
export interface TicketPage
{
	items: Ticket[];
	total: number;
	count: number;
	page: number;
	pages: number;
	hasAuth: boolean;
	types: { id: number, name: string, deleted: boolean }[];
	promocodes: string[];
}

export function useTicketPage(eventId: ItemId, filters: TicketFilters, page: number, pageSize: string)
{
	return useQuery({
		queryKey: [...queryKeyPages(eventId), filters, page, pageSize],
		queryFn: async ({ signal }) =>
		{
			const body = {
				...filters,
				page,
				pageSize: pageSize == "all" ? "all" : Number(pageSize),
				typeId: filters.typeId ? Number(filters.typeId) : null,
				promocode: filters.promocode || null,
			};
			const data = await fetchJsonPost<Omit<TicketPage, "items"> & { items: ResponseTicket[] }>(`/api/events/${eventId}/tickets/page`, body, signal);
			if (!Array.isArray(data.items) || !Array.isArray(data.types) || data.types.some(type => typeof type.deleted != "boolean")) throw new ApiError("Некорректный ответ списка билетов");
			return { ...data, pageSize, items: data.items.map(parseTicketResponse) };
		},
		enabled: Number.isInteger(Number(eventId)) && Number(eventId) > 0,
		gcTime: 5 * 60 * 1000,
		staleTime: 0,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
	});
}

export function parseTicketResponse(responseTicket: ResponseTicket): Ticket
{
	if (!responseTicket || typeof responseTicket.typeDeleted != "boolean" || !Array.isArray(responseTicket.checkins) || !Array.isArray(responseTicket.dayOffsets) || !Array.isArray(responseTicket.validDates) || responseTicket.dayOffsets.some(day => !Number.isInteger(day) || day < 0) || responseTicket.validDates.some(day => !isCalendarDate(day)) || !(responseTicket.merchIssuedAt === null || typeof responseTicket.merchIssuedAt == "string") || !(responseTicket.merchIssuedById === null || Number.isInteger(responseTicket.merchIssuedById)) || !(responseTicket.merchIssuedBy === null || typeof responseTicket.merchIssuedBy == "string"))
		throw new ApiError("Некорректный ответ билета");
	return { ...responseTicket, createdDate: parseUtcDate(responseTicket.createdDate), checkins: responseTicket.checkins.map(parseCheckinResponse), merchIssuedAt: responseTicket.merchIssuedAt === null ? null : parseUtcDate(responseTicket.merchIssuedAt) };
}
export function parseCheckinResponse(checkin: ResponseCheckin): TicketCheckin
{
	if (!checkin || !Number.isInteger(checkin.eventDayId) || !Number.isInteger(checkin.dayOffset) || !isCalendarDate(checkin.dayDate) || !(checkin.checkedAt === null || typeof checkin.checkedAt == "string") || !(checkin.checkedById === null || Number.isInteger(checkin.checkedById)) || !(checkin.checkedBy === null || typeof checkin.checkedBy == "string"))
		throw new ApiError("Некорректный ответ прохода");
	return { ...checkin, checkedAt: checkin.checkedAt === null ? null : parseUtcDate(checkin.checkedAt) };
}

const useTickets = itemQuery<ResponseTicket[], Ticket[]>(queryKey, id => `/api/events/${id}/tickets`, tickets => tickets.map(parseTicketResponse));
export default useTickets;
export function parseTicketStats(rows: TicketStats[]): TicketStats[]
{
	if (!Array.isArray(rows) || rows.some(row => !row || typeof row.name != "string" || !Number.isInteger(row.categoryId) || typeof row.categoryName != "string" || typeof row.deleted != "boolean" || typeof row.categoryDeleted != "boolean" || !Array.isArray(row.dayOffsets) || !Array.isArray(row.validDates) || !Array.isArray(row.byDay) || !Number.isInteger(row.checkinCount) || !Number.isInteger(row.merchIssued) || row.byDay.some(day => !day || !isCalendarDate(day.date) || !Number.isInteger(day.eligible) || !Number.isInteger(day.checkedIn))))
		throw new ApiError("Некорректный ответ статистики");
	return rows;
}
export const useTicketStats = itemQuery<TicketStats[], TicketStats[]>(queryKeyStats, id => `/api/events/${id}/tickets_stats`, parseTicketStats);

export function updateTicketCache(client: QueryClient, ticket: Ticket)
{
	queryListUpdateItem(client, queryKey(ticket.eventId), ticket);
	return Promise.all([queryInvalidate(client, queryKeyStats(ticket.eventId)), queryInvalidate(client, queryKeyPages(ticket.eventId), false)]);
}
export const useMutationNewTicket = stdMutation<NewTicketData, ResponseTicket, Ticket>(url, (client, data) =>
{
	const key = queryKey(data.eventId);
	if (client.getQueryData<Ticket[]>(key)?.some(ticket => ticket.id == data.id)) queryListUpdateItem(client, key, data);
	else queryListAddItem(client, key, data);
	return Promise.all([queryInvalidate(client, queryKeyStats(data.eventId)), queryInvalidate(client, queryKeyPages(data.eventId), false), queryInvalidate(client, ["events"])]);
}, undefined, parseTicketResponse);
export const useMutationUpdateTicket = stdMutation<UpdateTicketParams, ResponseTicket, Ticket>(params => `${url}/${params.ticketId}`,
	updateTicketCache, params => params.data, parseTicketResponse);
export function useMutationDeleteTicket(eventId: ItemId, onSuccess?: (id: ItemId) => void)
{
	const useDelete = stdMutationNoRes<ItemId>(id => `${url}/${id}`, (client, id) =>
	{
		queryListDeleteItem(client, queryKey(eventId), id);
		return Promise.all([queryInvalidate(client, queryKeyStats(eventId)), queryInvalidate(client, queryKeyPages(eventId), false), queryInvalidate(client, ["events"])]);
	}, () => undefined, "DELETE");
	return useDelete(onSuccess);
}

export interface UpdateTicketData
{
	typeId: number;
	personName: string;
	personLink: string;
	promocode: string;
	price?: number | null;
	allowOverLimit?: boolean;
}
export interface NewTicketData extends UpdateTicketData { eventId: number; code: string; requestId: string; }
interface UpdateTicketParams { ticketId: ItemId; data: UpdateTicketData; }

type ScanResult<TTicket, TCheckin, TSuccessCheckin = TCheckin> =
	| { operation: "entry" | "merch", success: false, errorCode: "notExist", ticket: null, event: null, checkin: null }
	| { operation: "entry" | "merch", success: false, errorCode: "event", ticket: TTicket, event: EventData, checkin: null }
	| { operation: "entry", success: false, errorCode: "date", ticket: TTicket, event: null, checkin: null }
	| { operation: "entry", success: false, errorCode: "scanned", ticket: TTicket, event: null, checkin: TCheckin }
	| { operation: "entry", success: true, errorCode: null, ticket: TTicket, event: null, checkin: TSuccessCheckin }
	| { operation: "merch", success: true, errorCode: null, ticket: TTicket, event: null, checkin: null }
	| { operation: "merch", success: false, errorCode: "merchIssued", ticket: TTicket, event: null, checkin: null };
export type ResponseCheckTicket = ScanResult<ResponseTicket, ResponseCheckin, ResponseCheckin & { checkedAt: string }>;
export type CheckTicketResult = ScanResult<Ticket, TicketCheckin, TicketCheckin & { checkedAt: Date }>;
export type ResponseTicket = Omit<Ticket, "createdDate" | "checkins" | "merchIssuedAt"> & { createdDate: string, checkins: ResponseCheckin[], merchIssuedAt: string | null };
export interface TicketCheckin { eventDayId: number; dayOffset: number; dayDate: string; checkedAt: Date | null; checkedById: number | null; checkedBy: string | null; }
export type ResponseCheckin = Omit<TicketCheckin, "checkedAt"> & { checkedAt: string | null };
export interface Ticket
{
	id: number,
	code: string,
	type: string,
	typeDeleted: boolean,
	typeId: number,
	eventId: number,
	createdDate: Date,
	personName: string | null,
	personLink: string | null,
	promocode: string | null,
	authOnPltf: boolean,
	price: number | null,
	dayOffsets: number[],
	validDates: string[],
	checkins: TicketCheckin[],
	merchIssuedAt: Date | null,
	merchIssuedById: number | null,
	merchIssuedBy: string | null,
}

export interface TicketStats
{
	typeId: number,
	count: number,
	scanned: number,
	authOnPltf: number,
	name: string,
	price: number | null,
	deleted: boolean,
	categoryId: number,
	categoryName: string,
	categoryDeleted: boolean,
	dayOffsets: number[],
	validDates: string[],
	merchIssued: number,
	checkinCount: number,
	byDay: { eventDayId: number, dayOffset: number, date: string, checkedIn: number, eligible: number }[],
}
