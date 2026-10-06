import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import CreateStaffForm from "./CreateStaffForm";
import CreateManagerForm from "./CreateManagerForm";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test.each([
	{ Component: CreateStaffForm, url: "/api/staff", credentialsTitle: "Данные сотрудника" },
	{ Component: CreateManagerForm, url: "/api/managers", credentialsTitle: "Данные организатора" },
])("$url sanitizes login, blocks duplicate submissions and preserves credentials on close", async ({ Component, url, credentialsTitle }) =>
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	let respond!: (response: Response) => void;
	const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(resolve => { respond = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const close = vi.fn();
	const form = (open: boolean) => <QueryClientProvider client={client}><Component open={open} close={close} /></QueryClientProvider>;
	const view = render(form(true));
	fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "User" } });
	fireEvent.change(screen.getByLabelText("Логин"), { target: { value: "user_12!Я A" } });
	expect((screen.getByLabelText("Логин") as HTMLInputElement).value).toBe("user_12");
	const button = screen.getByRole("button", { name: "Добавить" });
	fireEvent.click(button);
	await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
	fireEvent.submit(button.closest("form")!);
	expect(fetchMock).toHaveBeenCalledOnce();
	expect(fetchMock.mock.calls[0][0]).toBe(url);
	expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ name: "User", login: "user_12" });
	await act(async () =>
	{
		respond(new Response(JSON.stringify({ id: 5, name: "User", login: "user_12", password: "temporary", roles: [], operations: [] })));
	});
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	view.rerender(form(false));
	expect(screen.getByText(credentialsTitle)).toBeDefined();
	expect(screen.getByText("Пароль: temporary")).toBeDefined();
	view.rerender(form(true));
	expect((screen.getByLabelText("Имя") as HTMLInputElement).value).toBe("");
	expect((screen.getByLabelText("Логин") as HTMLInputElement).value).toBe("");
	expect((button as HTMLButtonElement).disabled).toBe(false);
});
