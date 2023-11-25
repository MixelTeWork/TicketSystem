import { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css"
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationUpdateTicketType, useTicketType } from "../../api/ticketTypes";
import { Editor } from "./editor";

export default function TicketTypeEditor({ typeId, eventId, open, close }: EditTicketTypeFormProps)
{
	const editor = useEditor();
	const mutation = useMutationUpdateTicketType(typeId, close);
	const ttype = useTicketType(typeId);
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
		}
		else
		{
			editor.update();
		}
		// eslint-disable-next-line
	}, [open, editor]);

	useEffect(() =>
	{
		if (open && ttype.data)
		{
			editor.setData(ttype.data.imageId, ttype.data.pattern);
			setImageSelection(!ttype.data?.imageId)
		}
	}, [ttype.data, open, editor]);

	useEffect(() =>
	{
		if (refCanvas.current)
			editor.setCanvas(refCanvas.current);
	}, [refCanvas, editor]);

	return (
		<Popup open={open} close={close} title="Редактор билета">
			{displayError(mutation)}
			{ttype.isLoading && <Spinner />}
			{mutation.isLoading && <Spinner />}
			<div className={styles.root}>
				<div className={styles.canvas}>
					<canvas ref={refCanvas} />
				</div>
				<div className={styles.panel}>
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
								editor.setImage(ttype.data?.imageId || null)
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

function useEditor()
{
	const editor = useRef(new Editor(false));
	useEffect(() =>
	{
		editor.current = new Editor();
		return () => editor.current.destroy();
	}, []);
	return editor.current;
}

interface EditTicketTypeFormProps extends PopupProps
{
	eventId: number,
	typeId: number,
}
