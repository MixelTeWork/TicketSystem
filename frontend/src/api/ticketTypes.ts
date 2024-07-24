import { useMutation, useQuery, useQueryClient } from "react-query";
import type { ImgData, ResponseMsg, TicketType } from "./dataTypes";
import type { TicketPattern } from "../components/TicketEditor/editor";
import ApiError from "./apiError";
import fetchPost from "../utils/fetchPost";

export function useTicketTypes(eventId: number | string)
{
	const queryClient = useQueryClient();
	const query = useQuery(["ticket_types", eventId], () => getTicketTypes(eventId), {
		onSuccess: data =>
		{
			data.forEach(v => queryClient.setQueryData(["ticket_type", `${v.id}`], v));
		}
	});
	return query;
}

async function getTicketTypes(eventId: number | string): Promise<TicketType[]>
{
	const res = await fetch(`/api/events/${eventId}/ticket_types`);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as TicketType[];
}

export function useMutationUpdateTicketTypes(eventId: number | string, onSuccess?: (ticket: TicketType[]) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (data: UpdateTicketTypesData[]) => postUpdateTicketTypes(eventId, data),
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

async function postUpdateTicketTypes(eventId: number | string, updateTicketTypesData: UpdateTicketTypesData[])
{
	const res = await fetchPost(`/api/events/${eventId}/ticket_types`, updateTicketTypesData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as TicketType[];
}

export interface UpdateTicketTypesData
{
	name: string,
	id?: number,
	action: "add" | "update" | "delete",
}


export function useTicketType(typeId: number)
{
	return useQuery(["ticket_type", `${typeId}`], () => getTicketType(typeId), { enabled: typeId >= 0 });
}

async function getTicketType(typeId: number | string): Promise<TicketType>
{
	const res = await fetch("/api/ticket_types/" + typeId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as TicketType;
}

export function useMutationUpdateTicketType(typeId: number | string, onSuccess?: (ticket: TicketType) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (data: UpdateTicketTypeData) => postUpdateTicketType(typeId, data),
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

async function postUpdateTicketType(typeId: number | string, updateTicketTypeData: UpdateTicketTypeData)
{
	const res = await fetchPost("/api/ticket_types/" + typeId, updateTicketTypeData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as TicketType;
}

export interface UpdateTicketTypeData
{
	img: ImgData | null,
	pattern: TicketPattern,
}
