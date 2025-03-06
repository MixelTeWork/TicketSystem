import { useState } from "react";
import Popup from "../Popup";
import { EventData, Ticket } from "../../api/dataTypes";
import TicketViewer from "../TicketEditor/viewer";
import { useTicketType } from "../../api/ticketTypes";
import ViewTicketSimple from "./simple";

export default function ViewTicket({ ticket, event, close }: ViewTicketProps)
{
	const [simpleViewer, setSimpleViewer] = useState<Ticket | null>(null);
	const ttype = useTicketType(ticket?.typeId || -1);

	return (<>
		<Popup open={!!ticket && !simpleViewer} close={close} title="Просмотр билета">
			<small>(сохранение по клику на картинку)</small>
			<TicketViewer ticket={ticket} />
			{ttype.data && !ttype.data.imageId && <div style={{ textAlign: "center" }}>
				<button className="button" onClick={() => setSimpleViewer(ticket)}>Сгенерировать qr код</button>
			</div>}
		</Popup>
		<ViewTicketSimple ticket={simpleViewer} event={event} close={() => { setSimpleViewer(null); close() }} />
	</>
	)
}

interface ViewTicketProps
{
	event: EventData | undefined,
	ticket: Ticket | null,
	close: () => void,
}
