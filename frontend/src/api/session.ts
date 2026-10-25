import { type QueryClient } from "@tanstack/react-query";
import { type User, queryKey } from "./user";

const sessionVersions = new WeakMap<QueryClient, number>();

export function getSessionVersion(client: QueryClient)
{
	return sessionVersions.get(client) ?? 0;
}

export async function setSessionUser(client: QueryClient, user: User)
{
	const version = getSessionVersion(client) + 1;
	sessionVersions.set(client, version);
	const mutations = client.getMutationCache();
	const paused = mutations.getAll().filter(mutation => mutation.state.isPaused && mutation.meta?.sessionGuarded === true);
	mutations.clear();
	// Clearing the cache also removes scope queues; resume guarded operations so they reject the old session.
	for (const mutation of paused) void mutation.continue().catch(() => {});
	// Cancel pending reads before removing data belonging to the previous session.
	await client.cancelQueries();
	if (getSessionVersion(client) != version) return;
	client.removeQueries({ predicate: query => query.queryKey[0] != queryKey()[0] });
	client.setQueryData(queryKey(), user);
}
