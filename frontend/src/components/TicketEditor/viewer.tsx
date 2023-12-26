import { useEffect, useRef } from "react";
import { useEditor } from ".";
import { useTicketType } from "../../api/ticketTypes";
import Spinner from "../Spinner";
import { Ticket } from "../../api/dataTypes";
import displayError from "../../utils/displayError";

export default function TicketViewer({ ticket }: TicketViewerProps)
{
	const editor = useEditor(true);
	const ttype = useTicketType(ticket?.typeId || -1);
	const refCanvas = useRef<HTMLCanvasElement>(null);

	useEffect(() =>
	{
		if (!ticket) editor.reset();
	}, [ticket, editor]);

	useEffect(() =>
	{
		if (ticket && ttype.data)
		{
			editor.setData(ttype.data.imageId, JSON.parse(JSON.stringify(ttype.data.pattern)));
			editor.setViewTicket(ticket);
		}
	}, [ttype.data, ticket, editor]);

	useEffect(() =>
	{
		if (refCanvas.current)
			editor.setCanvas(refCanvas.current);
	}, [refCanvas, editor]);

	return (
		<div style={{ minWidth: 400, minHeight: 300 }}>
			{ttype.isLoading && <Spinner />}
			{displayError(ttype)}
			<canvas ref={refCanvas} />
		</div>
	)
}

interface TicketViewerProps
{
	ticket: Ticket | null,
}
