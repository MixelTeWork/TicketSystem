import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import EditStaffForm from "./EditStaffForm";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

test("a refreshed assignment list does not overwrite a draft but reopening reloads it", async () =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const anna = { id: 1, name: "Anna", roles: ["Clerk"], login: "anna", operations: [] };
	const ilya = { ...anna, id: 2, name: "Ilya", login: "ilya" };
	client.setQueryData(["staff"], [anna, ilya]);
	client.setQueryData(["staff", "7"], [anna]);
	client.setQueryData(["user"], { auth: true, operations: [] });
	const form = (open: boolean) => <QueryClientProvider client={client}><MemoryRouter><EditStaffForm eventId={7} open={open} /></MemoryRouter></QueryClientProvider>;
	const view = render(form(true));
	fireEvent.click(screen.getByRole("button", { name: "Закрыть доступ: Anna" }));
	fireEvent.change(screen.getByLabelText("Сотрудник"), { target: { value: "2" } });
	fireEvent.click(screen.getByRole("button", { name: "Добавить доступ" }));
	await act(async () => { client.setQueryData(["staff", "7"], [{ ...anna }]); });
	expect(screen.getByRole("button", { name: "Закрыть доступ: Ilya" })).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Закрыть доступ: Anna" })).toBeNull();
	view.rerender(form(false));
	view.rerender(form(true));
	expect(screen.getByRole("button", { name: "Закрыть доступ: Anna" })).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Закрыть доступ: Ilya" })).toBeNull();
});

test.each([
	{ operations: ["page_staff", "add_staff"] }, { operations: ["page_staff"] }, { operations: ["add_staff"] }, { operations: [] },
])("an empty staff list gives a permitted next step with permissions $operations", ({ operations }) =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	client.setQueryData(["staff"], []);
	client.setQueryData(["staff", "7"], []);
	client.setQueryData(["user"], { auth: true, operations });
	const close = vi.fn();
	render(<QueryClientProvider client={client}><MemoryRouter><EditStaffForm eventId={7} open close={close} /></MemoryRouter></QueryClientProvider>);
	expect(screen.getByText("Сначала добавьте сотрудника")).toBeTruthy();
	expect(screen.queryByText("Нет назначенных сотрудников")).toBeNull();
	expect(screen.queryByText("Все сотрудники уже добавлены")).toBeNull();
	expect(screen.queryByRole("button", { name: "Добавить доступ" })).toBeNull();
	const link = screen.queryByRole("link", { name: "Перейти в раздел «Сотрудники»" });
	if (operations.includes("page_staff") && operations.includes("add_staff"))
	{
		expect(link?.getAttribute("href")).toBe("/staff");
		fireEvent.click(link!);
		expect(close).toHaveBeenCalledTimes(1);
	}
	else
	{
		expect(link).toBeNull();
		expect(screen.getByText("Обратитесь к организатору, который может добавлять сотрудников.")).toBeTruthy();
	}
});

test("all assigned is distinct from having no staff and removing an assignment makes it available", () =>
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	const anna = { id: 1, name: "Anna", roles: ["Clerk"], login: "anna", operations: [] };
	client.setQueryData(["staff"], [anna]);
	client.setQueryData(["staff", "7"], [anna]);
	client.setQueryData(["user"], { auth: true, operations: [] });
	render(<QueryClientProvider client={client}><MemoryRouter><EditStaffForm eventId={7} open /></MemoryRouter></QueryClientProvider>);
	expect(screen.getByText("Все сотрудники уже добавлены")).toBeTruthy();
	expect(screen.queryByText("Сначала добавьте сотрудника")).toBeNull();
	expect((screen.getByRole("button", { name: "Добавить доступ" }) as HTMLButtonElement).disabled).toBe(true);
	fireEvent.click(screen.getByRole("button", { name: "Закрыть доступ: Anna" }));
	expect(screen.getByText("Нет назначенных сотрудников")).toBeTruthy();
	expect(screen.queryByText("Все сотрудники уже добавлены")).toBeNull();
	expect((screen.getByRole("button", { name: "Добавить доступ" }) as HTMLButtonElement).disabled).toBe(false);
});
