import { Font, Ticket } from "../../api/dataTypes";
import type { UpdateTicketTypeData } from "../../api/ticketTypes";
import imagefileToData from "../../utils/imagefileToData";
import QRCode from "qrcode"
import { newFontFace } from "../../utils/useFont";

export class TicketEditor
{
	private editor: Editor | null = null;
	private img: HTMLImageElement | null = null;
	private imgQr = new Image();
	private qrLast = 0;
	private imgFile: File | null = null;
	private data: TicketPattern = { width: 0, height: 0, objects: [] };
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private loadingImg = false;
	private loadingFont = false;
	private loadingFonts: FontFace[] = [];
	private get loading() { return this.loadingImg || this.loadingFont; }
	private ticket: Ticket | null = null;
	private fonts: { id: number, font: FontFace }[] = [];
	private listenerResize = () => this.draw();
	private listenerKeydown = (e: KeyboardEvent) => { if (e.key == "Delete") if (this.editor?.deleteSelectedObj()) this.draw(); };
	private listenerMouseDown = (e: MouseEvent) => { if (this.editor?.mouseDown(e.offsetX, e.offsetY, e.button)) this.draw() };
	private listenerMouseMove = (e: MouseEvent) => { if (this.editor?.mouseMove(e.offsetX, e.offsetY)) this.draw() };
	private listenerMouseUp = (e: MouseEvent) => { if (this.editor?.mouseUp(e.offsetX, e.offsetY, e.button)) this.draw() };
	private listenerContextMenu = (e: MouseEvent) => { e.preventDefault(); };
	private listenerWheel = (e: WheelEvent) => { e.preventDefault(); if (this.editor?.wheel(e.offsetX, e.offsetY, e.deltaY)) this.draw() };
	private inspectorSet: InspectorSetFunc = () => { };

	constructor(private fontTypes: FontTypes | null, init = true, private viewMode = false)
	{
		if (!init || viewMode) return;
		window.addEventListener("resize", this.listenerResize);
		window.addEventListener("keydown", this.listenerKeydown);
	}

	public static renderQRCode(code: string, color: string, callback: (img: HTMLImageElement) => void)
	{
		QRCode.toDataURL(code, { errorCorrectionLevel: "H", scale: 10, margin: 2, color: { light: "#ffffff00", dark: color } }, (e, url) =>
		{
			if (e) console.error(e);
			const img = new Image();
			img.addEventListener("load", () =>
			{
				callback(img);
			});
			img.src = url;
		});
	}

