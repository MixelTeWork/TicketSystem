import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import EditEventForm from "./EditEventForm";
import CreateEventForm from "../create/CreateEventForm";
import { inputToUtc } from "../../utils/dates";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });

test("reopening discards an event draft but a background refresh preserves it", async () =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const event = { id: 7, name: "Original", date: new Date("2026-10-12T15:00:17Z"), active: true };
	client.setQueryData(["event", "7"], event);
	const form = (open: boolean, eventId = 7) => <QueryClientProvider client={client}><EditEventForm eventId={eventId} open={open} /></QueryClientProvider>;
	const view = render(form(true));
	const title = screen.getByLabelText("Название") as HTMLInputElement;
	const date = screen.getByLabelText("Дата (МСК)") as HTMLInputElement;
	const active = screen.getByRole("checkbox", { name: "Разрешить сканирование" }) as HTMLInputElement;
	expect(title.value).toBe("Original");
	expect(active.checked).toBe(true);
	expect(inputToUtc(date.value)).toBe("2026-10-12T15:00:17.000Z");
	fireEvent.change(title, { target: { value: "Cancelled draft" } });
	fireEvent.change(date, { target: { value: "2026-11-01T12:00" } });
	fireEvent.click(active);
	const refreshed = { ...event, name: "Updated", date: new Date("2026-10-13T21:30:00Z") };
	await act(async () => { client.setQueryData(["event", "7"], refreshed); });
	expect(title.value).toBe("Cancelled draft");
	expect(active.checked).toBe(false);
	expect(inputToUtc(date.value)).toBe("2026-11-01T09:00:00.000Z");
	view.rerender(form(false));
	view.rerender(form(true));
	expect(title.value).toBe("Updated");
	expect(active.checked).toBe(true);
	expect(inputToUtc(date.value)).toBe("2026-10-13T21:30:00.000Z");
	client.setQueryData(["event", "8"], { ...event, id: 8, name: "Other", active: false });
	view.rerender(form(true, 8));
	expect(title.value).toBe("Other");
	expect(active.checked).toBe(false);
	expect(inputToUtc(date.value)).toBe("2026-10-12T15:00:17.000Z");
});

test.each([true, false])("saving an event changes scanning from %s and updates the cached status", async initialActive =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const event = { id: 7, name: "Original", date: new Date("2026-10-12T15:00:17Z"), active: initialActive };
	client.setQueryData(["event", "7"], event);
	client.setQueryData(["events"], [{ ...event, ticketCount: 42 }]);
	const saved = { ...event, date: event.date.toISOString(), active: !initialActive };
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(saved), { status: 200 }));
	vi.stubGlobal("fetch", fetchMock);
	render(<QueryClientProvider client={client}><EditEventForm eventId={7} open /></QueryClientProvider>);
	const active = screen.getByRole("checkbox", { name: "Разрешить сканирование" }) as HTMLInputElement;
	expect(active.checked).toBe(initialActive);
	fireEvent.click(active);
	fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events/7", expect.objectContaining({
		method: "POST",
		body: JSON.stringify({ date: event.date.toISOString(), name: event.name, active: !initialActive }),
	})));
	await waitFor(() => expect(client.getQueryData(["events"])).toEqual([{ ...event, active: !initialActive, ticketCount: 42 }]));
	expect(client.getQueryData(["event", "7"])).toEqual({ ...event, active: !initialActive });
});

test.each(["create", "edit"])("the %s form validates both ends of the Moscow date range", mode =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	client.setQueryData(["event", "7"], { id: 7, name: "Original", date: new Date("2026-10-12T15:00:00Z"), active: true });
	render(<QueryClientProvider client={client}>{mode == "create" ? <CreateEventForm open /> : <EditEventForm eventId={7} open />}</QueryClientProvider>);
	const date = screen.getByLabelText("Дата (МСК)") as HTMLInputElement;
	for (const value of ["1000-01-01T03:00", "9999-12-31T23:59:59"])
	{
		fireEvent.change(date, { target: { value } });
		expect(date.checkValidity()).toBe(true);
	}
	for (const value of ["1000-01-01T02:59:59", "10000-01-01T00:00"])
	{
		fireEvent.change(date, { target: { value } });
		expect(date.checkValidity()).toBe(false);
	}
});
