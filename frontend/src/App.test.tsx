import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { eventFixture } from "./test/fixtures";
import App from "./App";
import { createQueryClient } from "./api/queryClient";

vi.mock("./utils/scrollToTop", () => ({ default: () => null }));
vi.mock("./components/Scanner", () => ({ default: () => <div data-testid="camera" /> }));
vi.mock("./utils/useSound", () => ({ default: () => [vi.fn()] }));

const clients: QueryClient[] = [];
const usher = { id: 5, name: "Usher", login: "usher", roles: ["Билетёр"], operations: ["scan_tickets"] };
const event = eventFixture({ name: "Assigned event", date: "2026-10-11" });

function response(data: unknown, status = 200)
{
	return new Response(JSON.stringify(data), { status });
}

function renderApp(path: string, user = usher)
{
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], { ...user, auth: true });
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
	return client;
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test.each(["/scanner", "/scanner/7"])("requires login for %s", async path =>
{
	const fetchMock = vi.fn().mockResolvedValue(response({ msg: "Unauthorized" }, 401));
	vi.stubGlobal("fetch", fetchMock);
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
	expect(await screen.findByRole("button", { name: "Войти" })).toBeTruthy();
	expect(screen.queryByTestId("camera")).toBeNull();
	expect(fetchMock.mock.calls.some(([url]) => url == "/api/events" || url.startsWith("/api/scanner_events/"))).toBe(false);
});

test("returns to the scanner after logging in through a direct link", async () =>
{
	const fetchMock = vi.fn().mockImplementation((url: string) =>
		Promise.resolve(url == "/api/auth" ? response(usher) : url == "/api/scanner_events/7" ? response(event) : response({ msg: "Unauthorized" }, 401)),
	);
	vi.stubGlobal("fetch", fetchMock);
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/scanner/7"]}><App /></MemoryRouter></QueryClientProvider>);
	const submit = await screen.findByRole("button", { name: "Войти" });
	fireEvent.change(screen.getByLabelText("Логин"), { target: { value: "usher" } });
	fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "password" } });
	fireEvent.click(submit);
	expect(await screen.findByTestId("camera")).toBeTruthy();
	expect(fetchMock.mock.calls.some(([url]) => url == "/api/scanner_events/7")).toBe(true);
});

test("usher home exposes the scanner without management navigation", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([event])));
	renderApp("/");
	expect((await screen.findByRole("link", { name: "Сканер" })).getAttribute("href")).toBe("/scanner/7");
	expect(screen.queryByRole("link", { name: "Мероприятия" })).toBeNull();
	expect(screen.queryByRole("link", { name: "Сотрудники" })).toBeNull();
});

test.each(["/events", "/events/7", "/events/7/tickets", "/staff", "/scanner/7"])("blocks %s without the required permission", async path =>
{
	const fetchMock = vi.fn().mockResolvedValue(response({}));
	vi.stubGlobal("fetch", fetchMock);
	renderApp(path, { ...usher, operations: path.startsWith("/scanner") ? [] : usher.operations });
	expect(await screen.findByText(/недостатточно прав/)).toBeTruthy();
	expect(screen.queryByTestId("camera")).toBeNull();
	expect(fetchMock.mock.calls.some(([url]) => url == "/api/events" || url.startsWith("/api/scanner_events/"))).toBe(false);
});

test("lists assigned scanner events with direct scanner links", async () =>
{
	const fetchMock = vi.fn().mockResolvedValue(response([event]));
	vi.stubGlobal("fetch", fetchMock);
	renderApp("/scanner");
	const link = await screen.findByRole("link", { name: "Сканер" });
	expect(link.getAttribute("href")).toBe("/scanner/7");
	expect(fetchMock).toHaveBeenCalledWith("/api/events", expect.objectContaining({ method: "GET" }));
	expect(screen.queryByRole("button", { name: "Добавить" })).toBeNull();
});

