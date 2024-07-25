import { useMutation, useQuery, useQueryClient } from "react-query";
import type { ImgData, TicketType } from "./dataTypes";
import type { TicketPattern } from "../components/TicketEditor/editor";
import { fetchJsonGet, fetchJsonPost } from "../utils/fetch";

export function useTicketTypes(eventId: number | string)
{
	const queryClient = useQueryClient();
	return useQuery(["ticket_types", eventId], async () =>
		await fetchJsonGet<TicketType[]>(`/api/events/${eventId}/ticket_types`),
		{
			onSuccess: data =>
				data.forEach(v => queryClient.setQueryData(["ticket_type", `${v.id}`], v)),
		});
}

export function useMutationUpdateTicketTypes(eventId: number | string, onSuccess?: (ticket: TicketType[]) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (data: UpdateTicketTypesData[]) =>
			await fetchJsonPost<TicketType[]>(`/api/events/${eventId}/ticket_types`, data),
		onSuccess: (data, inp) =>
		{
			const someTypeChanged = inp.some(v => v.action == "delete" || v.action == "update")
			if (someTypeChanged)
				queryClient.invalidateQueries(["tickets", `${eventId}`], { exact: true });
			queryClient.setQueryData(["ticket_types", `${eventId}`], () => data);
			data.forEach(v => queryClient.setQueryData(["ticket_type", `${v.id}`], v));
			onSuccess?.(data);
		},
	});
	return mutation;
}

export interface UpdateTicketTypesData
{
	name: string,
	id?: number,
	action: "add" | "update" | "delete",
}


export function useTicketType(typeId: number)
{
	return useQuery(["ticket_type", `${typeId}`], async () =>
		await fetchJsonGet<TicketType>("/api/ticket_types/" + typeId),
		{ enabled: typeId >= 0 }
	);
}

export function useMutationUpdateTicketType(typeId: number | string, onSuccess?: (ticket: TicketType) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (data: UpdateTicketTypeData) =>
			await fetchJsonPost<TicketType>("/api/ticket_types/" + typeId, data),
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["ticket_type", `${typeId}`], () => data);
			if (queryClient.getQueryState(["ticket_types", `${typeId}`])?.status == "success")
				queryClient.setQueryData(["ticket_types", `${typeId}`], (types?: TicketType[]) => types ? [...types.filter(v => v.id != data.id), data] : [data]);
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
