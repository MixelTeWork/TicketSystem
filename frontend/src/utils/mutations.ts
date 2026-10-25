import { useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";
import { getSessionVersion } from "../api/session";
import { fetchDelete, fetchJsonPost, fetchPost } from "./fetch";
import { itemUrl, type ItemId, type ItemUrl } from "./query";
import { useSessionMutation } from "./useSessionMutation";

type Url<T> = string | ((data: T) => string);
type Success<TData, TResult> = (client: QueryClient, result: TResult, variables: TData) => void | Promise<unknown>;

function getUrl<T>(url: Url<T>, data: T)
{
	return typeof url == "function" ? url(data) : url;
}

type MutationHook<TData, TResult> = (onSuccess?: (result: TResult) => void, onError?: (error: Error) => void) => UseMutationResult<TResult, Error, TData, number>;
type ItemMutationHook<TData, TResult> = (id: ItemId, onSuccess?: (result: TResult) => void, onError?: (error: Error) => void) => UseMutationResult<TResult, Error, TData, number>;

export function stdMutation<TData, TResult>(url: Url<TData>, onSuccessM?: Success<TData, TResult>, preprocess?: (data: TData) => unknown): MutationHook<TData, TResult>;
export function stdMutation<TData, TResponse, TResult>(url: Url<TData>, onSuccessM: Success<TData, TResult> | undefined, preprocess: ((data: TData) => unknown) | undefined, parse: (response: TResponse) => TResult): MutationHook<TData, TResult>;
export function stdMutation<TData, TResult>(url: Url<TData>, onSuccessM?: Success<TData, TResult>, preprocess: (data: TData) => unknown = data => data, parse?: (response: TResult) => TResult)
{
	return function useStdMutation(onSuccess?: (result: TResult) => void, onError?: (error: Error) => void)
	{
		const client = useQueryClient();
		return useSessionMutation({
			mutationFn: async (data: TData) =>
			{
				const response = await fetchJsonPost<TResult>(getUrl(url, data), preprocess(data));
				return parse ? parse(response) : response;
			},
			onSuccess: async (result, variables, version) =>
			{
				await onSuccessM?.(client, result, variables);
				if (version == getSessionVersion(client)) onSuccess?.(result);
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
		return useSessionMutation({
			mutationFn: async (data: TData) =>
			{
				await (method == "DELETE" ? fetchDelete : fetchPost)(getUrl(url, data), preprocess(data));
				return data;
			},
			onSuccess: async (data, _variables, version) =>
			{
				await onSuccessM?.(client, data, data);
				if (version == getSessionVersion(client)) onSuccess?.();
			},
			onError,
		});
	};
}

export function itemMutation<TData, TResult>(url: ItemUrl, onSuccessM?: Success<TData, TResult>, preprocess?: (data: TData) => unknown): ItemMutationHook<TData, TResult>;
export function itemMutation<TData, TResponse, TResult>(url: ItemUrl, onSuccessM: Success<TData, TResult> | undefined, preprocess: ((data: TData) => unknown) | undefined, parse: (response: TResponse) => TResult): ItemMutationHook<TData, TResult>;
export function itemMutation<TData, TResult>(url: ItemUrl, onSuccessM?: Success<TData, TResult>, preprocess: (data: TData) => unknown = data => data, parse?: (response: TResult) => TResult)
{
	return function useItemMutation(id: ItemId, onSuccess?: (result: TResult) => void, onError?: (error: Error) => void)
	{
		const useBoundMutation = parse
			? stdMutation<TData, TResult, TResult>(itemUrl(url, id), onSuccessM, preprocess, parse)
			: stdMutation<TData, TResult>(itemUrl(url, id), onSuccessM, preprocess);
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
