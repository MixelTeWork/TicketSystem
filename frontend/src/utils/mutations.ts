import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchDelete, fetchJsonPost, fetchPost } from "./fetch";
import { itemUrl, type ItemId, type ItemUrl } from "./query";

type Url<T> = string | ((data: T) => string);
type Success<TData, TResult> = (client: QueryClient, result: TResult, variables: TData) => void | Promise<unknown>;

function getUrl<T>(url: Url<T>, data: T)
{
	return typeof url == "function" ? url(data) : url;
}

export function stdMutation<TData, TResponse, TResult = TResponse>(url: Url<TData>, onSuccessM?: Success<TData, TResult>, preprocess: (data: TData) => unknown = data => data, parse?: (response: TResponse) => TResult)
{
	return function useStdMutation(onSuccess?: (result: TResult) => void, onError?: (error: Error) => void)
	{
		const client = useQueryClient();
		return useMutation({
			mutationFn: async (data: TData) =>
			{
				const response = await fetchJsonPost<TResponse>(getUrl(url, data), preprocess(data));
				return parse ? parse(response) : response as unknown as TResult;
			},
			onSuccess: async (result, variables) =>
			{
				await onSuccessM?.(client, result, variables);
				onSuccess?.(result);
			},
			onError,
		});
	};
}

export function stdMutationNoRes<TData>(url: Url<TData>, onSuccessM?: Success<TData, TData>, preprocess: (data: TData) => unknown = data => data, method: "POST" | "DELETE" = "POST")
{
	return function useStdMutationNoRes(onSuccess?: () => void, onError?: (error: Error) => void)
	{
		const client = useQueryClient();
		return useMutation({
			mutationFn: async (data: TData) =>
			{
				await (method == "DELETE" ? fetchDelete : fetchPost)(getUrl(url, data), preprocess(data));
				return data;
			},
			onSuccess: async data =>
			{
				await onSuccessM?.(client, data, data);
				onSuccess?.();
			},
			onError,
		});
	};
}

export function itemMutation<TData, TResponse, TResult = TResponse>(url: ItemUrl, onSuccessM?: Success<TData, TResult>, preprocess: (data: TData) => unknown = data => data, parse?: (response: TResponse) => TResult)
{
	return function useItemMutation(id: ItemId, onSuccess?: (result: TResult) => void, onError?: (error: Error) => void)
	{
		const useBoundMutation = stdMutation<TData, TResponse, TResult>(itemUrl(url, id), onSuccessM, preprocess, parse);
		return useBoundMutation(onSuccess, onError);
	};
}

export function itemDeleteMutation(url: ItemUrl, onSuccessM?: (client: QueryClient, id: ItemId) => void | Promise<unknown>)
{
	return function useItemDeleteMutation(id: ItemId, onSuccess?: () => void, onError?: (error: Error) => void)
	{
		const useDelete = stdMutationNoRes<void>(itemUrl(url, id), client => onSuccessM?.(client, id), () => undefined, "DELETE");
		return useDelete(onSuccess, onError);
	};
}
