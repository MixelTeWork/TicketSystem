import { useQuery, useQueryClient, type QueryClient, type QueryKey, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchJsonGet } from "./fetch";

type Key = QueryKey | string;

export type ItemId = number | string;
export type ItemUrl = string | ((id: ItemId) => string);

export function itemUrl(url: ItemUrl, id: ItemId)
{
	return typeof url == "function" ? url(id) : `${url}/${id}`;
}

export function stdQuery<TData>(key: QueryKey, url: string): () => UseQueryResult<TData, Error>;
export function stdQuery<TResponse, TData>(key: QueryKey, url: string, select: (data: TResponse) => TData): () => UseQueryResult<TData, Error>;
export function stdQuery<TResponse, TData>(key: QueryKey, url: string, select?: (data: TResponse) => TData)
{
	return function useStdQuery()
	{
		return useQuery({ queryKey: key, queryFn: async ({ signal }) =>
		{
			const data = await fetchJsonGet<TResponse>(url, signal);
			return select ? select(data) : data;
		} });
	};
}

type ItemQuery<TData> = (id: ItemId, options?: { enabled?: boolean }) => UseQueryResult<TData, Error>;

export function itemQuery<TData>(key: (id: ItemId) => QueryKey, url: ItemUrl): ItemQuery<TData>;
export function itemQuery<TResponse, TData>(key: (id: ItemId) => QueryKey, url: ItemUrl, select: (data: TResponse) => TData): ItemQuery<TData>;
export function itemQuery<TResponse, TData>(key: (id: ItemId) => QueryKey, url: ItemUrl, select?: (data: TResponse) => TData)
{
	return function useItemQuery(id: ItemId, options: { enabled?: boolean } = {})
	{
		return useQuery({
			queryKey: key(id),
			queryFn: async ({ signal }) =>
			{
				const data = await fetchJsonGet<TResponse>(itemUrl(url, id), signal);
				return select ? select(data) : data;
			},
			enabled: options.enabled !== false && Number.isInteger(Number(id)) && Number(id) > 0,
		});
	};
}

export function useQueryListItems<T extends ObjWithId>(items: T[] | undefined, updatedAt: number, itemKey: (id: ItemId) => QueryKey)
{
	const queryClient = useQueryClient();
	useEffect(() =>
	{
		items?.forEach(item =>
		{
			const key = itemKey(item.id);
			// An older cached list must not overwrite a newer detail response.
			if ((queryClient.getQueryState(key)?.dataUpdatedAt ?? 0) <= updatedAt)
				queryClient.setQueryData(key, item, { updatedAt });
		});
	}, [items, updatedAt, itemKey, queryClient]);
}

function toQueryKey(queryKey: Key): QueryKey
{
	return typeof queryKey == "string" ? [queryKey] : queryKey;
}

export function queryInvalidate(queryClient: QueryClient, queryKey: Key, exact = true)
{
	const key = toQueryKey(queryKey);
	return queryClient.invalidateQueries({ queryKey: key, exact });
}

export function queryListAddItem<T>(queryClient: QueryClient, queryKey: Key, item: T)
{
	const key = toQueryKey(queryKey);
	const state = queryClient.getQueryState(key);
	// A local edit does not refresh the other items in the list.
	if (state?.status == "success")
		queryClient.setQueryData(key, (items?: T[]) => items ? [...items, item] : [item], { updatedAt: state.dataUpdatedAt });
}

export function queryListUpdateItem<T extends ObjWithId>(queryClient: QueryClient, queryKey: Key, item: T)
{
	const key = toQueryKey(queryKey);
	const state = queryClient.getQueryState(key);
	if (state?.status == "success")
		queryClient.setQueryData(key, (items?: T[]) => items?.map(v => v.id == item.id ? item : v) || [], { updatedAt: state.dataUpdatedAt });
}

export function queryListDeleteItem<T extends ObjWithId>(queryClient: QueryClient, queryKey: Key, itemId: number | string)
{
	const key = toQueryKey(queryKey);
	const state = queryClient.getQueryState(key);
	if (state?.status == "success")
		queryClient.setQueryData(key, (items?: T[]) => items ? items.filter(v => v.id != itemId) : [], { updatedAt: state.dataUpdatedAt });
}

interface ObjWithId
{
	id: number | string,
}
