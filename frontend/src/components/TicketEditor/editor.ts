import type { Ticket } from "../../api/tickets";
import type { UpdateTicketTypeData } from "../../api/ticketTypes";
import imagefileToData from "../../utils/imagefileToData";
import { EditorInteraction } from "./interaction";
import { normalizePattern } from "./pattern";
import { drawTextAtCenter, drawTicket } from "./renderer";
import { EditorResources, renderQRCode } from "./resources";
import type { FontTypes, InspectorInputFunc, InspectorSetFunc, TicketPattern, TicketPatternObjectType } from "./types";

export class TicketEditor
{
	private interaction: EditorInteraction | null = null;
	private resources = new EditorResources(resource =>
	{
		if (resource == "image") this.interaction = null;
		this.notifyInspector(this.interaction?.getSelectedObject() ?? null);
		this.draw();
	}, (code, color) => TicketEditor.renderQRCode(code, color));
	private data: TicketPattern = normalizePattern(null);
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private drawListeners = new Set<() => void>();
	private ticket: Ticket | null = null;
	private initialized = false;
	private inspectorSet: InspectorSetFunc = () => { };
	private notifyInspector: InspectorSetFunc = object => this.inspectorSet(object ? { ...object } : null);
	private listenerResize = () => this.draw();
	private listenerKeydown = (event: KeyboardEvent) =>
	{
		if (event.key == "Delete" && this.interaction?.deleteSelectedObj()) this.draw();
	};
	private listenerMouseDown = (event: MouseEvent) => { if (this.interaction?.mouseDown(event.offsetX, event.offsetY, event.button)) this.draw(); };
	private listenerMouseMove = (event: MouseEvent) => { if (this.interaction?.mouseMove(event.offsetX, event.offsetY)) this.draw(); };
	private listenerMouseUp = (event: MouseEvent) => { if (this.interaction?.mouseUp(event.offsetX, event.offsetY, event.button)) this.draw(); };
	private listenerContextMenu = (event: MouseEvent) => event.preventDefault();
	private listenerWheel = (event: WheelEvent) =>
	{
		event.preventDefault();
		if (this.interaction?.wheel(event.offsetX, event.offsetY, event.deltaY)) this.draw();
	};

	constructor(private viewMode = false) {}

	public static renderQRCode = renderQRCode;
	public get error() { return this.resources.error; }
	public get ticketReady()
	{
		return !!this.ticket && !!this.canvas && this.resources.ready && this.data.width > 0 && this.data.height > 0;
	}
	public subscribeDraw = (listener: () => void) =>
	{
		this.drawListeners.add(listener);
		return () => { this.drawListeners.delete(listener); };
	};

	public init()
	{
		if (this.initialized) return;
		this.initialized = true;
		this.addListeners();
	}
	public setViewMode(viewMode: boolean)
	{
		if (this.viewMode == viewMode) return;
		this.removeListeners();
		this.viewMode = viewMode;
		this.interaction = null;
		this.addListeners();
		this.draw();
	}
	public setFontTypes(types: FontTypes | null)
	{
		this.resources.setFontTypes(types, this.data);
		this.draw();
	}
	public setData(image: number | null, data: unknown)
	{
		this.data = normalizePattern(data);
		this.interaction = null;
		this.resources.setImage(image);
		this.resources.updateFonts(this.data);
		this.reRenderQR();
		this.draw();
	}
	public setViewTicket(ticket: Ticket)
	{
		this.ticket = ticket;
		this.reRenderQR();
		this.draw();
	}
	public setNewImage(image: File) { this.resources.setImage(image); }
	public setImage(image: number | null) { this.resources.setImage(image); }
	public setCanvas(canvas: HTMLCanvasElement)
	{
		this.removeCanvasListeners();
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.draw();
		this.addCanvasListeners();
	}
	public setInspector(set: InspectorSetFunc | null)
	{
		this.inspectorSet = set ?? (() => { });
		this.notifyInspector(this.interaction?.getSelectedObject() ?? null);
	}
	public inspectorInput: InspectorInputFunc = (field, value) =>
	{
		this.interaction?.inspectorInput(field, value);
		if (field == "f") this.resources.updateFonts(this.data);
		this.draw();
	};
	public reset()
	{
		this.resources.reset();
		this.interaction = null;
		this.data = normalizePattern(null);
		this.ticket = null;
		this.notifyInspector(null);
		this.draw();
	}
	public async getData(imageName: string, eventId: number): Promise<UpdateTicketTypeData>
	{
		const pattern = structuredClone(this.data);
		const file = this.resources.imageFile;
		return { pattern, img: file ? await imagefileToData(file, imageName, eventId) : null };
	}
	public destroy()
	{
		this.initialized = false;
		this.removeListeners();
		this.resources.reset();
		this.inspectorSet = () => { };
		this.canvas = null;
		this.ctx = null;
		this.interaction = null;
	}
	public drawObject(type: TicketPatternObjectType)
	{
		this.interaction?.drawObject(type);
		this.draw();
	}
	public resetZoom()
	{
		this.interaction?.resetZoom();
		this.draw();
	}
	public fitZoom()
	{
		this.interaction?.fitToView();
		this.draw();
	}

