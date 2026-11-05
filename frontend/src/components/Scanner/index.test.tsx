import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Scanner from ".";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("qr-scanner", () => ({ default: class
{
	constructor(...args: unknown[]) { return mocks.create(...args); }
} }));

let rejectStart: (reason: Error) => void;
let scan: (result: { data: string }) => void;
const scanner = { start: vi.fn(), stop: vi.fn(), destroy: vi.fn() };

beforeEach(() =>
{
	vi.clearAllMocks();
	scanner.start.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectStart = reject; }));
	mocks.create.mockImplementation((_video, callback) => { scan = callback; return scanner; });
});
afterEach(cleanup);

test("a rejected camera start after unmount destroys the scanner without calling an obsolete error callback", async () =>
{
	const error = vi.fn();
	const view = render(<Scanner onScan={vi.fn()} onCameraError={error} />);
	expect(scanner.start).toHaveBeenCalledOnce();
	view.unmount();
	expect(scanner.destroy).toHaveBeenCalledOnce();
	await act(async () => { rejectStart(new Error("late camera rejection")); });
	expect(error).not.toHaveBeenCalled();
});

test("active changes cancel the old start, stop the camera and allow the current start to report an error", async () =>
{
	const error = vi.fn();
	const props = { onScan: vi.fn(), onCameraError: error };
	const view = render(<Scanner {...props} />);
	const rejectOld = rejectStart;
	view.rerender(<Scanner {...props} active={false} />);
	expect(scanner.stop).toHaveBeenCalledOnce();
	view.rerender(<Scanner {...props} active />);
	expect(scanner.start).toHaveBeenCalledTimes(2);
	await act(async () => { rejectOld(new Error("old start")); });
	expect(error).not.toHaveBeenCalled();
	await act(async () => { rejectStart(new Error("current start")); });
	expect(error).toHaveBeenCalledOnce();
	expect(scanner.destroy).not.toHaveBeenCalled();
});

test("changing callbacks preserves the camera instance and uses the latest scan and error callbacks", async () =>
{
	const oldScan = vi.fn(), oldError = vi.fn(), newScan = vi.fn(), newError = vi.fn();
	const view = render(<Scanner onScan={oldScan} onCameraError={oldError} />);
	view.rerender(<Scanner onScan={newScan} onCameraError={newError} />);
	scan({ data: "TICKET" });
	expect(oldScan).not.toHaveBeenCalled();
	expect(newScan).toHaveBeenCalledWith("TICKET");
	await act(async () => { rejectStart(new Error("current start")); });
	expect(oldError).not.toHaveBeenCalled();
	expect(newError).toHaveBeenCalledOnce();
	expect(mocks.create).toHaveBeenCalledOnce();
	expect(scanner.start).toHaveBeenCalledOnce();
});
