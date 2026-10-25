import type { Ticket } from "../../api/tickets";
import type { TicketPattern, EditorRenderState } from "./types";
import { unwrapRect } from "./geometry";

export function drawTicket(ctx: CanvasRenderingContext2D, image: HTMLImageElement, pattern: TicketPattern, qr: HTMLImageElement | null, ticket: Ticket | null, state: EditorRenderState)
{
	ctx.save();
	ctx.translate(state.transform.x, state.transform.y);
	ctx.scale(state.transform.s, state.transform.s);
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, image.width, image.height);
	ctx.drawImage(image, 0, 0);

	const texts = {
		name: ticket?.personName ?? "Иванов Иван Иванович 太阳",
		promo: ticket?.promocode ?? "Неутомимый",
		code: ticket?.code ?? "23-31224-34-07-4321",
		price: ticket ? `${ticket.price ?? ""}` : "1200",
	};
	if (texts.price) texts.price += "P";

	for (let i = 0; i < pattern.objects.length; i++)
	{
		const obj = pattern.objects[i];
		ctx.fillStyle = obj.c;
		if (obj.type == "qr")
		{
			if (qr?.complete && qr.naturalHeight != 0)
				ctx.drawImage(qr, ...unwrapRect(obj));
			else
				ctx.fillRect(...unwrapRect(obj));
		}
		else if (obj.type == "name" || obj.type == "promo" || obj.type == "code" || obj.type == "price")
		{
			const font = obj.f < 0 ? "Arial" : `font_${obj.f}, Arial`;
			ctx.font = `${obj.h}px ${font}`;
			ctx.fillText(texts[obj.type], obj.x, obj.y + obj.h * 0.8, obj.w);
		}
		else
		{
			ctx.fillRect(...unwrapRect(obj));
		}
		if (state.selected == i)
		{
			ctx.strokeStyle = "orange";
			ctx.lineWidth = 4 / state.transform.s;
			ctx.strokeRect(...unwrapRect(obj));
		}
	}

	if (state.drawing.active)
	{
		ctx.strokeStyle = "white";
		ctx.lineWidth = 4 / state.transform.s;
		const w = state.drawing.ex - state.drawing.sx;
		let h = state.drawing.ey - state.drawing.sy;
		if (state.drawing.type == "qr")
			h = w;
		ctx.strokeRect(state.drawing.sx, state.drawing.sy, w, h);
		ctx.strokeStyle = "black";
		ctx.lineWidth = 2 / state.transform.s;
		ctx.strokeRect(state.drawing.sx, state.drawing.sy, w, h);
	}

	ctx.restore();
}

export function drawTextAtCenter(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string, size: number)
{
	const w = canvas.width;
	const h = canvas.height;
	ctx.textAlign = "center";
	ctx.font = `${size}px Arial`;
	const lines = text.split("\n");
	const dy = -lines.length * size * 0.8 / 2;
	const ddy = lines.length * size * 0.8;
	for (let i = 0; i < lines.length; i++)
		ctx.fillText(lines[i], w / 2, h / 2 + dy + ddy * i);
}

