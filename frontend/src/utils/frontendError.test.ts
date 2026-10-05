import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

const script = readFileSync("public/frontend-error.js", "utf8");

function setup()
{
	const listeners = new Map<string, (event: any) => void>();
	const fetchMock = vi.fn().mockResolvedValue({ ok: true });
	runInNewContext(script, {
		window: { addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener) },
		fetch: fetchMock,
		Error,
	});
	return { listeners, fetchMock };
}

test("startup errors preserve the backend payload", () =>
{
	const { listeners, fetchMock } = setup();
	const error = new Error("Startup failed");
	listeners.get("error")!({ message: error.message, filename: "/static/main.js", lineno: 4, colno: 2, error });
	expect(fetchMock).toHaveBeenCalledWith("/api/frontend_error", expect.objectContaining({
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ msg: error.message, url: "/static/main.js", line: 4, col: 2, error: { message: error.message, stack: error.stack } }),
	}));
});

test("unhandled rejections retain top-level message and stack", () =>
{
	const { listeners, fetchMock } = setup();
	const error = new Error("Rejected");
	listeners.get("unhandledrejection")!({ reason: error });
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: error.message, stack: error.stack });
	listeners.get("unhandledrejection")!({ reason: "Plain reason" });
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ message: "Plain reason" });
});

test("error reporting failures do not trigger another rejected promise", async () =>
{
	const { listeners, fetchMock } = setup();
	fetchMock.mockRejectedValue(new Error("Offline"));
	listeners.get("unhandledrejection")!({ reason: new Error("Original") });
	await Promise.resolve();
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