test("revoked access hides even a previously cached scanner event", async () =>
{
	const fetchMock = vi.fn().mockResolvedValue(response({ msg: "Forbidden" }, 403));
	vi.stubGlobal("fetch", fetchMock);
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], { ...usher, auth: true });
	client.setQueryData(["scanner_event", "7"], { status: "active", event });
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/scanner/7"]}><App /></MemoryRouter></QueryClientProvider>);
	expect(screen.queryByTestId("camera")).toBeNull();
	expect(await screen.findByText(/недостатточно прав/)).toBeTruthy();
	expect(screen.queryByTestId("camera")).toBeNull();
	expect(screen.queryByText("Assigned event")).toBeNull();
});

test("an expired scanner session returns to login without a redirect loop", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ msg: "Unauthorized" }, 401)));
	const client = renderApp("/scanner/7");
	expect(await screen.findByRole("button", { name: "Войти" })).toBeTruthy();
	await waitFor(() => expect(client.getQueryData(["user"])).toMatchObject({ auth: false }));
	expect(screen.queryByTestId("camera")).toBeNull();
});

test.each([401, 403])("a scan rejected with %s closes the active scanner", async status =>
{
	let scans = 0;
	const fetchMock = vi.fn().mockImplementation((url: string) =>
	{
		if (url == "/api/check_ticket")
		{
			scans++;
			return Promise.resolve(response({ msg: status == 401 ? "Unauthorized" : "No permission" }, status));
		}
		return Promise.resolve(scans == 0 ? response(event) : response({ msg: "Forbidden" }, 403));
	});
	vi.stubGlobal("fetch", fetchMock);
	renderApp("/scanner/7");
	await screen.findByTestId("camera");
	fireEvent.click(screen.getByRole("button", { name: "Ручной ввод" }));
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "TICKET" } });
	fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
	if (status == 401) expect(await screen.findByRole("button", { name: "Войти" })).toBeTruthy();
	else expect(await screen.findByText(/недостатточно прав/)).toBeTruthy();
	expect(scans).toBe(1);
	expect(screen.queryByTestId("camera")).toBeNull();
});

test("redirects a signed-out visitor to the login page", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Unauthorized" }), { status: 401 })));
	const client = createQueryClient({ queries: { retry: false } });

	render(
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={["/"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	);

	expect(await screen.findByRole("button", { name: "Войти" }, { timeout: 4000 })).toBeTruthy();
	client.clear();
});

test("an expired management session returns to the original URL after login", async () =>
{
	const manager = { ...usher, operations: ["page_events"] };
	let signedIn = false;
	vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) =>
	{
		if (url == "/api/auth")
		{
			signedIn = true;
			return Promise.resolve(response(manager));
		}
		return Promise.resolve(signedIn ? response([]) : response({ msg: "Unauthorized" }, 401));
	}));
	const client = createQueryClient();
	clients.push(client);
	client.setQueryData(["user"], { ...manager, auth: true });
	function CurrentLocation()
	{
		const location = useLocation();
		return <div data-testid="location">{location.pathname + location.search}</div>;
	}
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/events?sort=date"]}><App /><CurrentLocation /></MemoryRouter></QueryClientProvider>);
	const submit = await screen.findByRole("button", { name: "Войти" });
	expect(screen.getByTestId("location").textContent).toBe("/auth");
	fireEvent.change(screen.getByLabelText("Логин"), { target: { value: "manager" } });
	fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "password" } });
	fireEvent.click(submit);
	await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/events?sort=date"));
	expect(screen.queryByRole("button", { name: "Войти" })).toBeNull();
});

test("a rejected login displays its error and keeps the login form", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response({ msg: "Неверный логин или пароль" }, 401))));
	const client = createQueryClient();
	clients.push(client);
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/auth"]}><App /></MemoryRouter></QueryClientProvider>);
	const submit = await screen.findByRole("button", { name: "Войти" });
	fireEvent.change(screen.getByLabelText("Логин"), { target: { value: "wrong" } });
	fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "wrong" } });
	fireEvent.click(submit);
	expect(await screen.findByText("Неверный логин или пароль")).toBeTruthy();
	expect(screen.getByLabelText("Логин")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();
});

test("an unauthorized text log request also returns to login", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ msg: "Unauthorized" }, 401)));
	renderApp("/d", { ...usher, operations: ["page_debug"] });
	fireEvent.click(await screen.findByRole("button", { name: "Log errors" }));
	expect(await screen.findByRole("button", { name: "Войти" })).toBeTruthy();
});
