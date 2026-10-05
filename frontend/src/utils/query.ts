import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

type Key = QueryKey | string;

export function useQueryListItems<T extends ObjWithId>(items: T[] | undefined, updatedAt: number, itemKey: string)
{
	const queryClient = useQueryClient();
	useEffect(() =>
	{
		items?.forEach(item =>
		{
			const key = [itemKey, `${item.id}`];
			// An older cached list must not overwrite a newer detail response.
			if ((queryClient.getQueryState(key)?.dataUpdatedAt ?? 0) <= updatedAt)
				queryClient.setQueryData(key, item, { updatedAt });
		});
	}, [items, updatedAt, itemKey, queryClient]);
}

export function queryStrKey(queryKey: Key)
{
	return queryKey instanceof Array ? queryKey.map(v => `${v}`) : [`${queryKey}`];
}

export function queryInvalidate(queryClient: QueryClient, queryKey: Key)
{
	const key = queryStrKey(queryKey);
	queryClient.invalidateQueries({ queryKey: key, exact: true });
}

export function queryListAddItem<T>(queryClient: QueryClient, queryKey: Key, item: T)
{
	const key = queryStrKey(queryKey);
	if (queryClient.getQueryState(key)?.status == "success")
		queryClient.setQueryData(key, (items?: T[]) => items ? [...items, item] : [item]);
}

export function queryListUpdateItem<T extends ObjWithId>(queryClient: QueryClient, queryKey: Key, item: T)
{
	const key = queryStrKey(queryKey);
	if (queryClient.getQueryState(key)?.status == "success")
		queryClient.setQueryData(key, (items?: T[]) => items?.map(v => v.id == item.id ? item : v) || []);
}

export function queryListDeleteItem<T extends ObjWithId>(queryClient: QueryClient, queryKey: Key, itemId: number | string)
{
	const key = queryStrKey(queryKey);
	if (queryClient.getQueryState(key)?.status == "success")
		queryClient.setQueryData(key, (items?: T[]) => items ? items.filter(v => v.id != itemId) : []);
}

interface ObjWithId
{
	id: number | string,
}
