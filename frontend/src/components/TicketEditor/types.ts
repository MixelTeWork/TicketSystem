import type { Font } from "../../api/fonts";

export interface FontTypes
{
	[id: number]: Font["type"];
}

export interface TicketPattern
{
	width: number,
	height: number,
	objects: TicketPatternObject[],
}
export interface TicketPatternObject
{
	x: number,
	y: number,
	w: number,
	h: number,
	c: string, // color
	f: number, // font
	type: TicketPatternObjectType,
}
export type TicketPatternObjectType = "qr" | "name" | "promo" | "code" | "price";

export type InspectorSetFunc = (obj: TicketPatternObject | null) => void;
export type InspectorInputFunc = <T extends keyof TicketPatternObject>(field: T, value: TicketPatternObject[T]) => void;

export type MoveMode = null | "view" | "obj" | "resize";
export type Cursor = "default" | "move" | "n-resize" | "e-resize" | "ne-resize" | "nw-resize";


export interface EditorRenderState
{
	transform: { x: number, y: number, s: number };
	selected: number;
	drawing: { sx: number, sy: number, ex: number, ey: number, active: boolean, type: TicketPatternObjectType | null };
}
