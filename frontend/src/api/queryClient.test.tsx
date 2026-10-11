import { useMutation, QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "./queryClient";
import { ApiError } from "./dataTypes";
import { setSessionUser } from "./session";
import { createEmptyUser } from "./user";
import { fetchJsonGet, fetchPost, fetchPostForm } from "../utils/fetch";

const clients: QueryClient[] = [];
function setup()
{
	const client = createQueryClient();
	clients.push(client);
	client.setQueryData(["user"], { ...createEmptyUser(), auth: true, id: 1 });
	client.setQueryData(["staff"], [{ id: 2, password: "secret" }]);
	client.setQueryData(["tickets", "7"], [{ id: 1 }]);
	const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
	return { client, wrapper };
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test.each([false, true])("a query 401 clears the session, including a background refetch (%s)", async cached =>
{
	const { client } = setup();
	if (cached) client.setQueryData(["events"], [{ id: 7 }]);
	let pendingSignal: AbortSignal | undefined;
	const pending = client.fetchQuery({ queryKey: ["fonts"], queryFn: ({ signal }) =>
	{
		pendingSignal = signal;
		return new Promise(() => {});
	} }).catch(() => undefined);
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Unauthorized" }), { status: 401 }));
	vi.stubGlobal("fetch", fetchMock);
	await expect(client.fetchQuery({ queryKey: ["events"], staleTime: 0, queryFn: ({ signal }) => fetchJsonGet("/api/events", signal) })).rejects.toMatchObject({ status: 401 });
	await waitFor(() => expect(client.getQueryData(["user"])).toEqual(createEmptyUser()));
	await pending;
	expect(pendingSignal?.aborted).toBe(true);
	expect(client.getQueryCache().getAll().map(query => query.queryKey)).toEqual([["user"]]);
	expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(["json", "form"])("a %s mutation 401 clears the session even with a local error handler", async kind =>
{
	const { client, wrapper } = setup();
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Unauthorized" }), { status: 401 })));
	const onError = vi.fn();
	const { result } = renderHook(() => useMutation({
		mutationFn: () => kind == "form" ? fetchPostForm("/api/fonts", new FormData()) : fetchPost("/api/user/change_name", { name: "New" }),
		onError,
	}), { wrapper });
	await act(async () => { await expect(result.current.mutateAsync()).rejects.toMatchObject({ status: 401 }); });
	expect(client.getQueryData(["user"])).toEqual(createEmptyUser());
	expect(client.getQueryData(["staff"])).toBeUndefined();
	expect(client.getQueryData(["tickets", "7"])).toBeUndefined();
	expect(onError).toHaveBeenCalledOnce();
});

test.each([403, 500])("a query or mutation %s keeps the current session", async status =>
{
	const { client, wrapper } = setup();
	const user = client.getQueryData(["user"]);
	const error = new ApiError("Failed", status);
	await expect(client.fetchQuery({ queryKey: ["events"], retry: false, queryFn: () => Promise.reject(error) })).rejects.toBe(error);
	const { result } = renderHook(() => useMutation({ mutationFn: () => Promise.reject(error) }), { wrapper });
	await act(async () => { await expect(result.current.mutateAsync()).rejects.toBe(error); });
	expect(client.getQueryData(["user"])).toEqual(user);
	expect(client.getQueryData(["staff"])).toBeDefined();
});

test("a late mutation 401 from the previous session does not sign out the new user", async () =>
{
	const { client, wrapper } = setup();
	let rejectOld!: (error: Error) => void;
	const onError = vi.fn();
	const { result } = renderHook(() => useMutation({
		mutationFn: () => new Promise<void>((_resolve, reject) => { rejectOld = reject; }),
		onError,
	}), { wrapper });
	let pending!: Promise<unknown>;
	act(() => { pending = result.current.mutateAsync().catch(error => error); });
	await waitFor(() => expect(rejectOld).toBeTypeOf("function"));
	const user = { ...createEmptyUser(), auth: true, id: 3, login: "new-user" };
	await act(async () => { await setSessionUser(client, user); });
	client.setQueryData(["events"], [{ id: 9 }]);
	await act(async () =>
	{
		rejectOld(new ApiError("Unauthorized", 401));
		await pending;
	});
	expect(onError).toHaveBeenCalledOnce();
	expect(client.getQueryData(["user"])).toEqual(user);
	expect(client.getQueryData(["events"])).toEqual([{ id: 9 }]);
});
