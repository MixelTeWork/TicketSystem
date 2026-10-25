import type { Cursor } from "./types";

export interface Rect
{
	x: number,
	y: number,
	w: number,
	h: number,
}

export function pointInRect(x: number, y: number, rect: Rect)
{
	return x > rect.x && x < rect.x + rect.w &&
		y > rect.y && y < rect.y + rect.h;
}

export type RectZone = [number, number];  // [x, y] 1 - bottom, right; -1 = top, left
export function rectZone(x: number, y: number, rect: Rect, border: number): RectZone
{
	const r = [0, 0] as RectZone;

	if (!pointInRect(x, y, { x: rect.x - border, y: rect.y - border, w: rect.w + border * 2, h: rect.h + border * 2 }))
		return r;

	if (Math.abs(x - rect.x) <= border) r[0] = -1;
	if (Math.abs(x - (rect.x + rect.w)) <= border) r[0] = 1;
	if (Math.abs(y - rect.y) <= border) r[1] = -1;
	if (Math.abs(y - (rect.y + rect.h)) <= border) r[1] = 1;

	return r;
}
export function resizeCursor(direction: RectZone): Cursor
{
	const [x, y] = direction;
	if (x == 0)
	{
		if (y == 0) return "default"; // none
		if (y > 0) return "n-resize"; // down
		return "n-resize"; // up
	}
	if (x > 0)
	{
		if (y == 0) return "e-resize"; // right
		if (y > 0) return "nw-resize"; // down-right
		return "ne-resize"; // up-right
	}
	if (x < 0)
	{
		if (y == 0) return "e-resize"; // left
		if (y > 0) return "ne-resize"; // down-left
		return "nw-resize"; // up-left
	}
	return "default"; // none
}

export function unwrapRect({ x, y, w, h }: Rect): [number, number, number, number]
{
	return [x, y, w, h];
}
