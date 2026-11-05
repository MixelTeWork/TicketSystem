import { expect, test, vi } from "vitest";
import { EditorInteraction } from "./interaction";
import { normalizePattern } from "./pattern";

test("selection, dragging, inspector edits and deletion preserve QR proportions", () =>
{
	const pattern = normalizePattern({ objects: [{ type: "qr", w: 100, h: 100 }] });
	const renderQr = vi.fn();
	const interaction = new EditorInteraction({ width: 1000, height: 500 }, pattern, renderQr, vi.fn(), vi.fn(), false);
	interaction.setCanvasSize({ w: 1000, h: 500 });
	interaction.mouseDown(10, 10, 0);
	interaction.mouseMove(30, 40);
	interaction.mouseUp(30, 40);
	expect(interaction.getSelectedObject()).toMatchObject({ x: 20, y: 30, w: 100, h: 100 });
	interaction.inspectorInput("w", 70);
	interaction.inspectorInput("c", "#ffffff");
	expect(interaction.getSelectedObject()).toMatchObject({ w: 70, h: 70, c: "#ffffff" });
	expect(renderQr).toHaveBeenCalledOnce();
	interaction.deleteSelectedObj();
	expect(pattern.objects[0]).toMatchObject({ w: 0, h: 0 });
	expect(interaction.getSelectedObject()).toBeNull();
});
