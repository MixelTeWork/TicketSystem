import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useEvent, useEvents, useScannerEvent } from "./events";
import { useMutationUpdateTicketType, useTicketType, useTicketTypes } from "./ticketTypes";
import { useLog, useLogCacheClear } from "./log";

const clients: QueryClient[] = [];

function setup()
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
	return { client, wrapper };
}

function response(data: unknown, status = 200)
{
	return new Response(JSON.stringify(data), { status });
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test("event lists seed details and refetch updates mounted detail queries", async () =>
{
	const event = { id: 7, name: "Before", date: "2026-10-05T12:00:00Z" };
	const fetchMock = vi.fn().mockResolvedValueOnce(response([event])).mockResolvedValueOnce(response([{ ...event, name: "After" }]));
	vi.stubGlobal("fetch", fetchMock);
	const { client, wrapper } = setup();
	const list = renderHook(() => useEvents(), { wrapper });
	await waitFor(() => expect(client.getQueryData(["event", "7"])).toMatchObject({ name: "Before", date: new Date(event.date) }));
	const detail = renderHook(() => useEvent(7), { wrapper });
	expect(detail.result.current.data?.name).toBe("Before");
	expect(fetchMock).toHaveBeenCalledTimes(1);
	await act(async () => { await list.result.current.refetch(); });
	await waitFor(() => expect(detail.result.current.data?.name).toBe("After"));
	expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a cached event list cannot overwrite newer detail data on remount", async () =>
{
	const { client, wrapper } = setup();
	const event = { id: 7, name: "Old", date: new Date() };
	client.setQueryData(["events"], [event], { updatedAt: 100 });
	client.setQueryData(["event", "7"], { ...event, name: "New" }, { updatedAt: 200 });
	renderHook(() => useEvents(), { wrapper });
	expect(client.getQueryData(["event", "7"])).toMatchObject({ name: "New" });
});

test("ticket type lists seed editor details and keep them updated after refetch", async () =>
{
	const type = { id: 9, name: "Before", imageId: null, pattern: {} };
	const fetchMock = vi.fn().mockResolvedValueOnce(response([type])).mockResolvedValueOnce(response([{ ...type, name: "After" }]));
	vi.stubGlobal("fetch", fetchMock);
	const { client, wrapper } = setup();
	const list = renderHook(() => useTicketTypes(7), { wrapper });
	await waitFor(() => expect(client.getQueryData(["ticket_type", "9"])).toEqual(type));
	const detail = renderHook(() => useTicketType(9), { wrapper });
	expect(detail.result.current.data?.name).toBe("Before");
	expect(fetchMock).toHaveBeenCalledTimes(1);
	await act(async () => { await list.result.current.refetch(); });
	await waitFor(() => expect(detail.result.current.data?.name).toBe("After"));
	expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("editing a ticket type updates its event list without refetching it", async () =>
{
	const { client, wrapper } = setup();
	const type = { id: 9, name: "Standard", imageId: null, pattern: { width: 100, height: 100, objects: [] } };
	const other = { ...type, id: 10, name: "Other" };
	const updated = { ...type, imageId: 42 };
	client.setQueryData(["ticket_types", "7"], [type, other]);
	const otherEventType = { ...type, id: 11, name: "Another event" };
	client.setQueryData(["ticket_types", "9"], [otherEventType]);
	const unrelatedState = client.getQueryState(["ticket_types", "9"]);
	const fetchMock = vi.fn().mockResolvedValue(response(updated));
	vi.stubGlobal("fetch", fetchMock);
	const onSuccess = vi.fn(() =>
	{
		expect(client.getQueryData(["ticket_types", "7"])).toEqual([updated, other]);
	});
	const { result } = renderHook(() => ({ list: useTicketTypes(7), mutation: useMutationUpdateTicketType("9", onSuccess) }), { wrapper });
	await act(async () =>
	{
		await result.current.mutation.mutateAsync({ img: null, pattern: type.pattern });
	});
	await waitFor(() => expect(result.current.list.data).toEqual([updated, other]));
	expect(client.getQueryData(["ticket_type", "9"])).toEqual(updated);
	expect(client.getQueryData(["ticket_types", "9"])).toEqual([otherEventType]);
	expect(client.getQueryState(["ticket_types", "9"])).toBe(unrelatedState);
	expect(onSuccess).toHaveBeenCalledTimes(1);
	expect(fetchMock).toHaveBeenCalledTimes(1);
	expect(fetchMock).toHaveBeenCalledWith("/api/ticket_types/9", expect.objectContaining({ method: "POST" }));
});

test("scanner authorization still runs when event details are cached", async () =>
{
	const { client, wrapper } = setup();
	client.setQueryData(["event", "7"], { id: 7, name: "Private", date: new Date() });
	const fetchMock = vi.fn().mockResolvedValue(response({ msg: "Forbidden" }, 403));
	vi.stubGlobal("fetch", fetchMock);
	const { result } = renderHook(() => useScannerEvent(7), { wrapper });
	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(result.current.data).toBeNaN();
	expect(fetchMock).toHaveBeenCalledWith("/api/scanner_events/7");
});

test("log navigation uses prefetched adjacent pages without requesting negative pages", async () =>
{
	const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response([])));
	vi.stubGlobal("fetch", fetchMock);
	const { client, wrapper } = setup();
	const { rerender } = renderHook(({ page }) => useLog(page), { wrapper, initialProps: { page: 0 } });
	await waitFor(() => expect(client.getQueryState(["log", 1])?.status).toBe("success"));
	expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(["/api/debug/log?p=0", "/api/debug/log?p=1"]));
	rerender({ page: 1 });
	await waitFor(() => expect(client.getQueryState(["log", 2])?.status).toBe("success"));
	expect(fetchMock.mock.calls.filter(([url]) => url == "/api/debug/log?p=1")).toHaveLength(1);
	expect(fetchMock.mock.calls.some(([url]) => url.includes("p=-"))).toBe(false);
});

test("clearing and refreshing the log reloads its adjacent page", async () =>
{
	const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response([])));
	vi.stubGlobal("fetch", fetchMock);
	const { client, wrapper } = setup();
	const { result } = renderHook(() => ({ log: useLog(0), clear: useLogCacheClear() }), { wrapper });
	await waitFor(() => expect(client.getQueryState(["log", 1])?.status).toBe("success"));
	await act(async () =>
	{
		result.current.clear();
		await result.current.log.refetch();
	});
	await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url == "/api/debug/log?p=1")).toHaveLength(2));
});
