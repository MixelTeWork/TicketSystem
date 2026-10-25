import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
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
	const form = (open: boolean) => <QueryClientProvider client={client}><EditStaffForm eventId={7} open={open} /></QueryClientProvider>;
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
