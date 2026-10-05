import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles.module.css";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationUpdateTicketType, useTicketType } from "../../api/ticketTypes";
import { type FontTypes, TicketEditor } from "./editor";
import { Inspector } from "./inspector";
import { useFonts } from "../../api/fonts";
import Icon from "../Icon";

export default function TicketTypeEditor({ typeId, eventId, open, close }: EditTicketTypeFormProps)
{
	const editor = useEditor();
	const mutation = useMutationUpdateTicketType(typeId, close);
	const ttype = useTicketType(typeId);
	const fonts = useFonts();
	const refCanvas = useRef<HTMLCanvasElement>(null);
	const [imageSelection, setImageSelection] = useState(false);
	const [isNewImage, setIsNewImage] = useState(false);
	const noImage = ttype.data?.imageId == null;

	useEffect(() =>
	{
		if (!open)
		{
			mutation.reset();
			setImageSelection(false);
			setIsNewImage(false);
			editor.reset();
		}
		// eslint-disable-next-line
	}, [open, editor]);

	useEffect(() =>
	{
		if (open && ttype.data)
		{
			editor.setData(ttype.data.imageId, JSON.parse(JSON.stringify(ttype.data.pattern)));
			setImageSelection(ttype.data.imageId == null);
		}
	}, [ttype.data, open, editor]);

	useEffect(() =>
	{
		if (refCanvas.current)
			editor.setCanvas(refCanvas.current);
	}, [editor]);

	return (
		<Popup open={open} close={close} title="Редактор билета">
			{displayError(ttype)}
			{displayError(fonts)}
			{displayError(mutation)}
			{ttype.isLoading && <Spinner />}
			{fonts.isLoading && <Spinner />}
			{mutation.isPending && <Spinner />}
			<div className={styles.root}>
				<div className={styles.canvas}>
					<canvas ref={refCanvas} />
					<Inspector editor={editor} fonts={fonts.data || []} />
				</div>
				<div className={styles.panel}>
					<span>Нарисовать объекты:</span>
					<button className="button" onClick={() => editor.drawObject("qr")}>QR код</button>
					<button className="button" onClick={() => editor.drawObject("code")}>Код</button>
					<button className="button" onClick={() => editor.drawObject("name")}>Имя посетителя</button>
					<button className="button" onClick={() => editor.drawObject("promo")}>Промокод</button>
					<button className="button" onClick={() => editor.drawObject("price")}>Цена</button>
					<span className={styles.br}></span>
					<button className="button button_icon" onClick={() => editor.fitZoom()}><Icon icon="fit_screen" /></button>
					<button className="button" onClick={() => editor.resetZoom()}>1:1</button>
				</div>
				<div className={styles.footer}>
					<div>
						{imageSelection ? <>
							{!noImage && <button className="button" onClick={() => setImageSelection(false)}>Отмена</button>}
							<label>
								<input type="file" onChange={e =>
								{
									if (e.target.files && e.target.files[0])
									{
										editor.setNewImage(e.target.files[0]);
										setImageSelection(false);
										setIsNewImage(true);
									}
								}} accept="image/png, image/jpeg, image/gif" />
							</label>
						</> : <>
							<button className="button" onClick={() => setImageSelection(true)}>Изменить картинку</button>
							{isNewImage && !noImage && <button className="button" onClick={() =>
							{
								setIsNewImage(false);
								editor.setImage(ttype.data?.imageId ?? null);
							}}>Отменить изменение картинки</button>}
						</>}
					</div>
					<div>
						<button className="button" onClick={() => close?.()}>Отмена</button>
						<button className="button" onClick={async () =>
						{
							const data = await editor.getData(`ticket_${typeId}`, eventId);
							mutation.mutate(data);
						}}>Сохранить</button>
					</div>
				</div>
			</div>
		</Popup>
	);
}

export function useEditor(viewMode = false)
{
	const fonts = useFonts();
	const fontTypes = useMemo<FontTypes | null>(() =>
	{
		if (!fonts.data) return null;
		const types: FontTypes = {};
		for (const font of fonts.data)
			types[font.id] = font.type;
		return types;
	}, [fonts.data]);

	const refEditor = useRef<TicketEditor | null>(null);
	if (!refEditor.current)
		refEditor.current = new TicketEditor(viewMode);
	const editor = refEditor.current;

	useEffect(() =>
	{
		editor.init();
		return () => editor.destroy();
	}, [editor]);

	useEffect(() =>
	{
		editor.setViewMode(viewMode);
	}, [editor, viewMode]);

	useEffect(() =>
	{
		editor.setFontTypes(fontTypes);
	}, [editor, fontTypes]);

	return editor;
}

interface EditTicketTypeFormProps extends PopupProps
{
	eventId: number,
	typeId: number,
}
