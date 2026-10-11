import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useMutationAuth, useMutationLogout } from "./auth";
import { createEmptyUser, type UserData } from "./user";
import { createQueryClient } from "./queryClient";

const clients: QueryClient[] = [];
function setup()
{
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], { ...createEmptyUser(), auth: true, id: 1 });
	client.setQueryData(["tickets", "7"], [{ id: 1 }]);
	client.setQueryData(["staff"], [{ id: 2, password: "secret" }]);
	const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
	return { client, wrapper };
}
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test("signing in cancels old requests and removes data from the previous session", async () =>
{
	const { client, wrapper } = setup();
	let oldSignal: AbortSignal | undefined;
	const pending = client.fetchQuery({ queryKey: ["events"], queryFn: ({ signal }) =>
	{
		oldSignal = signal;
		return new Promise(() => {});
	} }).catch(() => undefined);
	const user = { id: 3, name: "Other", login: "other", roles: ["manager"], operations: [] } satisfies UserData;
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(user))));
	const { result } = renderHook(() => useMutationAuth(), { wrapper });
	await act(async () => { await result.current.mutateAsync({ login: "other", password: "password" }); });
	await pending;
	expect(oldSignal?.aborted).toBe(true);
	expect(client.getQueryData(["user"])).toEqual({ ...user, auth: true });
	expect(client.getQueryCache().getAll().map(query => query.queryKey)).toEqual([["user"]]);
});

test("logout clears private data and marks the user signed out", async () =>
{
	const { client, wrapper } = setup();
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
	const { result } = renderHook(() => useMutationLogout(), { wrapper });
	await act(async () => { await result.current.mutateAsync(); });
	expect(client.getQueryData(["user"])).toEqual(createEmptyUser());
	expect(client.getQueryData(["staff"])).toBeUndefined();
	expect(client.getQueryData(["tickets", "7"])).toBeUndefined();
});
