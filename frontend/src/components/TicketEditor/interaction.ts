import { pointInRect, rectZone, resizeCursor, type RectZone } from "./geometry";
import type { Cursor, EditorRenderState, InspectorInputFunc, InspectorSetFunc, MoveMode, TicketPattern, TicketPatternObject, TicketPatternObjectType } from "./types";

export class EditorInteraction
{
	private transform = { x: 0, y: 0, s: 1 };
	private moving = { sx: 0, sy: 0, vx: 0, vy: 0, vw: 0, vh: 0, mode: null as MoveMode };
	private drawing = { sx: 0, sy: 0, ex: 0, ey: 0, active: false, type: null as TicketPatternObjectType | null };
	private resizing = { dir: [0, 0] as RectZone, keepAspect: false, aspect: 1 };
	private canvasSize = { w: 0, h: 0 };
	private selected = -1;
	private readonly selectionBorder = 16;

	constructor(
		private img: { width: number, height: number },
		private data: TicketPattern,
		private reRenderQR: () => void,
		private setCursor: (cursor: Cursor) => void,
		private setInspector: InspectorSetFunc,
		private viewMode: boolean,
	) {}

	public fitToView()
	{
		const m = this.viewMode ? 0 : 100;
		this.transform.s = Math.min((this.canvasSize.w - m) / this.img.width, (this.canvasSize.h - m) / this.img.height);
		this.transform.x = (this.canvasSize.w - this.img.width * this.transform.s) / 2;
		this.transform.y = (this.canvasSize.h - this.img.height * this.transform.s) / 2;
		this.restrictView();
	}
	public inspectorInput: InspectorInputFunc = <T extends keyof TicketPatternObject>(field: T, value: TicketPatternObject[T]) =>
	{
		if (this.selected < 0) return;
		const obj = this.data.objects[this.selected];
		if ((field == "x" || field == "y" || field == "w" || field == "h") && typeof value == "number")
		{
			if (!Number.isFinite(value)) return;
			Object.assign(obj, { [field]: Math.max(value, 0) });
			if (obj.type == "qr")
			{
				if (field == "w") obj.h = obj.w;
				if (field == "h") obj.w = obj.h;
			}
		}
		else if (field == "f" && typeof value == "number")
		{
			if (!Number.isFinite(value)) return;
			obj.f = value;
		}
		else if (field == "c" && typeof value == "string")
		{
			obj.c = value;
			if (obj.type == "qr") this.reRenderQR();
		}
		this.setInspector(obj);
	};
	public setCanvasSize(size: { w: number, h: number })
	{
		this.canvasSize = size;
	}
	public get renderState(): EditorRenderState
	{
		return { transform: this.transform, selected: this.selected, drawing: this.drawing };
	}

	public getSelectedObject()
	{
		if (this.selected < 0) return null;
		return this.data.objects[this.selected];
	}

	public drawObject(obj: TicketPatternObjectType)
	{
		this.drawing.type = obj;

		this.selected = -1;
		this.setInspector(null);
	}

	public deleteSelectedObj()
	{
		if (this.selected < 0)
			return false;

		const obj = this.data.objects[this.selected];
		obj.x = 0;
		obj.y = 0;
		obj.w = 0;
		obj.h = 0;
		this.selected = -1;
		this.setInspector(null);
		return true;
	}

	public resetZoom()
	{
		this.transform.s = 1;
		this.restrictView();
	}

	public mouseDown(x: number, y: number, button: number)
	{
		this.moving.sx = x;
		this.moving.sy = y;
		if (button == 2)
		{
			this.moving.vx = this.transform.x;
			this.moving.vy = this.transform.y;
			this.moving.mode = "view";
			this.setCursor("move");
			return;
		}
		if (button == 0)
		{
			if (this.drawing.type)
			{
				[this.drawing.sx, this.drawing.sy] = this.pointToWorld(x, y);
				this.drawing.active = true;
				return;
			}
			for (let i = 0; i < this.data.objects.length; i++)
			{
				const obj = this.data.objects[i];
				const [wx, wy] = this.pointToWorld(x, y);
				let resize = false;
				if (this.selected == i)
				{
					this.resizing.dir = rectZone(wx, wy, obj, this.selectionBorder / this.transform.s);
					resize = this.resizing.dir[0] != 0 || this.resizing.dir[1] != 0;
					this.resizing.aspect = obj.h / obj.w;
					this.resizing.keepAspect = obj.type == "qr";
				}
				if (pointInRect(wx, wy, obj) || resize)
				{
					this.selected = i;
					this.setInspector(obj);
					this.moving.vx = obj.x;
					this.moving.vy = obj.y;
					this.moving.vw = obj.w;
					this.moving.vh = obj.h;
					this.moving.mode = resize ? "resize" : "obj";
					this.setCursor(resize ? resizeCursor(this.resizing.dir) : "move");
					return true;
				}
			}
			const redraw = this.selected >= 0;
			this.selected = -1;
			this.setInspector(null);
			return redraw;
		}
	}

