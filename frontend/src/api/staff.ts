import { useQuery, useQueryClient, useMutation } from "react-query";
import fetchDelete from "../utils/fetchDelete";
import fetchPost from "../utils/fetchPost";
import ApiError from "./apiError";
import { Staff, ResponseMsg } from "./dataTypes";


export function useStaff()
{
	return useQuery("staff", getStaff);
}

async function getStaff(): Promise<Staff[]>
{
	const res = await fetch("/api/staff");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as Staff[];
}

export function useMutationNewStaff(onSuccess?: (staff: Staff) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postNewStaff,
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("staff")?.status == "success")
				queryClient.setQueryData("staff", (staff?: Staff[]) => staff ? [...staff, data] : [data]);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postNewStaff(eventData: NewStaffData)
{
	const res = await fetchPost("/api/staff", eventData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	if (data.exist) throw new ApiError((data as ResponseMsg).msg);
	return data as Staff;
}
interface NewStaffData
{
	name: string;
	login: string;
}


export function useMutationDeleteStaff(staffId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => postDeleteStaff(staffId),
		onSuccess: () =>
		{
			if (queryClient.getQueryState("staff")?.status == "success")
				queryClient.setQueryData("staff", (staff?: Staff[]) => staff ? staff.filter(v => v.id != staffId) : []);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postDeleteStaff(staffId: number | string)
{
	const res = await fetchDelete("/api/staff/" + staffId);
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
}

export function useMutationResetStaffPassword(staffId: number | string, onSuccess?: (staff: Staff) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => postResetStaffPassword(staffId),
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("staff")?.status == "success")
				queryClient.setQueryData("staff", (staff?: Staff[]) => staff ? staff.map(v => v.id != staffId ? v : data) : []);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postResetStaffPassword(staffId: number | string)
{
	const res = await fetchPost("/api/staff/reset_password/" + staffId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as Staff;
}