	public setData(image: number | null, data: TicketPattern)
	{
		this.img = null;
		this.imgFile = null;
		if (image != null)
			this.loadImage(image);
		this.data = data || this.createNewData();

		// update data from prev version
		this.data.objects.forEach(v => v.f == undefined ? v.f = -1 : {});

		if (!this.data.objects.find(v => v.type == "code"))
			this.data.objects.push({ type: "code", x: 0, y: 0, w: 0, h: 0, c: "#000000", f: -1 });

		this.editor = null;
		this.reRenderQR();
		this.loadFonts();
		this.draw();
	}
	public setViewTicket(ticket: Ticket)
	{
		this.ticket = ticket;
		this.editor?.setViewTicket(ticket);
		this.reRenderQR();
		this.draw();
	}
	public setNewImage(image: File)
	{
		this.imgFile = image;
		const img = new Image();
		this.img = img;
		this.img.addEventListener("load", () =>
		{
			URL.revokeObjectURL(url);
			this.loadingImg = false;
			this.editor = null;
			this.draw();
		});
		const url = URL.createObjectURL(image)
		this.loadingImg = true;
		this.img.src = url;
	}
	public setImage(image: number | null)
	{
		this.imgFile = null;
		this.img = null;
		if (image != null)
			this.loadImage(image);
	}
	public setCanvas(canvas: HTMLCanvasElement)
	{
		this.removeCanvasListeners();
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.draw();

		if (this.viewMode) return;

		canvas.addEventListener("mousedown", this.listenerMouseDown);
		canvas.addEventListener("mousemove", this.listenerMouseMove);
		canvas.addEventListener("mouseup", this.listenerMouseUp);
		canvas.addEventListener("wheel", this.listenerWheel);
		canvas.addEventListener("contextmenu", this.listenerContextMenu);
	}
	public setInspector(f: InspectorSetFunc)
	{
		this.inspectorSet = f;
	}
	public inspectorInput: InspectorInputFunc = <T extends keyof TicketPatternObject>(field: T, value: TicketPatternObject[T]) =>
	{
		this.editor?.inspectorInput(field, value);
		if (field == "f")
			this.loadFonts();
		this.draw();
	}
	public reset()
	{
		this.editor = null;
		this.img = null;
		this.imgQr = new Image();
		this.imgFile = null;
		this.data = { width: 0, height: 0, objects: [] };
		this.loadingImg = false;
		this.loadingFont = false;
		this.ticket = null;
		this.inspectorSet(null);
		this.draw();
	}
	public async getData(imageName: string, eventId: number)
	{
		return {
			pattern: this.data,
			img: this.imgFile ? await imagefileToData(this.imgFile, imageName, eventId) : null,
		} as UpdateTicketTypeData
	}
	public destroy()
	{
		window.removeEventListener("resize", this.listenerResize);
		window.removeEventListener("keydown", this.listenerKeydown);
		this.removeCanvasListeners();
		this.inspectorSet(null);
	}
	public drawObject(obj: TicketPatternObjectType)
	{
		this.editor?.drawObject(obj);
		this.draw();
	}
	public resetZoom()
	{
		if (this.editor)
		{
			this.editor.resetZoom();
			this.draw();
		}
	}
	public fitZoom()
	{
		if (this.editor)
		{
			this.editor.fitToView();
			this.draw();
		}
	}

	private removeCanvasListeners()
	{
		if (this.canvas)
		{
			this.canvas.removeEventListener("mousedown", this.listenerMouseDown);
			this.canvas.removeEventListener("mousemove", this.listenerMouseMove);
			this.canvas.removeEventListener("mouseup", this.listenerMouseUp);
			this.canvas.removeEventListener("wheel", this.listenerWheel);
			this.canvas.removeEventListener("contextmenu", this.listenerContextMenu);
		}
	}

	private loadImage(image: number)
	{
		const img = new Image();
		this.img = img;
		this.img.addEventListener("load", () =>
		{
			this.loadingImg = false;
			this.editor = null;
			this.draw();
		});
		this.loadingImg = true;
		this.img.src = `/api/img/${image}`;
	}

	private loadFonts()
	{
		this.loadingFont = true;
		if (!this.fontTypes) return;

		const reqFonts = this.data.objects.map(v => v.f);
		// delete unused fonts
		for (let i = this.fonts.length - 1; i >= 0; i--)
		{
			const font = this.fonts[i];
			if (!reqFonts.includes(font.id))
			{
				document.fonts.delete(font.font);
				this.fonts.splice(i, 1);
			}
		}
		// load new fonts

		const loadedFonts = this.fonts.map(v => v.id);
		for (const obj of this.data.objects)
		{
			if (obj.f < 0 || loadedFonts.includes(obj.f))
				continue
			const font = newFontFace(`font_${obj.f}`, obj.f, this.fontTypes[obj.f]);
			this.fonts.push({ id: obj.f, font });
			this.loadingFonts.push(font);
			document.fonts.add(font);
			font.load().then(() =>
			{
				this.loadingFonts.splice(this.loadingFonts.indexOf(font), 1)
				this.loadingFont = this.loadingFonts.length != 0;
				if (!this.loadingFont)
					this.draw();
			});
		}
		this.loadingFont = this.loadingFonts.length != 0;
	}

	private reRenderQR()
	{
		const color = this.data.objects.find(v => v.type == "qr")?.c || "#000000";
		const id = ++this.qrLast;
		TicketEditor.renderQRCode(this.ticket?.code || "23-31224-34-07-4321", color, img =>
		{
			if (id != this.qrLast) return;
			this.imgQr = img;
			if (this.editor)
			{
				this.editor.setQr(img);
				this.draw();
			}
		});
	}

