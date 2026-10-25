import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import CreateFontForm from "./CreateFontForm";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

function setup()
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	clients.push(client);
	const close = vi.fn();
	const form = (open = true) => <QueryClientProvider client={client}><CreateFontForm open={open} close={close} /></QueryClientProvider>;
	const view = render(form());
	return { view, form, close, name: screen.getByLabelText("Название") as HTMLInputElement, file: screen.getByLabelText("Файл") as HTMLInputElement };
}

test("choosing a font proposes its name and submits the manually edited name", async () =>
{
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, name: "Custom", type: "woff2" })));
	vi.stubGlobal("fetch", fetchMock);
	const { name, file, close } = setup();
	const font = new File(["font"], "My.Font.woff2");
	fireEvent.change(file, { target: { files: [font] } });
	expect(name.value).toBe("My.Font");
	fireEvent.change(name, { target: { value: "Custom" } });
	fireEvent.submit(screen.getByRole("button", { name: "Создать" }).closest("form")!);
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	const body = fetchMock.mock.calls[0][1].body as FormData;
	expect(body.get("name")).toBe("Custom");
	expect(body.get("type")).toBe("woff2");
	expect(body.get("font")).toBe(font);
});

test("reopening clears the name and validation error of the previous file", () =>
{
	const { view, form, name, file } = setup();
	fireEvent.change(file, { target: { files: [new File(["invalid"], "wrong.txt")] } });
	expect(file.validity.customError).toBe(true);
	expect(name.value).toBe("wrong");
	view.rerender(form(false));
	view.rerender(form());
	expect(name.value).toBe("");
	expect(file.value).toBe("");
	expect(file.validity.customError).toBe(false);
	fireEvent.change(file, { target: { files: [new File(["valid"], "Valid.ttf")] } });
	expect(name.value).toBe("Valid");
	expect(file.validity.customError).toBe(false);
});
