import { afterEach, expect, test, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { EditorResources } from "./resources";
import { normalizePattern } from "./pattern";

const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
afterEach(() =>
{
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
	else Reflect.deleteProperty(document, "fonts");
});

function setup(renderQr = vi.fn<() => Promise<HTMLImageElement>>().mockResolvedValue(document.createElement("img")))
{
	const images: HTMLImageElement[] = [];
	vi.stubGlobal("Image", vi.fn(function ()
	{
		const image = document.createElement("img");
		images.push(image);
		return image;
	}));
	const changed = vi.fn();
	const resources = new EditorResources(changed, renderQr);
	resources.setFontTypes({}, normalizePattern(null));
	return { resources, images, changed };
}

test("failed QR generation reports an error, discards stale QR data, and can recover", async () =>
{
	const renderQr = vi.fn<() => Promise<HTMLImageElement>>().mockRejectedValueOnce(new Error("QR failed")).mockResolvedValue(document.createElement("img"));
	const { resources, images } = setup(renderQr);
	resources.setImage(7);
	images[0].dispatchEvent(new Event("load"));
	resources.setQr("old", "#000000");
	await waitFor(() => expect(resources.error).toBe("Не удалось создать QR-код билета"));
	expect(resources.ready).toBe(false);
	expect(resources.qr).toBeNull();
	resources.setQr("new", "#000000");
	await waitFor(() => expect(resources.ready).toBe(true));
	expect(resources.error).toBeNull();
	resources.reset();
});

test("late images and QR failures cannot replace resources of a newer ticket", async () =>
{
	let rejectOld!: (reason: Error) => void;
	const newQr = document.createElement("img");
	const renderQr = vi.fn<() => Promise<HTMLImageElement>>()
		.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
		.mockResolvedValueOnce(newQr);
	const { resources, images } = setup(renderQr);
	resources.setImage(1);
	resources.setQr("old", "#000000");
	resources.setImage(2);
	resources.setQr("new", "#000000");
	images[1].dispatchEvent(new Event("load"));
	await waitFor(() => expect(resources.ready).toBe(true));
	images[0].dispatchEvent(new Event("load"));
	rejectOld(new Error("Old QR failed"));
	await Promise.resolve();
	await Promise.resolve();
	expect(resources.image).toBe(images[1]);
	expect(resources.qr).toBe(newQr);
	expect(resources.error).toBeNull();
	resources.reset();
});

test("reset releases a selected image URL and ignores its delayed result", async () =>
{
	const create = vi.fn(() => "blob:ticket");
	const revoke = vi.fn();
	vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
	const { resources, images, changed } = setup();
	resources.setImage(new File(["image"], "ticket.png"));
	resources.reset();
	changed.mockClear();
	images[0].dispatchEvent(new Event("load"));
	await Promise.resolve();
	await Promise.resolve();
	expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:ticket");
	expect(resources.image).toBeNull();
	expect(resources.imageFile).toBeNull();
	expect(changed).not.toHaveBeenCalled();
});

test("font loading failures block export, allow retry, and ignore completion after reset", async () =>
{
	const fontSet = { add: vi.fn(), delete: vi.fn() };
	Object.defineProperty(document, "fonts", { value: fontSet, configurable: true });
	let finishLoad!: () => void;
	const load = vi.fn()
		.mockRejectedValueOnce(new Error("Font failed"))
		.mockResolvedValueOnce(undefined)
		.mockImplementationOnce(() => new Promise<void>(resolve => { finishLoad = resolve; }));
	vi.stubGlobal("FontFace", vi.fn(function () { return { load }; }));
	const { resources, images, changed } = setup();
	const pattern = normalizePattern({ objects: [{ type: "name", f: 1 }] });
	resources.setImage(7);
	images[0].dispatchEvent(new Event("load"));
	resources.setQr("ticket", "#000000");
	resources.setFontTypes({ 1: "ttf" }, pattern);
	await waitFor(() => expect(resources.error).toBe("Не удалось загрузить шрифт билета"));
	expect(resources.ready).toBe(false);
	expect(fontSet.delete).toHaveBeenCalledOnce();
	resources.updateFonts(pattern);
	await waitFor(() => expect(resources.ready).toBe(true));
	expect(resources.error).toBeNull();
	resources.setFontTypes({ 1: "woff" }, pattern);
	expect(resources.loading).toBe(true);
	resources.reset();
	changed.mockClear();
	finishLoad();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	expect(changed).not.toHaveBeenCalled();
	expect(resources.ready).toBe(false);
});