	private setCursor(cursor: Cursor)
	{
		if (!this.canvas) return;
		this.canvas.style.cursor = cursor;
	}

	private draw()
	{
		if (!this.canvas) return;
		const parent = this.canvas.parentElement;
		if (!parent) return;

		let w = parent.clientWidth;
		let h = parent.clientHeight;
		if (this.viewMode && this.img && !this.loading)
		{
			w = this.data.width;
			h = this.data.height;
		}
		this.canvas.width = w;
		this.canvas.style.width = `${w}px`;
		this.canvas.height = h;
		this.canvas.style.height = `${h}px`;

		if (!this.ctx) return;
		this.ctx.fillStyle = "#00000033";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		if (!this.img || this.loading)
		{
			this.ctx.fillStyle = "black";
			const text = this.loading ? "Загрузка" : (this.viewMode ? "Этот тип билетов\nне настроен" : "Загрузите картинку");
			this.drawTextAtCenter(text, 32);
			return;
		}
		if (!this.editor)
		{
			this.editor = new Editor(this.img, this.data, this.reRenderQR.bind(this), this.setCursor.bind(this), this.inspectorSet, this.imgQr, this.viewMode)
			this.editor.setCanvasSize({ w, h });
			this.editor.fitToView();
		}
		this.editor.setCanvasSize({ w, h });
		this.ctx.imageSmoothingEnabled = false;
		if (this.ticket)
			this.editor.setViewTicket(this.ticket);
		this.editor.draw(this.ctx)
	}

	private drawTextAtCenter(text: string, size: number)
	{
		if (!this.ctx || !this.canvas) return;
		const w = this.canvas.width;
		const h = this.canvas.height;
		this.ctx.textAlign = "center";
		this.ctx.font = `${size}px Arial`;
		const lines = text.split("\n");
		const dy = -lines.length * size * 0.8 / 2;
		const ddy = lines.length * size * 0.8;
		for (let i = 0; i < lines.length; i++)
			this.ctx.fillText(lines[i], w / 2, h / 2 + dy + ddy * i);
	}

	private createNewData()
	{
		return {
			height: 0,
			width: 0,
			objects: [
				{ type: "qr", x: 0, y: 0, w: 0, h: 0, c: "#000000", f: -1 },
				{ type: "code", x: 0, y: 0, w: 0, h: 0, c: "#000000", f: -1 },
				{ type: "name", x: 0, y: 0, w: 0, h: 0, c: "#000000", f: -1 },
				{ type: "promo", x: 0, y: 0, w: 0, h: 0, c: "#000000", f: -1 },
			],
		} as TicketPattern;
	}
}

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
type TicketPatternObjectType = "qr" | "name" | "promo" | "code";

type InspectorSetFunc = (obj: TicketPatternObject | null) => void;
type InspectorInputFunc = <T extends keyof TicketPatternObject>(field: T, value: TicketPatternObject[T]) => void;

type MoveMode = null | "view" | "obj" | "resize";
type Cursor = "default" | "move" | "n-resize" | "e-resize" | "ne-resize" | "nw-resize";


class Editor
{
	private transform = { x: 0, y: 0, s: 1 };
	private moving = { sx: 0, sy: 0, vx: 0, vy: 0, vw: 0, vh: 0, mode: null as MoveMode };
	private drawing = { sx: 0, sy: 0, ex: 0, ey: 0, active: false, type: null as TicketPatternObjectType | null };
	private resizing = { dir: [0, 0] as RectZone, keepAspect: false, aspect: 1 };
	private canvasSize = { w: 0, h: 0 };
	private selected = -1;
	private readonly selectionBorder = 16;
	private ticket: Ticket | null = null;

