import type { EventData } from "../../api/events";
import type { Ticket } from "../../api/tickets";
import { useTicketType } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import Popup from "../Popup";
import Spinner from "../Spinner";
import TicketViewer from "../TicketEditor/viewer";
import ViewTicketSimple from "./simple";

export default function ViewTicket({ ticket, event, close }: ViewTicketProps)
{
	const ttype = useTicketType(ticket?.typeId || -1);

	if (ticket && ttype.data && !ttype.data.imageId)
		return <ViewTicketSimple ticket={ticket} event={event} close={close} withoutDesign />;

	return <Popup open={!!ticket} close={close} title="Просмотр билета">
		{ttype.isLoading && <Spinner />}
		{displayError(ttype)}
		{ticket && ttype.data?.imageId && <TicketViewer ticket={ticket} />}
	</Popup>;
}

interface ViewTicketProps
{
	event: EventData | undefined,
	ticket: Ticket | null,
	close: () => void,
}
