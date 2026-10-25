import { type EventData, type Ticket } from "../../api/dataTypes";
import { useTicketType } from "../../api/ticketTypes";
import useStateObj from "../../utils/useStateObj";
import Popup from "../Popup";
import TicketViewer from "../TicketEditor/viewer";
import ViewTicketSimple from "./simple";

export default function ViewTicket({ ticket, event, close }: ViewTicketProps)
{
	const simpleViewer = useStateObj<Ticket | null>(null);
	const ttype = useTicketType(ticket?.typeId || -1);

	return (<>
		<Popup open={!!ticket && !simpleViewer.v} close={close} title="Просмотр билета">
			<TicketViewer ticket={ticket} />
			{ttype.data && !ttype.data.imageId && <div style={{ textAlign: "center" }}>
				<button className="button" onClick={() => simpleViewer.set(ticket)}>Сгенерировать qr код</button>
			</div>}
		</Popup>
		<ViewTicketSimple ticket={simpleViewer.v} event={event} close={() => { simpleViewer.set(null); close(); }} />
	</>
	);
}

interface ViewTicketProps
{
	event: EventData | undefined,
	ticket: Ticket | null,
	close: () => void,
}