	constructor(
		private img: HTMLImageElement,
		private data: TicketPattern,
		private reRenderQR: () => void,
		private setCursor: (cursor: Cursor) => void,
		private setInspector: InspectorSetFunc,
		private imgqr: HTMLImageElement,
		private viewMode: boolean,
	)
	{
		data.width = img.width;
		data.height = img.height;
	}

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
		const obj = this.data.objects[this.selected]
		const fs = ["x", "y", "w", "h", "f"] as const;
		if (fs.includes(field as any))
		{
			const f = field as typeof fs[number];
			const v = value as number;
			obj[f] = Math.max(v, 0);
			if (obj.type == "qr")
			{
				if (f == "w") obj.h = obj.w;
				if (f == "h") obj.w = obj.h;
			}
		}
		else if (field == "c")
		{
			obj[field] = value;
			if (obj.type == "qr")
				this.reRenderQR();
		}
	}
	public setCanvasSize(size: { w: number, h: number })
	{
		this.canvasSize = size;
	}
	public setQr(qr: HTMLImageElement)
	{
		this.imgqr = qr;
	}
	public setViewTicket(ticket: Ticket)
	{
		this.ticket = ticket;
	}

	public draw(ctx: CanvasRenderingContext2D)
	{
		ctx.save();
		ctx.translate(this.transform.x, this.transform.y);
		ctx.scale(this.transform.s, this.transform.s);
		ctx.fillStyle = "black"
		ctx.fillRect(0, 0, this.img.width, this.img.height);
		ctx.drawImage(this.img, 0, 0);

		const texts = {
			name: this.ticket?.personName ?? "Иванов Иван Иванович 太阳",
			promo: this.ticket?.promocode ?? "Неутомимый",
			code: this.ticket?.code ?? "23-31224-34-07-4321",
		}

		for (let i = 0; i < this.data.objects.length; i++)
		{
			const obj = this.data.objects[i];
			// ctx.fillStyle = "#ffffff88";
			// ctx.fillRect(...unwrapRect(obj));
			ctx.fillStyle = obj.c;
			if (obj.type == "qr")
			{
				if (this.imgqr.complete && this.imgqr.naturalHeight != 0)
					ctx.drawImage(this.imgqr, ...unwrapRect(obj));
				else
					ctx.fillRect(...unwrapRect(obj));
			}
			else if (obj.type == "name" || obj.type == "promo" || obj.type == "code")
			{
				const font = `font_${obj.f}, Arial`;
				ctx.font = `${obj.h}px ${font}`;
				ctx.fillText(texts[obj.type], obj.x, obj.y + obj.h * 0.8, obj.w);
			}
			else
			{
				ctx.fillRect(...unwrapRect(obj));
			}
			if (this.selected == i)
			{
				ctx.strokeStyle = "orange";
				ctx.lineWidth = 4 / this.transform.s;
				ctx.strokeRect(...unwrapRect(obj));
			}
		}

		if (this.drawing.active)
		{
			ctx.strokeStyle = "white";
			ctx.lineWidth = 4 / this.transform.s;
			let w = this.drawing.ex - this.drawing.sx;
			let h = this.drawing.ey - this.drawing.sy;
			if (this.drawing.type == "qr")
				h = w;
			ctx.strokeRect(this.drawing.sx, this.drawing.sy, w, h);
			ctx.strokeStyle = "black";
			ctx.lineWidth = 2 / this.transform.s;
			ctx.strokeRect(this.drawing.sx, this.drawing.sy, w, h);
		}

		ctx.restore();
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

	public mouseUp(x: number, y: number, button: number)
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
		const iw = this.img.width * this.transform.s
		const ih = this.img.height * this.transform.s
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
	private pointToScreen(x: number, y: number)
	{
		return [x * this.transform.s + this.transform.x, y * this.transform.s + this.transform.y];
	}
}

interface Rect
{
	x: number,
	y: number,
	w: number,
	h: number,
}

function pointInRect(x: number, y: number, rect: Rect)
{
	return x > rect.x && x < rect.x + rect.w &&
		y > rect.y && y < rect.y + rect.h;
}

type RectZone = [number, number];  // [x, y] 1 - bottom, right; -1 = top, left
function rectZone(x: number, y: number, rect: Rect, border: number): RectZone
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
function resizeCursor(direction: RectZone): Cursor
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

function unwrapRect({ x, y, w, h }: Rect): [number, number, number, number]
{
	return [x, y, w, h];
}
