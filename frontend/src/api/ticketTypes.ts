import { useMutation, useQuery, useQueryClient } from "react-query";
import { ResponseMsg, TicketType } from "./dataTypes";
import ApiError from "./apiError";
import fetchPost from "../utils/fetchPost";

export function useTicketTypes(eventId: number | string)
{
	return useQuery(["ticket_types", eventId], () => getTicketTypes(eventId));
}

async function getTicketTypes(eventId: number | string): Promise<TicketType[]>
{
	const res = await fetch("/api/ticket_types/" + eventId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as TicketType[];
}

export function useMutationUpdateTicketTypes(eventId: number | string, onSuccess?: (ticket: TicketType[]) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (data: UpdateTicketTypesData[]) => postUpdateTicketTypes(eventId, data),
		onSuccess: (data) =>
		{
			queryClient.setQueryData(["ticket_types", `${eventId}`], () => data);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postUpdateTicketTypes(eventId: number | string, updateTicketTypesData: UpdateTicketTypesData[])
{
	const res = await fetchPost("/api/ticket_types/" + eventId, updateTicketTypesData);
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
