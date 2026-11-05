import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { eventFixture } from "../../test/fixtures";
import EditEventForm from "./EditEventForm";
import CreateEventForm from "../create/CreateEventForm";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });

test("reopening discards an event draft but a background refresh preserves it", async () =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const event = eventFixture({ id: 7, name: "Original", date: "2026-10-12", active: true });
	client.setQueryData(["event", "7"], event);
	const form = (open: boolean, eventId = 7) => <QueryClientProvider client={client}><EditEventForm eventId={eventId} open={open} /></QueryClientProvider>;
	const view = render(form(true));
	const title = screen.getByLabelText("Название") as HTMLInputElement;
	const date = screen.getByLabelText("Дата (МСК)") as HTMLInputElement;
	const active = screen.getByRole("checkbox", { name: "Разрешить сканирование" }) as HTMLInputElement;
	expect(title.value).toBe("Original");
	expect(active.checked).toBe(true);
	expect(date.value).toBe("2026-10-12");
	fireEvent.change(title, { target: { value: "Cancelled draft" } });
	fireEvent.change(date, { target: { value: "2026-11-01" } });
	fireEvent.click(active);
	const refreshed = { ...event, name: "Updated", date: "2026-10-14" };
	await act(async () => { client.setQueryData(["event", "7"], refreshed); });
	expect(title.value).toBe("Cancelled draft");
	expect(active.checked).toBe(false);
	expect(date.value).toBe("2026-11-01");
	view.rerender(form(false));
	view.rerender(form(true));
	expect(title.value).toBe("Updated");
	expect(active.checked).toBe(true);
	expect(date.value).toBe("2026-10-14");
	client.setQueryData(["event", "8"], { ...event, id: 8, name: "Other", active: false });
	view.rerender(form(true, 8));
	expect(title.value).toBe("Other");
	expect(active.checked).toBe(false);
	expect(date.value).toBe("2026-10-12");
});

test.each([true, false])("saving an event changes scanning from %s and updates the cached status", async initialActive =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const event = eventFixture({ id: 7, name: "Original", date: "2026-10-12", active: initialActive });
	client.setQueryData(["event", "7"], event);
	client.setQueryData(["events"], [{ ...event, ticketCount: 42 }]);
	const saved = { ...event, date: "2026-10-12", active: !initialActive };
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(saved), { status: 200 }));
	vi.stubGlobal("fetch", fetchMock);
	render(<QueryClientProvider client={client}><EditEventForm eventId={7} open /></QueryClientProvider>);
	const active = screen.getByRole("checkbox", { name: "Разрешить сканирование" }) as HTMLInputElement;
	expect(active.checked).toBe(initialActive);
	fireEvent.click(active);
	fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events/7", expect.objectContaining({
		method: "POST",
		body: JSON.stringify({ date: "2026-10-12", name: event.name, active: !initialActive, twoDays: false }),
	})));
	await waitFor(() => expect(client.getQueryData(["events"])).toMatchObject([{ ...event, active: !initialActive, ticketCount: 42 }]));
	expect(client.getQueryData(["event", "7"])).toMatchObject({ ...event, active: !initialActive });
});

test.each(["create", "edit"])("the %s form validates both ends of the Moscow date range", mode =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	client.setQueryData(["event", "7"], eventFixture({ id: 7, name: "Original", date: "2026-10-12", active: true }));
	render(<QueryClientProvider client={client}>{mode == "create" ? <CreateEventForm open /> : <EditEventForm eventId={7} open />}</QueryClientProvider>);
	const date = screen.getByLabelText("Дата (МСК)") as HTMLInputElement;
	for (const value of ["1000-01-01", "9999-12-31"])
	{
		fireEvent.change(date, { target: { value } });
		expect(date.checkValidity()).toBe(true);
	}
	for (const value of ["0999-12-31", "10000-01-01"])
	{
		fireEvent.change(date, { target: { value } });
		expect(date.checkValidity()).toBe(false);
	}
});

test.each(["create", "edit"])("the %s form previews the calendar end and rejects a two-day overflow", mode =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	client.setQueryData(["event", "7"], eventFixture({ id: 7, name: "Original", date: "2026-10-12", active: true }));
	const fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	render(<QueryClientProvider client={client}>{mode == "create" ? <CreateEventForm open /> : <EditEventForm eventId={7} open />}</QueryClientProvider>);
	const date = screen.getByLabelText("Дата (МСК)");
	if (mode == "create") fireEvent.change(screen.getByLabelText("Название"), { target: { value: "New event" } });
	fireEvent.change(date, { target: { value: "2026-12-31" } });
	fireEvent.click(screen.getByRole("checkbox", { name: "Мероприятие на два дня" }));
	expect(screen.getByRole("status").textContent).toBe("Окончание: 01.01.2027 (МСК)");
	fireEvent.change(date, { target: { value: "2028-02-28" } });
	expect(screen.getByRole("status").textContent).toBe("Окончание: 29.02.2028 (МСК)");
	fireEvent.change(date, { target: { value: "9999-12-31" } });
	expect(screen.getByRole("alert").textContent).toContain("оба дня должны быть не позднее 31.12.9999");
	fireEvent.click(screen.getByRole("button", { name: mode == "create" ? "Создать" : "Подтвердить" }));
	expect(fetchMock).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("checkbox", { name: "Мероприятие на два дня" }));
	expect(screen.queryByText(/Окончание:/)).toBeNull();
	expect(screen.queryByRole("alert")).toBeNull();
});
