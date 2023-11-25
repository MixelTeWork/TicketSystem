import type { UpdateTicketTypeData } from "../../api/ticketTypes";
import imagefileToData from "../../utils/imagefileToData";

export class Editor
{
	private img: HTMLImageElement | null = null;
	private imgFile: File | null = null;
	private data: TicketPattern = {};
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private loading = false;
	private listenerResize = () => this.draw();

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
		this.img = new Image();
		this.img.addEventListener("load", () =>
		{
			URL.revokeObjectURL(url);
			this.loading = false;
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
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
	}
	public update()
	{
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
	}

	private loadImage(image: number)
	{
		this.img = new Image();
		this.img.addEventListener("load", () =>
		{
			this.loading = false;
			this.draw();
		});
		this.loading = true;
		this.img.src = `/api/img/${image}`;
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
		this.ctx.drawImage(this.img, 0, 0);
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