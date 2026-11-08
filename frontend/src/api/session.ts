import { notifyManager, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { type User, queryKey } from "./user";

const sessionVersions = new WeakMap<QueryClient, number>();

export function getSessionVersion(client: QueryClient)
{
	return sessionVersions.get(client) ?? 0;
}

function resetSession(client: QueryClient, cancelUser: boolean)
{
	const version = getSessionVersion(client) + 1;
	sessionVersions.set(client, version);
	const mutations = client.getMutationCache();
	const paused = mutations.getAll().filter(mutation => mutation.state.isPaused && mutation.meta?.sessionGuarded === true);
	mutations.clear();
	// Clearing the cache also removes scope queues; resume guarded operations so they reject the old session.
	for (const mutation of paused) void mutation.continue().catch(() => {});
	// Cancellation starts synchronously. Delayed completion must not remove new session data.
	const cancelled = client.cancelQueries({ predicate: query => cancelUser || query.queryKey[0] != queryKey()[0] });
	client.removeQueries({ predicate: query => query.queryKey[0] != queryKey()[0] });
	return cancelled;
}

export async function setSessionUser(client: QueryClient, user: User)
{
	const cancelled = resetSession(client, true);
	const version = getSessionVersion(client);
	await cancelled;
	if (version == getSessionVersion(client)) client.setQueryData(queryKey(), user);
}

function sameAccess(previous: User, user: User)
{
	const sameSet = (a: string[], b: string[]) => a.every(value => b.includes(value)) && b.every(value => a.includes(value));
	return previous.auth == user.auth && previous.id == user.id
		&& sameSet(previous.roles, user.roles) && sameSet(previous.operations, user.operations);
}

export function trackSessionUser(client: QueryClient)
{
	let previous = client.getQueryData<User>(queryKey());
	let version = getSessionVersion(client);
	client.getQueryCache().subscribe(event =>
	{
		if (event.type != "updated" || event.action.type != "success"
			|| event.query.queryKey.length != 1 || event.query.queryKey[0] != queryKey()[0]) return;
		const user = event.query.state.data as User;
		const changed = previous != null && version == getSessionVersion(client) && !sameAccess(previous, user);
		previous = user;
		// Keep the successful /api/user request intact when it reports new permissions.
		if (changed) void resetSession(client, false);
		version = getSessionVersion(client);
	});
}

export function useSessionVersion()
{
	const client = useQueryClient();
	const subscribe = useCallback((onChange: () => void) => client.getQueryCache().subscribe(notifyManager.batchCalls(onChange)), [client]);
	return useSyncExternalStore(subscribe, () => getSessionVersion(client));
}

export function useRefreshSession(pathname: string)
{
	const client = useQueryClient();
	useEffect(() =>
	{
		function refresh()
		{
			if (client.getQueryData<User>(queryKey())?.auth)
				void client.refetchQueries({ queryKey: queryKey(), exact: true }, { cancelRefetch: false });
		}
		window.addEventListener("focus", refresh);
		refresh();
		return () => window.removeEventListener("focus", refresh);
	}, [client, pathname]);
}
