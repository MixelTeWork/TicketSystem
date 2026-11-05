import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import { eventFixture, ticketResponseFixture } from "../../test/fixtures";
import ScannerPage from ".";

vi.mock("../../utils/useSound", () => ({ default: () => [vi.fn()] }));
vi.mock("../../components/Scanner", () => ({ default: ({ onScan, onCameraError }: { onScan: (code: string) => void, onCameraError: () => void }) => <div data-testid="camera">
	<button onClick={onCameraError}>Camera fails</button><button onClick={() => onScan("ABC")}>Camera reads ABC</button>
</div> }));

const clients: QueryClient[] = [];
const event = eventFixture({ date: "2026-11-05" });
const stamp = "2026-11-05T09:10:11Z";
const checkin = { id: 1, eventDayId: 1, dayOffset: 0, dayDate: event.date, checkedAt: stamp, checkedById: 5, checkedBy: "Билетёр Анна" };

function response(data: unknown, status = 200)
{
	return new Response(JSON.stringify(data), { status });
}

function scanResult(operation: "entry" | "merch", code: string)
{
	return { operation, success: true, errorCode: null, event: null, checkin: operation == "entry" ? checkin : null,
		ticket: ticketResponseFixture({ code, personName: "Посетитель", validDates: [event.date], checkins: operation == "entry" ? [checkin] : [],
			merchIssuedAt: operation == "merch" ? stamp : null, merchIssuedById: operation == "merch" ? 5 : null, merchIssuedBy: operation == "merch" ? "Билетёр Анна" : null }) };
}

function renderScanner(operation: "entry" | "merch" = "entry")
{
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], { id: 5, auth: true, name: "Анна", login: "anna", roles: [], operations: ["scan_tickets"] });
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/scanner/7"]}><Routes><Route path="/scanner/:eventId" element={<ScannerPage operation={operation} />} /></Routes></MemoryRouter></QueryClientProvider>);
	return client;
}

function enterCode(code: string)
{
	fireEvent.click(screen.getByRole("button", { name: "Ручной ввод" }));
	fireEvent.change(screen.getByLabelText("Код билета"), { target: { value: code } });
	fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test.each(["entry", "merch"] as const)("%s repeat is the persistent primary state, retains the original time and sends no new request", async operation =>
{
	const endpoint = operation == "entry" ? "/api/check_ticket" : "/api/issue_merch";
	const success = operation == "entry" ? "Вход разрешён" : "Мерч выдан";
	const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => Promise.resolve(response(
		url == endpoint ? scanResult(operation, JSON.parse(options!.body as string).code) : event,
	)));
	vi.stubGlobal("fetch", fetchMock);
	renderScanner(operation);
	await screen.findByTestId("camera");
	fireEvent.click(screen.getByRole("button", { name: "Начать сканирование" }));
	enterCode("ABC");
	const status = screen.getByRole("status", { name: "Результат проверки" });
	expect(await within(status).findByRole("heading", { name: success })).toBeTruthy();
	expect(within(status).getByText("Сотрудник: Билетёр Анна")).toBeTruthy();
	const originalTime = within(status).getByText(/12:10:11/).textContent;
	expect(screen.queryByTestId("camera")).toBeNull();
	expect(screen.getByRole("button", { name: "Вернуться к камере" })).toBeTruthy();
	// Keep the existing one-second scan debounce before accepting another code.
	await waitFor(() => expect((screen.getByRole("button", { name: "Проверить" }) as HTMLButtonElement).disabled).toBe(false), { timeout: 2000 });
	enterCode("ABC");
	expect(await within(status).findByRole("heading", { name: "Этот билет уже проверен на этом экране" })).toBeTruthy();
	expect(within(status).queryByRole("heading", { name: success })).toBeNull();
	expect(within(status).getByText(`Предыдущий результат: ${success.toLowerCase()}`).classList.contains("success-text")).toBe(false);
	expect(status.querySelector(".success-text")).toBeNull();
	expect(within(status).getByText(/12:10:11/).textContent).toBe(originalTime);
	expect(within(status).getByText("Сотрудник: Билетёр Анна")).toBeTruthy();
	await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
	expect(within(status).getByRole("heading", { name: "Этот билет уже проверен на этом экране" })).toBeTruthy();
	expect(fetchMock.mock.calls.filter(([url]) => url == endpoint)).toHaveLength(1);
	enterCode("NEXT");
	expect(await within(status).findByRole("heading", { name: success })).toBeTruthy();
	expect(within(status).queryByText("Этот билет уже проверен на этом экране")).toBeNull();
	expect(fetchMock.mock.calls.filter(([url]) => url == endpoint)).toHaveLength(2);
});

test("camera failure switches to manual mode and retrying the camera is explicit", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(event)));
	renderScanner();
	await screen.findByTestId("camera");
	fireEvent.click(screen.getByRole("button", { name: "Camera fails" }));
	expect(screen.queryByTestId("camera")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Начать сканирование" }));
	fireEvent.click(screen.getByRole("button", { name: "Ввести код вручную" }));
	expect(screen.getByLabelText("Код билета")).toBeTruthy();
	expect(screen.getByText("Ручной режим")).toBeTruthy();
	fireEvent.keyDown(document, { key: "Escape" });
	expect(screen.queryByTestId("camera")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Вернуться к камере" }));
	expect(screen.getByTestId("camera")).toBeTruthy();
	expect(screen.queryByText("Ручной режим")).toBeNull();
});

test("the same manual code can be retried after a temporary request error", async () =>
{
	let scans = 0;
	vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) =>
	{
		if (url != "/api/check_ticket") return Promise.resolve(response(event));
		scans++;
		return Promise.resolve(scans == 1 ? response({ msg: "Временная ошибка" }, 503) : response(scanResult("entry", "ABC")));
	}));
	renderScanner();
	await screen.findByTestId("camera");
	fireEvent.click(screen.getByRole("button", { name: "Начать сканирование" }));
	enterCode("ABC");
	expect(await screen.findByText("Временная ошибка")).toBeTruthy();
	enterCode("ABC");
	expect(await screen.findByRole("heading", { name: "Вход разрешён" })).toBeTruthy();
	expect(screen.queryByText("Этот билет уже проверен на этом экране")).toBeNull();
	expect(scans).toBe(2);
});
