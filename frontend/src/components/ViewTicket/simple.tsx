import useStateObj from "../../utils/useStateObj";
import { useEffect, useRef } from "react";
import { type EventData, type Ticket } from "../../api/dataTypes";
import classNames from "../../utils/classNames";
import styles from "./styles.module.css";
import QRCode from "qrcode";
import { dateToString } from "../../utils/dates";
import html2canvas from "html2canvas";
import Popup from "../Popup";

export default function ViewTicketSimple({ event, ticket, close }: ViewTicketProps)
{
	const res = useStateObj<HTMLCanvasElement | null>(null);
	const qrcode = useStateObj("");
	const ticketRef = useRef<HTMLDivElement>(null);
	useEffect(() =>
	{
		const setRes = res.set;
		const setQrcode = qrcode.set;
		if (!ticket) return;
		setRes(null);
		setQrcode("");
		QRCode.toDataURL(ticket.code, { errorCorrectionLevel: "H", scale: 8 }, (e, url) => setQrcode(url));
	}, [ticket, res.set, qrcode.set]);

	useEffect(() =>
	{
		const setRes = res.set;
		if (!ticket || !qrcode.v || !ticketRef.current) return;
		const timeout = setTimeout(() =>
		{
			if (!qrcode.v || !ticketRef.current) return;
			html2canvas(ticketRef.current).then(canvas => setRes(canvas));
		}, 10);
		return () => clearTimeout(timeout);
	}, [ticket, qrcode.v, ticketRef, res.set]);

	return (
		<Popup open={!!ticket} close={close} title="Просмотр билета">
			<div ref={ticketRef} className={classNames(styles.root, !res.v && styles.visible)}>
				<h1>Билет</h1>
				<div className={styles.center} style={{ marginTop: "1rem" }}>
					<img src={qrcode.v} alt={ticket?.code} />
				</div>
				<div className={styles.center} style={{ marginBottom: "1rem" }}>{ticket?.code}</div>
				<div>
					<div>Мероприятие: {event?.name}</div>
					<div>Дата: {dateToString(event?.date)}</div>
					<div>Тип билета: {ticket?.type}</div>
					<div>Посетитель: {ticket?.personName}</div>
				</div>
			</div>
			{res.v && <div ref={ref =>
			{
				if (!ref || !res.v) return;
				ref.innerHTML = "";
				ref.appendChild(res.v);
			}}></div>}
			{res.v && <div className={styles.center}>Это картинка, можно копировать</div>}
		</Popup>
	);
}

interface ViewTicketProps
{
	event: EventData | undefined,
	ticket: Ticket | null,
	close: () => void,
}
