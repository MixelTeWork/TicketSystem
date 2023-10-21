import { useParams } from "react-router-dom";
import styles from "./styles.module.css"
import { useEvent } from "../../api/events";
import useTickets from "../../api/tickets";
import { useTitle } from "../../utils/useTtile";
import Spinner from "../../components/Spinner";
import { useEffect, useMemo } from "react";
import getTicketPrefix from "../../utils/getTicketPrefix";
import displayError from "../../utils/displayError";

export default function PrintTicketsPage()
{
	const urlParams = useParams();
	const eventId = urlParams["eventId"]!;
	const event = useEvent(eventId);
	const tickets = useTickets(eventId);
	useTitle([event.data?.name, "Билеты"]);

	const [isCorrectCodes, prefix] = useMemo(() =>
	{
		if (!tickets.data || !event.data) return [false, ""];
		const codePref = getTicketPrefix(event.data.id, event.data.date);
		return [tickets.data.every(v => v.code.startsWith(codePref)), codePref];
	}, [tickets.data, event.data]);

	useEffect(() =>
	{
		if (event.isSuccess && tickets.isSuccess)
		{
			const timeout = setTimeout(() => window.print(), 1000);
			return () => clearTimeout(timeout);
		}
	}, [event.isSuccess, tickets.isSuccess]);

	return (
		<>
			{(event.isLoading || tickets.isLoading) && <Spinner />}
			{displayError(event)}
			{displayError(tickets)}
			{event.isSuccess && tickets.isSuccess &&
				<div className={styles.root}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th colSpan={5}>
									<span>{event.data.name}</span>
									{isCorrectCodes && <span style={{ marginLeft: "1rem" }}>|</span>}
									{isCorrectCodes && <span style={{ marginLeft: "1rem" }}>Все коды дожны начинаться с {prefix}</span>}
								</th>
							</tr>
							<tr>
								<th>Код</th>
								<th>Посетитель</th>
								<th>Тип билета</th>
								<th>Промокод</th>
								<th><div>Исполь</div><div>зован</div></th>
							</tr>
						</thead>
						<tbody>
							{tickets.data
								.map(v => isCorrectCodes
									? { ...v, code: v.code.slice(prefix.length), sortV: v.code.slice(v.code.lastIndexOf("-")) }
									: { ...v, sortV: v.code })
								.sort((a, b) => a.sortV > b.sortV ? 1 : -1)
								.map(v => <tr key={v.id}>
									<td>{v.code}</td>
									<td>{v.personName}</td>
									<td>{v.type.startsWith("<Удалён>") ? v.type.slice(8) : v.type}</td>
									<td>{v.promocode}</td>
									<td className={styles.center}><span className={styles.mark}>{v.scanned && "✓"}</span></td>
								</tr>
								)}
						</tbody>
					</table>
				</div>
			}
		</>
	);
}
