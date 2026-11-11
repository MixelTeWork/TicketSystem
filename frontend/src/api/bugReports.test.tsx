import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useBugReports, useReportBug } from "./bugReports";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

function setup()
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } } });
	clients.push(client);
	const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	return { client, wrapper };
}

test("report pages refresh cached data, keep separate keys and parse UTC dates", async () =>
{
	const item = { id: 7, userId: 4, userName: "Автор", userLogin: "reporter", description: "Ошибка", page: "/scanner/42", userAgent: "Browser", createdAt: "2026-11-08T12:00:00Z" };
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [item], total: 26, pages: 2 })));
	vi.stubGlobal("fetch", fetchMock);
	const { client, wrapper } = setup();
	client.setQueryData(["bugReports", 0], { items: [], total: 0, pages: 1 });
	const { result, rerender } = renderHook(({ page }) => useBugReports(page), { wrapper, initialProps: { page: 0 } });
	await waitFor(() => expect(result.current.data?.total).toBe(26));
	expect(result.current.data?.items[0].createdAt.toISOString()).toBe(item.createdAt.replace("Z", ".000Z"));
	expect(fetchMock).toHaveBeenCalledWith("/api/bug_reports?p=0", expect.objectContaining({ signal: expect.any(AbortSignal) }));
	fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], total: 26, pages: 2 })));
	rerender({ page: 1 });
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(fetchMock).toHaveBeenCalledWith("/api/bug_reports?p=1", expect.anything());
	expect(result.current.data?.items).toEqual([]);
	expect(client.getQueryData(["bugReports", 0])).toMatchObject({ items: [{ id: 7 }] });
});

test("sending a report invalidates every cached page without invalidating other data", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 8 }))));
	const { client, wrapper } = setup();
	for (const page of [0, 1]) client.setQueryData(["bugReports", page], { items: [], total: 0, pages: 1 });
	client.setQueryData(["events"], []);
	const { result } = renderHook(() => useReportBug(), { wrapper });
	await act(async () => { await result.current.mutateAsync({ description: "Ошибка", page: "/scanner/42" }); });
	for (const page of [0, 1]) expect(client.getQueryState(["bugReports", page])?.isInvalidated).toBe(true);
	expect(client.getQueryState(["events"])?.isInvalidated).toBe(false);
});
