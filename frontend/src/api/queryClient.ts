import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";
import { getSessionVersion, setSessionUser, trackSessionUser } from "./session";
import { createEmptyUser, queryKey, type User } from "./user";

export function createQueryClient(defaultOptions: DefaultOptions = {})
{
	const mutationSessions = new WeakMap<object, number>();
	const client: QueryClient = new QueryClient({
		queryCache: new QueryCache({ onError: error => { void handleError(error); } }),
		mutationCache: new MutationCache({
			onMutate: (_variables, mutation) => { mutationSessions.set(mutation, getSessionVersion(client)); },
			onError: (error, _variables, _context, mutation) =>
			{
				// A response from the previous session must not sign out a newly authenticated user.
				if (mutationSessions.get(mutation) == getSessionVersion(client)) return handleError(error);
			},
		}),
		defaultOptions: {
			...defaultOptions,
			queries: {
				staleTime: Infinity,
				gcTime: Infinity,
				retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status != null && error.status < 500),
				retryDelay: 1000,
				...defaultOptions.queries,
			},
		},
	});

	function handleError(error: Error)
	{
		if (error instanceof ApiError && error.status == 401 && client.getQueryData<User>(queryKey())?.auth !== false)
			return setSessionUser(client, createEmptyUser());
	}

	trackSessionUser(client);
	return client;
}
