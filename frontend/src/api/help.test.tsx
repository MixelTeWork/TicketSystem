import { QueryClientProvider, focusManager, type QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useHelpSearch } from "./help";
import { createQueryClient } from "./queryClient";

const clients: QueryClient[] = [];
const user = { auth: true, id: 1, name: "Manager", login: "manager", roles: ["Организатор"], operations: [] };

function setup()
{
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], user);
	const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
	return { client, wrapper };
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test("search is explicit and does not refetch on focus", async () =>
{
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })));
	vi.stubGlobal("fetch", fetch);
	const { wrapper } = setup();
	const hook = renderHook(() => useHelpSearch(), { wrapper });
	expect(fetch).not.toHaveBeenCalled();
	await act(() => hook.result.current.mutateAsync("ручной ввод"));
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(fetch.mock.calls[0][0]).toBe("/api/help/search?q=" + encodeURIComponent("ручной ввод"));
	await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
	expect(fetch).toHaveBeenCalledTimes(1);
});

test("a late search response after a role change cannot retain organizer text in mutation cache", async () =>
{
	let finish: (value: Response) => void = () => {};
	const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
	vi.stubGlobal("fetch", fetch);
	const { client, wrapper } = setup();
	const hook = renderHook(() => useHelpSearch(), { wrapper });
	act(() => hook.result.current.mutate("private"));
	await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
	await act(async () => { client.setQueryData(["user"], { ...user, roles: ["Билетёр"], operations: ["scan_tickets"] }); });
	await act(async () => { finish(new Response(JSON.stringify({ items: [{ snippet: "private organizer text" }], total: 1 }))); });
	await waitFor(() => expect(hook.result.current.isPending).toBe(false));
	expect(hook.result.current.data).toBeUndefined();
	expect(JSON.stringify(client.getMutationCache().getAll().map(mutation => mutation.state.data))).not.toContain("private organizer text");
});

test("a role change removes completed help searches from mutation cache", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ items: [{ snippet: "private organizer text" }], total: 1 })))));
	const { client, wrapper } = setup();
	const hook = renderHook(() => useHelpSearch(), { wrapper });
	await act(() => hook.result.current.mutateAsync("private"));
	expect(client.getMutationCache().getAll()).toHaveLength(1);
	await act(async () => { client.setQueryData(["user"], { ...user, roles: ["Билетёр"], operations: ["scan_tickets"] }); });
	await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
});