	public mouseMove(x: number, y: number)
	{
		if (this.moving.mode == "view")
		{
			this.transform.x = this.moving.vx + (x - this.moving.sx);
			this.transform.y = this.moving.vy + (y - this.moving.sy);
			this.restrictView();
			return true;
		}
		if (this.moving.mode == "obj" && this.selected >= 0)
		{
			const obj = this.data.objects[this.selected];
			obj.x = this.moving.vx + (x - this.moving.sx) / this.transform.s;
			obj.y = this.moving.vy + (y - this.moving.sy) / this.transform.s;
			obj.x = Math.round(obj.x);
			obj.y = Math.round(obj.y);
			this.setInspector(obj);
			return true;
		}
		if (this.moving.mode == "resize" && this.selected >= 0)
		{
			const obj = this.data.objects[this.selected];
			const dx = (x - this.moving.sx) / this.transform.s;
			const dy = (y - this.moving.sy) / this.transform.s;
			const [rx, ry] = this.resizing.dir;
			if (this.resizing.keepAspect)
			{
				if (rx > 0)
				{
					obj.w = this.moving.vw + dx;
					obj.h = obj.w * this.resizing.aspect;
					if (ry < 0)
						obj.y = this.moving.vy - (obj.h - this.moving.vh);
					if (ry == 0)
						obj.y = this.moving.vy - (obj.h - this.moving.vh) / 2;
				}
				if (rx < 0)
				{
					obj.x = this.moving.vx + dx;
					obj.w = this.moving.vw - dx;
					obj.h = obj.w * this.resizing.aspect;
					if (ry < 0)
						obj.y = this.moving.vy - (obj.h - this.moving.vh);
					if (ry == 0)
						obj.y = this.moving.vy - (obj.h - this.moving.vh) / 2;
				}
				if (rx == 0)
				{
					if (ry > 0)
					{
						obj.h = this.moving.vh + dy;
					}
					if (ry < 0)
					{
						obj.y = this.moving.vy + dy;
						obj.h = this.moving.vh - dy;
					}
					obj.w = obj.h / this.resizing.aspect;
					obj.x = this.moving.vx - (obj.w - this.moving.vw) / 2;
				}
			}
			else
			{
				if (rx > 0)
				{
					obj.w = this.moving.vw + dx;
				}
				if (rx < 0)
				{
					obj.x = this.moving.vx + dx;
					obj.w = this.moving.vw - dx;
				}
				if (ry > 0)
				{
					obj.h = this.moving.vh + dy;
				}
				if (ry < 0)
				{
					obj.y = this.moving.vy + dy;
					obj.h = this.moving.vh - dy;
				}
			}
			obj.w = Math.max(obj.w, 5);
			obj.h = Math.max(obj.h, 5);
			obj.x = Math.round(obj.x);
			obj.y = Math.round(obj.y);
			obj.w = Math.round(obj.w);
			obj.h = Math.round(obj.h);
			this.setInspector(obj);
			return true;
		}
		if (this.drawing.active)
		{
			[this.drawing.ex, this.drawing.ey] = this.pointToWorld(x, y);
			return true;
		}
		if (this.selected >= 0)
		{
			const [wx, wy] = this.pointToWorld(x, y);
			const obj = this.data.objects[this.selected];
			const resize = rectZone(wx, wy, obj, this.selectionBorder / this.transform.s);
			if (resize[0] != 0 || resize[1] != 0)
				this.setCursor(resizeCursor(resize));
			else
				this.setCursor("default");
		}
	}

	public mouseUp(x: number, y: number)
	{
		this.moving.mode = null;
		this.setCursor("default");
		if (this.drawing.active)
		{
			[this.drawing.ex, this.drawing.ey] = this.pointToWorld(x, y);
			const obj = this.data.objects.find(v => v.type == this.drawing.type);
			if (!obj)
			{
				console.error("Ticket editor: drawing obj not found");
				return false;
			}
			obj.x = this.drawing.sx;
			obj.y = this.drawing.sy;
			obj.w = this.drawing.ex - this.drawing.sx;
			obj.h = this.drawing.ey - this.drawing.sy;
			if (obj.w < 0)
			{
				obj.x += obj.w;
				obj.w *= -1;
			}
			if (obj.h < 0)
			{
				obj.y += obj.h;
				obj.h *= -1;
			}
			obj.x = Math.round(obj.x);
			obj.y = Math.round(obj.y);
			obj.w = Math.round(obj.w);
			obj.h = Math.round(obj.h);
			this.drawing.active = false;
			this.drawing.type = null;
			if (obj.type == "qr")
				obj.h = obj.w;
			return true;
		}
	}

	public wheel(x: number, y: number, d: number)
	{
		const X = (x - this.transform.x) / this.transform.s;
		const Y = (y - this.transform.y) / this.transform.s;

		if (d > 0)
			this.transform.s /= 1.1;
		else
			this.transform.s *= 1.1;
		const m = 200;
		this.transform.s = Math.max(this.transform.s, Math.min((this.canvasSize.w - m) / this.img.width, (this.canvasSize.h - m) / this.img.height));

		this.transform.x = x - X * this.transform.s;
		this.transform.y = y - Y * this.transform.s;
		this.restrictView();
		return true;
	}

	private restrictView()
	{
		const m = 100;
		const iw = this.img.width * this.transform.s;
		const ih = this.img.height * this.transform.s;
		if (iw > this.canvasSize.w)
			this.transform.x = Math.min(Math.max(this.transform.x, -iw + this.canvasSize.w - m), m);
		else
			this.transform.x = Math.min(Math.max(this.transform.x, -iw + m), this.canvasSize.w - m);
		if (ih > this.canvasSize.h)
			this.transform.y = Math.min(Math.max(this.transform.y, -ih + this.canvasSize.h - m), m);
		else
			this.transform.y = Math.min(Math.max(this.transform.y, -ih + m), this.canvasSize.h - m);
	}

	private pointToWorld(x: number, y: number)
	{
		return [(x - this.transform.x) / this.transform.s, (y - this.transform.y) / this.transform.s];
	}

}