	private addListeners()
	{
		if (!this.initialized || this.viewMode) return;
		window.addEventListener("resize", this.listenerResize);
		window.addEventListener("keydown", this.listenerKeydown);
		this.addCanvasListeners();
	}
	private removeListeners()
	{
		window.removeEventListener("resize", this.listenerResize);
		window.removeEventListener("keydown", this.listenerKeydown);
		this.removeCanvasListeners();
	}
	private addCanvasListeners()
	{
		if (!this.initialized || this.viewMode || !this.canvas) return;
		this.canvas.addEventListener("mousedown", this.listenerMouseDown);
		this.canvas.addEventListener("mousemove", this.listenerMouseMove);
		this.canvas.addEventListener("mouseup", this.listenerMouseUp);
		this.canvas.addEventListener("wheel", this.listenerWheel);
		this.canvas.addEventListener("contextmenu", this.listenerContextMenu);
	}
	private removeCanvasListeners()
	{
		this.canvas?.removeEventListener("mousedown", this.listenerMouseDown);
		this.canvas?.removeEventListener("mousemove", this.listenerMouseMove);
		this.canvas?.removeEventListener("mouseup", this.listenerMouseUp);
		this.canvas?.removeEventListener("wheel", this.listenerWheel);
		this.canvas?.removeEventListener("contextmenu", this.listenerContextMenu);
	}
	private reRenderQR = () =>
	{
		const color = this.data.objects.find(object => object.type == "qr")?.c ?? "#000000";
		this.resources.setQr(this.ticket?.code ?? "23-31224-34-07-4321", color);
	};
	private draw()
	{
		const image = this.resources.image;
		if (image)
		{
			this.data.width = image.naturalWidth;
			this.data.height = image.naturalHeight;
		}
		try
		{
			const canvas = this.canvas;
			const ctx = this.ctx;
			const parent = canvas?.parentElement;
			if (!canvas || !ctx || !parent) return;
			const w = this.viewMode && image ? image.naturalWidth : parent.clientWidth;
			const h = this.viewMode && image ? image.naturalHeight : parent.clientHeight;
			canvas.width = w;
			canvas.height = h;
			canvas.style.width = this.viewMode ? "100%" : `${w}px`;
			canvas.style.height = this.viewMode ? "auto" : `${h}px`;
			ctx.fillStyle = "#00000033";
			ctx.fillRect(0, 0, w, h);
			if (!image || this.resources.loading)
			{
				ctx.fillStyle = "black";
				const text = this.error ?? (this.resources.loading ? "Загрузка" : this.viewMode ? "Этот тип билетов\nне настроен" : "Загрузите картинку");
				drawTextAtCenter(ctx, canvas, text, 32);
				return;
			}
			if (!this.interaction)
			{
				this.interaction = new EditorInteraction(image, this.data, this.reRenderQR, cursor => { canvas.style.cursor = cursor; }, this.notifyInspector, this.viewMode);
				this.interaction.setCanvasSize({ w, h });
				this.interaction.fitToView();
			}
			this.interaction.setCanvasSize({ w, h });
			ctx.imageSmoothingEnabled = false;
			drawTicket(ctx, image, this.data, this.resources.qr, this.ticket, this.interaction.renderState);
		}
		finally { this.drawListeners.forEach(listener => listener()); }
	}
}
