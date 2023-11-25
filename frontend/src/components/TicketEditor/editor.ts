import type { UpdateTicketTypeData } from "../../api/ticketTypes";
import imagefileToData from "../../utils/imagefileToData";

export class TicketEditor
{
	private editor: Editor | null = null;
	private firstDraw = true;
	private img: HTMLImageElement | null = null;
	private imgFile: File | null = null;
	private data: TicketPattern = {};
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private loading = false;
	private listenerResize = () => this.draw();
	private listenerMouseDown = (e: MouseEvent) => { if (this.editor?.mouseDown(e.offsetX, e.offsetY, e.button)) this.draw() };
	private listenerMouseMove = (e: MouseEvent) => { if (this.editor?.mouseMove(e.offsetX, e.offsetY)) this.draw() };
	private listenerMouseUp = (e: MouseEvent) => { if (this.editor?.mouseUp(e.offsetX, e.offsetY, e.button)) this.draw() };
	private listenerContextMenu = (e: MouseEvent) => { e.preventDefault(); };
	private listenerWheel = (e: WheelEvent) => { if (this.editor?.wheel(e.offsetX, e.offsetY, e.deltaY)) this.draw() };

	constructor(init = true)
	{
		if (!init) return;
		window.addEventListener("resize", this.listenerResize);
	}

	public setData(image: number | null, data: TicketPattern)
	{
		this.img = null;
		this.imgFile = null;
		if (image != null)
			this.loadImage(image);
		this.data = data;
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
			this.loading = false;
			this.editor = new Editor(img, this.data, this.setCursor);
			this.draw();
		});
		const url = URL.createObjectURL(image)
		this.loading = true;
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
		canvas.addEventListener("mousedown", this.listenerMouseDown);
		canvas.addEventListener("mousemove", this.listenerMouseMove);
		canvas.addEventListener("mouseup", this.listenerMouseUp);
		canvas.addEventListener("wheel", this.listenerWheel);
		canvas.addEventListener("contextmenu", this.listenerContextMenu);
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
	}
	public update()
	{
		this.firstDraw = true;
		this.editor = null;
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
		this.removeCanvasListeners();
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
			this.loading = false;
			this.editor = new Editor(img, this.data, this.setCursor.bind(this));
			this.draw();
		});
		this.loading = true;
		this.img.src = `/api/img/${image}`;
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

		const w = parent.clientWidth;
		const h = parent.clientHeight;
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
			const text = this.loading ? "Загрузка" : "Загрузите картинку";
			this.drawTextAtCenter(text, 32);
			return;
		}
		if (!this.editor) return;
		this.editor.canvasSize = { w, h };
		if (this.firstDraw)
		{
			this.firstDraw = false;
			this.editor.fitToView();
		}
		this.ctx.imageSmoothingEnabled = false;
		this.editor.draw(this.ctx)
	}

	private drawTextAtCenter(text: string, size: number)
	{
		if (!this.ctx || !this.canvas) return;
		const w = this.canvas.width;
		const h = this.canvas.height;
		this.ctx.textAlign = "center";
		this.ctx.font = `${size}px Arial`;
		this.ctx.fillText(text, w / 2, h / 2);
	}
}

export interface TicketPattern
{

}

type MoveMode = null | "view";
type Cursor = "default" | "move";

class Editor
{
	private transform = { x: 0, y: 0, s: 1 };
	private moving = { sx: 0, sy: 0, vx: 0, vy: 0, mode: null as MoveMode };
	public canvasSize = { w: 0, h: 0 };

	constructor(
		private img: HTMLImageElement,
		private data: TicketPattern,
		private setCursor: (cursor: Cursor) => void,
	) { }

	public fitToView()
	{
		const m = 200;
		this.transform.s = Math.min((this.canvasSize.w - m) / this.img.width, (this.canvasSize.h - m) / this.img.height);
		this.transform.x = (this.canvasSize.w - this.img.width * this.transform.s) / 2;
		this.transform.y = (this.canvasSize.h - this.img.height * this.transform.s) / 2;
		this.restrictView();
	}

	public draw(ctx: CanvasRenderingContext2D)
	{
		ctx.save();
		ctx.translate(this.transform.x, this.transform.y);
		ctx.scale(this.transform.s, this.transform.s);
		ctx.fillStyle = "black"
		ctx.fillRect(0, 0, this.img.width, this.img.height);
		ctx.drawImage(this.img, 0, 0);
		ctx.restore();
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
			return true;
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
	}

	public mouseUp(x: number, y: number, button: number)
	{
		this.moving.mode = null;
		this.setCursor("default");
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
}
