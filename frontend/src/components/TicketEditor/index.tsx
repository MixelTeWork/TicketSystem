import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFonts } from "../../api/fonts";
import { useMutationUpdateTicketType, useTicketType } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import { useStateObjNull } from "../../utils/useStateObj";
import Icon from "../Icon";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { TicketEditor } from "./editor";
import { Inspector } from "./inspector";
import styles from "./styles.module.css";
import type { FontTypes } from "./types";

export default function TicketTypeEditor({ typeId, eventId, open, close }: EditTicketTypeFormProps)
{
	const editor = useEditor();
	const mutation = useMutationUpdateTicketType(typeId, close);
	const ttype = useTicketType(typeId);
	const fonts = useFonts();
	const refCanvas = useRef<HTMLCanvasElement>(null);
	const imageSelection = useStateBool(false);
	const isNewImage = useStateBool(false);
	const noImage = ttype.data?.imageId == null;
	const saving = useStateBool(false);
	const saveError = useStateObjNull<unknown>();
	const savingRef = useRef(false);
	const initializedFor = useRef<number | null>(null);
	const resourceError = useSyncExternalStore(editor.subscribeDraw, () => editor.error);
	const { reset } = mutation;
	const tryClose = close ? () => { if (!savingRef.current) close(); } : undefined;

	async function save()
	{
		if (savingRef.current) return;
		savingRef.current = true;
		saving.setT();
		saveError.setNull();
		try
		{
			const data = await editor.getData(`ticket_${typeId}`, eventId);
			await mutation.mutateAsync(data);
		}
		catch (error) { saveError.set(error); }
		finally
		{
			savingRef.current = false;
			saving.setF();
		}
	}

	useEffect(() =>
	{
		return () => { initializedFor.current = null; };
	}, [editor]);

	useEffect(() =>
	{
		const setImageSelection = imageSelection.set;
		const setIsNewImage = isNewImage.set;
		const clearSaveError = saveError.setNull;
		if (!open)
		{
			initializedFor.current = null;
			reset();
			clearSaveError();
			setImageSelection(false);
			setIsNewImage(false);
			editor.reset();
		}
		else if (ttype.data && initializedFor.current != typeId)
		{
			editor.setData(ttype.data.imageId, structuredClone(ttype.data.pattern));
			setImageSelection(ttype.data.imageId == null);
			setIsNewImage(false);
			clearSaveError();
			initializedFor.current = typeId;
		}
	}, [open, typeId, ttype.data, editor, reset, imageSelection.set, isNewImage.set, saveError.setNull]);

	useEffect(() =>
	{
		if (refCanvas.current)
			editor.setCanvas(refCanvas.current);
	}, [editor]);

	return (
		<Popup open={open} close={tryClose} closeDisabled={saving.v} title="Редактор билета">
			{displayError(ttype)}
			{displayError(fonts)}
			{displayError({ isError: saveError.v != null, error: saveError.v })}
			{resourceError && <p className="danger-text" role="alert">{resourceError}</p>}
			{ttype.isLoading && <Spinner />}
			{fonts.isLoading && <Spinner />}
			{saving.v && <Spinner />}
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
						{imageSelection.v ? <>
							{!noImage && <button className="button" onClick={imageSelection.setF}>Отмена</button>}
							<label>
								<input type="file" onChange={e =>
								{
									if (e.target.files && e.target.files[0])
									{
										editor.setNewImage(e.target.files[0]);
										imageSelection.set(false);
										isNewImage.set(true);
									}
								}} accept="image/png, image/jpeg, image/gif" />
							</label>
						</> : <>
							<button className="button" onClick={imageSelection.setT}>Изменить картинку</button>
							{isNewImage.v && !noImage && <button className="button" onClick={() =>
							{
								isNewImage.set(false);
								editor.setImage(ttype.data?.imageId ?? null);
							}}>Отменить изменение картинки</button>}
						</>}
					</div>
					<div>
						<button className="button" onClick={tryClose} disabled={saving.v}>Отмена</button>
						<button className="button" onClick={save} disabled={saving.v}>Сохранить</button>
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
