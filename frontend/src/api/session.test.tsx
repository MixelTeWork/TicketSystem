import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useMutationAuth, useMutationLogout } from "./auth";
import { createEmptyUser, type UserData } from "./user";
import { createQueryClient } from "./queryClient";
import { setSessionUser } from "./session";
import { useMutationNewStaff } from "./staff";
import { SessionChangedError, useSessionMutation } from "../utils/useSessionMutation";

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

test("an unmounted old-session mutation cannot insert staff or their password into the new session", async () =>
{
	const { client, wrapper } = setup();
	let release!: (response: Response) => void;
	vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
	const onSuccess = vi.fn();
	const { result, unmount } = renderHook(() => useMutationNewStaff(onSuccess), { wrapper });
	let pending!: Promise<unknown>;
	act(() => { pending = result.current.mutateAsync({ name: "Old staff", login: "old" }).catch(error => error); });
	await waitFor(() => expect(release).toBeTypeOf("function"));
	unmount();
	const user = { ...createEmptyUser(), auth: true, id: 3 };
	await act(async () => { await setSessionUser(client, user); });
	client.setQueryData(["staff"], []);
	await act(async () =>
	{
		release(new Response(JSON.stringify({ id: 9, name: "Old staff", password: "private", roles: [], operations: [] })));
		expect(await pending).toBeInstanceOf(SessionChangedError);
	});
	expect(onSuccess).not.toHaveBeenCalled();
	expect(client.getQueryData(["staff"])).toEqual([]);
	expect(client.getQueryData(["user"])).toEqual(user);
	expect(client.getMutationCache().getAll()).toEqual([]);
});

test("a delayed logout cannot sign out a newly authenticated session", async () =>
{
	const { client, wrapper } = setup();
	let release!: (response: Response) => void;
	vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
	const { result } = renderHook(() => useMutationLogout(), { wrapper });
	let pending!: Promise<unknown>;
	act(() => { pending = result.current.mutateAsync().catch(error => error); });
	await waitFor(() => expect(release).toBeTypeOf("function"));
	const user = { ...createEmptyUser(), auth: true, id: 3 };
	await act(async () => { await setSessionUser(client, user); });
	await act(async () =>
	{
		release(new Response(null, { status: 204 }));
		expect(await pending).toBeInstanceOf(SessionChangedError);
	});
	expect(client.getQueryData(["user"])).toEqual(user);
});

test.each(["mutate", "mutateAsync"] as const)("%s captures the session before asynchronous mutation setup", async method =>
{
	const { client, wrapper } = setup();
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 9, password: "private" })));
	vi.stubGlobal("fetch", fetchMock);
	const onSuccess = vi.fn();
	const onError = vi.fn();
	const { result } = renderHook(() => useMutationNewStaff(onSuccess), { wrapper });
	let pending: Promise<unknown> | undefined;
	const user = { ...createEmptyUser(), auth: true, id: 3 };
	await act(async () =>
	{
		const data = { name: "Old staff", login: "old" };
		if (method == "mutateAsync") pending = result.current.mutateAsync(data, { onSuccess, onError }).catch(error => error);
		else result.current.mutate(data, { onSuccess, onError });
		await setSessionUser(client, user);
	});
	await waitFor(() => expect(result.current.isError).toBe(true));
	if (pending) expect(await pending).toBeInstanceOf(SessionChangedError);
	expect(fetchMock).not.toHaveBeenCalled();
	expect(onSuccess).not.toHaveBeenCalled();
	expect(onError).not.toHaveBeenCalled();
	expect(client.getQueryData(["staff"])).toBeUndefined();
	expect(client.getQueryData(["user"])).toEqual(user);
});

test("queued operations keep their original session and do not run after sign-in changes", async () =>
{
	const { client, wrapper } = setup();
	let finish!: (result: string) => void;
	const request = vi.fn((value: string) => new Promise<string>(resolve => { finish = () => resolve(value); }));
	const { result } = renderHook(() => useSessionMutation({ scope: { id: "serial" }, mutationFn: request }), { wrapper });
	let first!: Promise<unknown>;
	let second!: Promise<unknown>;
	act(() => { first = result.current.mutateAsync("first").catch(error => error); });
	await waitFor(() => expect(request).toHaveBeenCalledOnce());
	act(() => { second = result.current.mutateAsync("second").catch(error => error); });
	await waitFor(() => expect(result.current.isPaused).toBe(true));
	await act(async () =>
	{
		await setSessionUser(client, { ...createEmptyUser(), auth: true, id: 3 });
		finish("first");
		expect(await first).toBeInstanceOf(SessionChangedError);
		expect(await second).toBeInstanceOf(SessionChangedError);
	});
	expect(request).toHaveBeenCalledOnce();
});

test("local callbacks receive the original variables and mutation result", async () =>
{
	const { wrapper } = setup();
	const onSuccess = vi.fn();
	const onSettled = vi.fn();
	const { result } = renderHook(() => useSessionMutation({ mutationFn: async (value: string) => value.toUpperCase() }), { wrapper });
	await act(async () => { await result.current.mutateAsync("hello", { onSuccess, onSettled }); });
	await waitFor(() => expect(result.current.variables).toBe("hello"));
	expect(result.current.data).toBe("HELLO");
	expect(onSuccess).toHaveBeenCalledWith("HELLO", "hello", 0, expect.any(Object));
	expect(onSettled).toHaveBeenCalledWith("HELLO", null, "hello", 0, expect.any(Object));
});
