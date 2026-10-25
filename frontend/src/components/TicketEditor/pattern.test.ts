import { expect, test, vi } from "vitest";
import { normalizePattern } from "./pattern";
import { TicketEditor } from "./editor";

test.each([null, {}, [], "invalid", { objects: null }, { objects: [null, 4, [], { type: "unknown" }] }])("invalid patterns receive defaults: %j", value =>
{
	const pattern = normalizePattern(value);
	expect(pattern.width).toBe(0);
	expect(pattern.height).toBe(0);
	expect(pattern.objects.map(obj => obj.type)).toEqual(["qr", "code", "name", "promo", "price"]);
	expect(pattern.objects.every(obj => obj.x == 0 && obj.w == 0 && obj.c == "#000000" && obj.f == -1)).toBe(true);
});

test("normalization preserves valid fields, replaces invalid fields, deduplicates types and leaves the source untouched", () =>
{
	const value = { width: Infinity, height: -1, objects: [
		{ type: "name", x: 10, y: -5, w: NaN, h: "30", c: "broken", f: 1.5 },
		{ type: "code", x: 4, w: 100, h: 20, c: "#abcdef", f: 7 },
		{ type: "code", x: 999 },
	] };
	const pattern = normalizePattern(value);
	expect(pattern.objects.find(obj => obj.type == "name")).toEqual({ type: "name", x: 10, y: -5, w: 0, h: 0, c: "#000000", f: -1 });
	expect(pattern.objects.find(obj => obj.type == "code")).toMatchObject({ x: 4, w: 100, h: 20, c: "#abcdef", f: 7 });
	expect(value.objects[0].c).toBe("broken");
});

test("the editor loads a corrupted saved pattern and exports a normalized copy", async () =>
{
	const qr = vi.spyOn(TicketEditor, "renderQRCode").mockImplementation(() => new Promise(() => {}));
	try
	{
		const editor = new TicketEditor();
		expect(() => editor.setData(null, { objects: [null, { type: "qr", c: "invalid" }] })).not.toThrow();
		expect((await editor.getData("ticket", 7)).pattern).toEqual(normalizePattern(null));
		expect(qr).toHaveBeenCalledWith(expect.any(String), "#000000");
	}
	finally { qr.mockRestore(); }
});
