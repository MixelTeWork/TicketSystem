import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImgData, TicketType } from "./dataTypes";
import type { TicketPattern } from "../components/TicketEditor/editor";
import { fetchJsonGet, fetchJsonPost } from "../utils/fetch";
import { queryInvalidate, useQueryListItems } from "../utils/query";

export function useTicketTypes(eventId: number | string)
{
	const query = useQuery({ queryKey: ["ticket_types", `${eventId}`], queryFn: async () =>
		await fetchJsonGet<TicketType[]>(`/api/events/${eventId}/ticket_types`),
	});
	useQueryListItems(query.data, query.dataUpdatedAt, "ticket_type");
	return query;
}

export function useMutationUpdateTicketTypes(eventId: number | string, onSuccess?: (ticket: TicketType[]) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (data: UpdateTicketTypesData[]) =>
			await fetchJsonPost<TicketType[]>(`/api/events/${eventId}/ticket_types`, data),
		onSuccess: (data, inp) =>
		{
			const someTypeChanged = inp.some(v => v.action == "delete" || v.action == "update");
			if (someTypeChanged)
				queryInvalidate(queryClient, ["tickets", `${eventId}`]);
			queryClient.setQueryData(["ticket_types", `${eventId}`], data);
			data.forEach(v => queryClient.setQueryData(["ticket_type", `${v.id}`], v));
			onSuccess?.(data);
		},
	});
	return mutation;
}

export interface UpdateTicketTypesData
{
	name: string,
	price?: number,
	id?: number,
	action: "add" | "update" | "delete",
}


export function useTicketType(typeId: number)
{
	return useQuery({ queryKey: ["ticket_type", `${typeId}`], queryFn: async () =>
		await fetchJsonGet<TicketType>("/api/ticket_types/" + typeId),
	enabled: typeId >= 0,
	});
}

export function useMutationUpdateTicketType(typeId: number | string, onSuccess?: (ticket: TicketType) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (data: UpdateTicketTypeData) =>
			await fetchJsonPost<TicketType>("/api/ticket_types/" + typeId, data),
		onSuccess: data =>
		{
			queryClient.setQueryData(["ticket_type", `${typeId}`], data);
			const list = queryClient.getQueriesData<TicketType[]>({ queryKey: ["ticket_types"] })
				.find(([, items]) => items?.some(item => item.id == data.id));
			if (list)
			{
				const [key, items] = list;
				queryClient.setQueryData(key, items?.map(item => item.id == data.id ? data : item));
			}
			onSuccess?.(data);
		},
	});
	return mutation;
}

export interface UpdateTicketTypeData
{
	img: ImgData | null,
	pattern: TicketPattern,
}
