import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type QrScanner from "qr-scanner";
import Scanner from ".";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("qr-scanner", () => ({ default: class
{
	constructor(...args: unknown[]) { return mocks.create(...args); }
} }));

let rejectStart: (reason: Error) => void;
let scan: (result: { data: string }) => void;
const scanner = { start: vi.fn(), stop: vi.fn(), destroy: vi.fn(), $overlay: document.createElement("div") };
let resize: () => void;
let observe: ReturnType<typeof vi.fn>;
let disconnect: ReturnType<typeof vi.fn>;

beforeEach(() =>
{
	vi.clearAllMocks();
	observe = vi.fn();
	disconnect = vi.fn();
	vi.stubGlobal("ResizeObserver", class
	{
		constructor(callback: () => void) { resize = callback; }
		observe = observe;
		disconnect = disconnect;
	});
	scanner.start.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectStart = reject; }));
	mocks.create.mockImplementation((_video, callback) => { scan = callback; return scanner; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("a rejected camera start after unmount destroys the scanner without calling an obsolete error callback", async () =>
{
	const error = vi.fn();
	const view = render(<Scanner onScan={vi.fn()} onCameraError={error} />);
	expect(scanner.start).toHaveBeenCalledOnce();
	view.unmount();
	expect(scanner.destroy).toHaveBeenCalledOnce();
	expect(disconnect).toHaveBeenCalledOnce();
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

test("resizing the video keeps the target and decoding crop inside its visible area without restarting", () =>
{
	const view = render(<Scanner onScan={vi.fn()} onCameraError={vi.fn()} />);
	const video = view.container.querySelector("video")!;
	let width = 390, height = 500;
	Object.defineProperties(video, {
		videoWidth: { value: 640 }, videoHeight: { value: 480 },
		clientWidth: { get: () => width }, clientHeight: { get: () => height },
		offsetLeft: { value: 0 }, offsetTop: { value: 0 },
	});
	const options = mocks.create.mock.calls[0][2] as { calculateScanRegion: () => QrScanner.ScanRegion };
	const region = options.calculateScanRegion();
	expect(observe).toHaveBeenCalledWith(video);
	for (const [nextWidth, nextHeight] of [[390, 500], [390, 180], [180, 390], [800, 150]])
	{
		width = nextWidth; height = nextHeight;
		act(() => resize());
		const scale = Math.max(width / 640, height / 480);
		const size = region.width! * scale;
		expect(size).toBeLessThan(Math.min(width, height));
		expect(size).toBeCloseTo(Math.min(width, height) * 2 / 3, 0);
		expect(parseFloat(scanner.$overlay.style.width)).toBeCloseTo(size);
		expect(parseFloat(scanner.$overlay.style.height)).toBeCloseTo(size);
		expect(parseFloat(scanner.$overlay.style.left)).toBeCloseTo((width - size) / 2);
		expect(parseFloat(scanner.$overlay.style.top)).toBeCloseTo((height - size) / 2);
		expect(Math.abs(region.x! + region.width! / 2 - 320)).toBeLessThanOrEqual(.5);
		expect(Math.abs(region.y! + region.height! / 2 - 240)).toBeLessThanOrEqual(.5);
	}
	expect(mocks.create).toHaveBeenCalledOnce();
	expect(scanner.start).toHaveBeenCalledOnce();
	expect(scanner.stop).not.toHaveBeenCalled();
});
