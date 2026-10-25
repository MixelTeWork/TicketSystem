import { useEffect, useRef, useSyncExternalStore } from "react";
import { useEditor } from ".";
import { type Ticket } from "../../api/dataTypes";
import { useTicketType } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import { saveCanvasAsPng } from "../../utils/saveCanvasAsPng";
import Spinner from "../Spinner";
import styles from "./styles.module.css";

export default function TicketViewer({ ticket }: TicketViewerProps)
{
	const editor = useEditor(true);
	const ttype = useTicketType(ticket?.typeId || -1);
	const refCanvas = useRef<HTMLCanvasElement>(null);
	const ready = useSyncExternalStore(editor.subscribeDraw, () => editor.ticketReady);
	const resourceError = useSyncExternalStore(editor.subscribeDraw, () => editor.error);

	useEffect(() =>
	{
		if (!ticket) editor.reset();
	}, [ticket, editor]);

	useEffect(() =>
	{
		if (ticket && ttype.data)
		{
			editor.setData(ttype.data.imageId, structuredClone(ttype.data.pattern));
			editor.setViewTicket(ticket);
		}
	}, [ttype.data, ticket, editor]);

	useEffect(() =>
	{
		if (refCanvas.current)
			editor.setCanvas(refCanvas.current);
	}, [refCanvas, editor]);

	return (
		<div className={styles.viewer}>
			{ttype.isLoading && <Spinner />}
			{displayError(ttype)}
			{resourceError && <p className="danger-text" role="alert">{resourceError}</p>}
			<div className={styles.viewerCanvas}><canvas ref={refCanvas} /></div>
			{ticket && ttype.data?.imageId && <div className="form-actions"><button className="button button_primary" disabled={!ready} onClick={() =>
			{
				if (editor.ticketReady && refCanvas.current) saveCanvasAsPng(refCanvas.current, `ticket_${ticket.code}.png`);
			}}>Сохранить PNG</button></div>}
		</div>
	);
}

interface TicketViewerProps
{
	ticket: Ticket | null,
}
