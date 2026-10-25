import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";
import { type EventData, type Ticket } from "../../api/dataTypes";
import classNames from "../../utils/classNames";
import { dateToString } from "../../utils/dates";
import { saveCanvasAsPng } from "../../utils/saveCanvasAsPng";
import useStateObj from "../../utils/useStateObj";
import Popup from "../Popup";
import styles from "./styles.module.css";

export default function ViewTicketSimple({ event, ticket, close }: ViewTicketProps)
{
	const res = useStateObj<HTMLCanvasElement | null>(null);
	const qrcode = useStateObj("");
	const ticketRef = useRef<HTMLDivElement>(null);
	const error = useStateObj("");
	useEffect(() =>
	{
		const setRes = res.set;
		const setQrcode = qrcode.set;
		const setError = error.set;
		setRes(null);
		setQrcode("");
		setError("");
		if (!ticket) return;
		let cancelled = false;
		QRCode.toDataURL(ticket.code, { errorCorrectionLevel: "H", scale: 8 }, (e, url) =>
		{
			if (cancelled) return;
			if (e) setError("Не удалось создать QR-код билета");
			else setQrcode(url);
		});
		return () => { cancelled = true; };
	}, [ticket, event, res.set, qrcode.set, error.set]);

	useEffect(() =>
	{
		const setRes = res.set;
		const setError = error.set;
		if (!ticket || !qrcode.v || !ticketRef.current) return;
		const element = ticketRef.current;
		let cancelled = false;
		const generate = async () =>
		{
			try
			{
				await Promise.all(Array.from(element.querySelectorAll("img")).map(img => img.decode()));
				await document.fonts.ready;
				if (cancelled) return;
				const canvas = await html2canvas(element);
				if (!cancelled) setRes(canvas);
			}
			catch { if (!cancelled) setError("Не удалось подготовить изображение билета"); }
		};
		void generate();
		return () => { cancelled = true; };
	}, [ticket, event, qrcode.v, res.set, error.set]);

	return (
		<Popup open={!!ticket} close={close} title="Просмотр билета">
			{error.v && <p className="danger-text" role="alert">{error.v}</p>}
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
			{res.v && <>
				<img className={styles.generated} src={res.v.toDataURL("image/png")} alt={`Билет ${ticket?.code}`} />
				<div className="form-actions"><button className="button button_primary" onClick={() => { if (res.v) saveCanvasAsPng(res.v, `ticket_${ticket?.code}.png`); }}>Сохранить PNG</button></div>
			</>}
		</Popup>
	);
}

interface ViewTicketProps
{
	event: EventData | undefined,
	ticket: Ticket | null,
	close: () => void,
}
