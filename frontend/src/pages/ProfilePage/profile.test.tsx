import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import ProfilePage from ".";
import { createEmptyUser } from "../../api/user";

vi.mock("../../components/edit/ChangePasswordForm", () => ({ default: () => null }));

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
	const user = { ...createEmptyUser(), auth: true, id: 1, name: "Original" };
	client.setQueryData(["user"], user);
	render(<QueryClientProvider client={client}><MemoryRouter><ProfilePage /></MemoryRouter></QueryClientProvider>);
	return { client, user, input: screen.getByRole("textbox") as HTMLInputElement };
}

test("an external name update preserves the draft and cancellation restores the current server name", async () =>
{
	const { client, user, input } = setup();
	expect(input.value).toBe("Original");
	fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
	fireEvent.change(input, { target: { value: "Draft" } });
	await act(async () => { client.setQueryData(["user"], { ...user, name: "Updated" }); });
	expect(input.value).toBe("Draft");
	fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
	expect(input.value).toBe("Updated");
	expect(input.disabled).toBe(true);
	fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
	expect(input.value).toBe("Updated");
});

test("a failed name save keeps the draft editable and a successful retry closes editing", async () =>
{
	let respond!: (response: Response) => void;
	const fetchMock = vi.fn<typeof fetch>()
		.mockRejectedValueOnce(new Error("Network failed"))
		.mockImplementationOnce(() => new Promise<Response>(resolve => { respond = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { client, input } = setup();
	fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
	fireEvent.change(input, { target: { value: "Draft" } });
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await screen.findByRole("alert");
	expect(input.value).toBe("Draft");
	expect(input.disabled).toBe(false);
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	expect(input.disabled).toBe(true);
	expect((screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement).disabled).toBe(true);
	await act(async () => { respond(new Response(JSON.stringify({ msg: "ok" }))); });
	await screen.findByRole("button", { name: "Изменить" });
	expect(input.value).toBe("Draft");
	expect(input.disabled).toBe(true);
	expect(client.getQueryData(["user"])).toMatchObject({ name: "Draft" });
	expect(fetchMock.mock.calls[1][0]).toBe("/api/user/change_name");
	expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ name: "Draft" });
});
