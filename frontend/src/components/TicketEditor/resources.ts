import QRCode from "qrcode";
import { newFontFace } from "../../utils/useFont";
import type { FontTypes, TicketPattern } from "./types";

type Resource<T> = { status: "idle" } | { status: "loading" } | { status: "ready", value: T } | { status: "error", message: string };
type QrRenderer = (code: string, color: string) => Promise<HTMLImageElement>;
interface LoadedFont
{
	face: FontFace;
	type: FontTypes[number];
	state: Resource<FontFace>;
}

function loadImage(url: string)
{
	return new Promise<HTMLImageElement>((resolve, reject) =>
	{
		const image = new Image();
		image.addEventListener("load", () => resolve(image), { once: true });
		image.addEventListener("error", () => reject(new Error("Image loading failed")), { once: true });
		image.src = url;
	});
}

export async function renderQRCode(code: string, color: string)
{
	const url = await QRCode.toDataURL(code, { errorCorrectionLevel: "H", scale: 10, margin: 2, color: { light: "#ffffff00", dark: color } });
	return loadImage(url);
}

export class EditorResources
{
	private imageState: Resource<HTMLImageElement> = { status: "idle" };
	private qrState: Resource<HTMLImageElement> = { status: "idle" };
	private fonts = new Map<number, LoadedFont>();
	private fontTypes: FontTypes | null = null;
	private imageVersion = 0;
	private qrVersion = 0;
	private imageUrl: string | null = null;
	public imageFile: File | null = null;

	constructor(private onChange: (resource: "image" | "qr" | "fonts") => void, private renderQr: QrRenderer = renderQRCode) {}

	public get image() { return this.imageState.status == "ready" ? this.imageState.value : null; }
	public get qr() { return this.qrState.status == "ready" ? this.qrState.value : null; }
	public get loading()
	{
		return this.imageState.status == "loading" || this.fontTypes == null || [...this.fonts.values()].some(font => font.state.status == "loading");
	}
	public get ready()
	{
		return this.image != null && this.qrState.status == "ready" && !this.loading && !this.error;
	}
	public get error()
	{
		if (this.imageState.status == "error") return this.imageState.message;
		if (this.qrState.status == "error") return this.qrState.message;
		return [...this.fonts.values()].some(font => font.state.status == "error")
			? "Не удалось загрузить шрифт билета"
			: null;
	}

	public setImage(source: number | File | null)
	{
		const version = ++this.imageVersion;
		this.releaseImageUrl();
		this.imageFile = source instanceof File ? source : null;
		this.imageState = source == null ? { status: "idle" } : { status: "loading" };
		this.onChange("image");
		if (source == null) return;
		const url = typeof source == "number" ? `/api/img/${source}` : URL.createObjectURL(source);
		if (typeof source != "number") this.imageUrl = url;
		loadImage(url).then(image =>
		{
			if (version != this.imageVersion) return;
			this.imageState = { status: "ready", value: image };
		}).catch(() =>
		{
			if (version != this.imageVersion) return;
			this.imageState = { status: "error", message: "Не удалось загрузить картинку билета" };
			this.imageFile = null;
		}).finally(() =>
		{
			if (version != this.imageVersion) return;
			this.releaseImageUrl();
			this.onChange("image");
		});
	}

	public setQr(code: string, color: string)
	{
		const version = ++this.qrVersion;
		this.qrState = { status: "loading" };
		this.onChange("qr");
		this.renderQr(code, color).then(image =>
		{
			if (version != this.qrVersion) return;
			this.qrState = { status: "ready", value: image };
		}).catch(() =>
		{
			if (version != this.qrVersion) return;
			this.qrState = { status: "error", message: "Не удалось создать QR-код билета" };
		}).finally(() =>
		{
			if (version == this.qrVersion) this.onChange("qr");
		});
	}

	public setFontTypes(types: FontTypes | null, pattern: TicketPattern)
	{
		this.fontTypes = types;
		this.updateFonts(pattern);
	}

	public updateFonts(pattern: TicketPattern)
	{
		if (!this.fontTypes) return;
		for (const object of pattern.objects)
			if (object.f >= 0 && !this.fontTypes[object.f]) object.f = -1;
		const required = new Set(pattern.objects.map(object => object.f));
		for (const [id, font] of this.fonts)
		{
			if (!required.has(id) || font.type != this.fontTypes[id] || font.state.status == "error")
			{
				document.fonts.delete(font.face);
				this.fonts.delete(id);
			}
		}
		for (const id of required)
		{
			const type = this.fontTypes[id];
			if (id < 0 || !type || this.fonts.has(id)) continue;
			const face = newFontFace(`font_${id}`, id, type);
			const font: LoadedFont = { face, type, state: { status: "loading" } };
			this.fonts.set(id, font);
			document.fonts.add(face);
			face.load().then(() =>
			{
				if (this.fonts.get(id) == font) font.state = { status: "ready", value: face };
			}).catch(() =>
			{
				if (this.fonts.get(id) != font) return;
				font.state = { status: "error", message: "Не удалось загрузить шрифт билета" };
				document.fonts.delete(face);
			}).finally(() =>
			{
				if (this.fonts.get(id) == font) this.onChange("fonts");
			});
		}
		this.onChange("fonts");
	}

	public reset()
	{
		this.imageVersion++;
		this.qrVersion++;
		this.releaseImageUrl();
		this.imageState = { status: "idle" };
		this.qrState = { status: "idle" };
		this.imageFile = null;
		for (const font of this.fonts.values()) document.fonts.delete(font.face);
		this.fonts.clear();
	}

	private releaseImageUrl()
	{
		if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
		this.imageUrl = null;
	}
}
