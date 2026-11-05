import { expect, test, vi } from "vitest";
import { drawTicket } from "./renderer";
import { normalizePattern } from "./pattern";
import { ticketFixture } from "../../test/fixtures";

test.each([[0, "0P"], [null, ""], [1200, "1200P"]] as const)("renders ticket price %s without treating zero as missing", (price, text) =>
{
	const fillText = vi.fn();
	const ctx = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), fillText } as unknown as CanvasRenderingContext2D;
	const ticket = ticketFixture({ dayOffsets: [0], validDates: [], checkins: [], merchIssuedAt: null, merchIssuedById: null, merchIssuedBy: null, id: 1, code: "ABC", type: "Standard", typeId: 2, eventId: 7, createdDate: new Date(), authOnPltf: false, price });
	const pattern = normalizePattern({ objects: [{ type: "price", x: 10, y: 20, w: 200, h: 30 }] });
	drawTicket(ctx, document.createElement("img"), pattern, null, ticket, {
		transform: { x: 0, y: 0, s: 1 }, selected: -1,
		drawing: { sx: 0, sy: 0, ex: 0, ey: 0, active: false, type: null },
	});
	expect(fillText).toHaveBeenCalledWith(text, 10, 44, 200);
});
