import Popup from "../Popup";
import { Ticket } from "../../api/dataTypes";
import TicketViewer from "../TicketEditor/viewer";

export default function ViewTicket({ ticket, close }: ViewTicketProps)
{
	return (
		<Popup open={!!ticket} close={close} title="Просмотр билета">
			<TicketViewer ticket={ticket} />
		</Popup>
	)
}

interface ViewTicketProps
{
	ticket: Ticket | null,
	close: () => void,
}
