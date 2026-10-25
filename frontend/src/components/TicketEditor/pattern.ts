import { type TicketPattern, type TicketPatternObject } from "./types";

const objectTypes = ["qr", "code", "name", "promo", "price"] as const;

function record(value: unknown): Record<string, unknown>
{
	return value != null && typeof value == "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown, nonnegative = false)
{
	return typeof value == "number" && Number.isFinite(value) && (!nonnegative || value >= 0) ? value : 0;
}

export function normalizePattern(value: unknown): TicketPattern
{
	const data = record(value);
	const objects = Array.isArray(data.objects) ? data.objects.map(record) : [];
	return {
		width: number(data.width, true),
		height: number(data.height, true),
		objects: objectTypes.map(type =>
		{
			const obj = objects.find(obj => obj.type == type) ?? {};
			return {
				type, x: number(obj.x), y: number(obj.y), w: number(obj.w, true), h: number(obj.h, true),
				c: typeof obj.c == "string" && /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(obj.c) ? obj.c : "#000000",
				f: typeof obj.f == "number" && Number.isSafeInteger(obj.f) && obj.f >= -1 ? obj.f : -1,
			} satisfies TicketPatternObject;
		}),
	};
}
