import { useQuery, useQueryClient, useMutation } from "react-query";
import fetchDelete from "../utils/fetchDelete";
import fetchPost from "../utils/fetchPost";
import ApiError from "./apiError";
import { UserWithPwd, ResponseMsg } from "./dataTypes";


export function useManagers()
{
	return useQuery("managers", getManagers);
}

async function getManagers(): Promise<UserWithPwd[]>
{
	const res = await fetch("/api/managers");
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as UserWithPwd[];
}

export function useMutationNewManager(onSuccess?: (manager: UserWithPwd) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postNewManager,
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState("managers")?.status == "success")
				queryClient.setQueryData("managers", (managers?: UserWithPwd[]) => managers ? [...managers, data] : [data]);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postNewManager(newManagerData: NewManagerData)
{
	const res = await fetchPost("/api/manager", newManagerData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as UserWithPwd;
}
interface NewManagerData
{
	name: string;
	login: string;
}


export function useMutationDeleteManager(managerId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: () => postDeleteManager(managerId),
		onSuccess: () =>
		{
			if (queryClient.getQueryState("managers")?.status == "success")
				queryClient.setQueryData("managers", (managers?: UserWithPwd[]) => managers ? managers.filter(v => v.id != managerId) : []);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postDeleteManager(managerId: number | string)
{
	const res = await fetchDelete("/api/manager/" + managerId);
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
}
