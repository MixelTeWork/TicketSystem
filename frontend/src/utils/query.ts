import type { QueryClient, QueryKey } from "react-query";

export function queryStrKey(queryKey: QueryKey)
{
	return queryKey instanceof Array ? queryKey.map(v => `${v}`) : `${queryKey}`;
}

export function queryInvalidate(queryClient: QueryClient, queryKey: QueryKey)
{
	queryKey = queryStrKey(queryKey);
	queryClient.invalidateQueries(queryKey, { exact: true });
}

export function queryListAddItem<T>(queryClient: QueryClient, queryKey: QueryKey, item: T)
{
	queryKey = queryStrKey(queryKey);
	if (queryClient.getQueryState(queryKey)?.status == "success")
		queryClient.setQueryData(queryKey, (items?: T[]) => items ? [...items, item] : [item]);
}

export function queryListUpdateItem<T extends ObjWithId>(queryClient: QueryClient, queryKey: QueryKey, item: T)
{
	queryKey = queryStrKey(queryKey);
	if (queryClient.getQueryState(queryKey)?.status == "success")
		queryClient.setQueryData(queryKey, (items?: T[]) => items ? [...items.filter(v => v.id != item.id), item] : [item]);
}

export function queryListDeleteItem<T extends ObjWithId>(queryClient: QueryClient, queryKey: QueryKey, itemId: number | string)
{
	queryKey = queryStrKey(queryKey);
	if (queryClient.getQueryState(queryKey)?.status == "success")
		queryClient.setQueryData(queryKey, (items?: T[]) => items ? items.filter(v => v.id != itemId) : []);
}

interface ObjWithId
{
	id: number | string,
}
