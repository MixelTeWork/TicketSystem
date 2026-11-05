import type { EventData } from "../../api/events";
import type { TicketStats } from "../../api/tickets";
import type { TicketType } from "../../api/ticketTypes";
import { calendarDate, calendarDayLabel } from "../../utils/multiday";
import classNames from "../../utils/classNames";
import { DataTable, EmptyState } from "../Page";
import styles from "./styles.module.css";

export function Statistic({ value, total, emphasis = false }: { value: number, total: number, emphasis?: boolean })
{
	return <span className={styles.metric}>{emphasis ? <strong>{value.toLocaleString("ru")}</strong> : value.toLocaleString("ru")} <small className="muted">({total ? `${Math.floor(value / total * 100)}%` : "—"})</small></span>;
}
export function totalStats(rows: TicketStats[])
{
	return rows.reduce((sum, row) => ({ count: sum.count + row.count, scanned: sum.scanned + row.scanned, auth: sum.auth + row.authOnPltf, merch: sum.merch + row.merchIssued, checkins: sum.checkins + row.checkinCount, eligible: sum.eligible + row.byDay.reduce((total, day) => total + day.eligible, 0) }), { count: 0, scanned: 0, auth: 0, merch: 0, checkins: 0, eligible: 0 });
}
export function EventTotals({ rows, event }: { rows: TicketStats[], event: EventData })
{
	const sum = totalStats(rows);
	return <><span>Выдано <Statistic emphasis value={sum.count} total={sum.count} /></span><span>{event.dayCount > 1 ? "Использовано билетов" : "Прошли"} <Statistic emphasis value={sum.scanned} total={sum.count} /></span>{event.dayCount > 1 && <span>Проходов <Statistic emphasis value={sum.checkins} total={sum.eligible} /></span>}<span>Мерч <Statistic emphasis value={sum.merch} total={sum.count} /></span>{sum.auth > 0 && <span>В игре <Statistic emphasis value={sum.auth} total={sum.count} /></span>}</>;
}
export default function EventStatistics({ event, rows, types, canEdit, edit, className, totalClassName }: { event: EventData, rows: TicketStats[], types: TicketType[], canEdit: boolean, edit: (id: number) => void, className?: string, totalClassName?: string })
{
	const sum = totalStats(rows);
	const multi = event.dayCount > 1;
	const days = multi ? event.days : [];
	const ids = [...new Set([...types.map(type => type.id), ...rows.map(row => row.typeId)])];
	const columns = 5 + (multi ? days.length - 1 : 0) + Number(sum.auth > 0) + Number(canEdit);
	const groups = new Map<number, { name?: string, deleted: boolean, ids: number[] }>();
	for (const id of ids)
	{
		const row = rows.find(row => row.typeId == id);
		const categoryId = row?.categoryId ?? types.find(type => type.id == id)!.categoryId;
		const group = groups.get(categoryId) ?? { name: row?.categoryName, deleted: false, ids: [] };
		if (row) { group.name = row.categoryName; group.deleted = row.categoryDeleted; }
		group.ids.push(id);
		groups.set(categoryId, group);
	}
	const renderVariant = (id: number) =>
	{
		const type = types.find(type => type.id == id);
		const row = rows.find(row => row.typeId == id);
		const deleted = row?.deleted || row?.categoryDeleted;
		const price = row ? row.price : type?.price;
		return <tr key={id} className={deleted ? "muted" : ""}><td>{row?.name ?? type?.name}{deleted && " (удалён)"}</td><td className={styles.money}>{price == null ? "—" : `${price.toLocaleString("ru")} ₽`}</td><td><Statistic value={row?.count ?? 0} total={sum.count} /></td>
			{multi ? days.map(day =>
			{
				const value = row?.byDay.find(item => item.eventDayId == day.id);
				const eligible = value?.eligible ?? 0;
				const checked = value?.checkedIn ?? 0;
				const allowed = row?.dayOffsets.includes(day.dayOffset) ?? type?.dayOffsets.includes(day.dayOffset) ?? false;
				return <td key={day.id}>{!allowed && !eligible && !checked ? "—" : <Statistic value={checked} total={eligible} />}</td>;
			}) : <td><Statistic value={row?.scanned ?? 0} total={row?.count ?? 0} /></td>}
			<td><Statistic value={row?.merchIssued ?? 0} total={row?.count ?? 0} /></td>{sum.auth > 0 && <td><Statistic value={row?.authOnPltf ?? 0} total={row?.count ?? 0} /></td>}{canEdit && <td>{!deleted && type && <button className="row-action" onClick={() => edit(id)}>{type.pattern ? "Изменить" : "Создать"}</button>}</td>}
		</tr>;
	};
	return <DataTable className={classNames(styles.table, className)}><thead><tr><th>Вид</th><th>Цена</th><th>Выдано</th>{multi ? days.map(day => <th key={day.id} title={calendarDate(day.date, true)}>Вход <span className={styles.day}>{calendarDayLabel(day.date)}</span></th>) : <th>Вход</th>}<th>Мерч</th>{sum.auth > 0 && <th>В игре</th>}{canEdit && <th>Макет</th>}</tr></thead>
		{multi ? [...groups].map(([id, group]) => <tbody key={id}>{group.name !== undefined && <tr className={styles.category}><th colSpan={columns} scope="rowgroup">{group.name}{group.deleted && " (удалена)"}</th></tr>}{group.ids.map(renderVariant)}</tbody>) : <tbody>{ids.map(renderVariant)}</tbody>}
		{!ids.length && <tbody><tr><td colSpan={columns}><EmptyState>Виды билетов ещё не добавлены. {canEdit ? "Откройте редактор видов билетов, чтобы добавить первый вид." : "После добавления видов здесь появится статистика."}</EmptyState></td></tr></tbody>}
		<tfoot><tr className={totalClassName}><td><strong>Всего</strong></td><td /><td><Statistic value={sum.count} total={sum.count} /></td>{multi ? days.map(day => <td key={day.id}><Statistic value={rows.reduce((total, row) => total + (row.byDay.find(item => item.eventDayId == day.id)?.checkedIn ?? 0), 0)} total={rows.reduce((total, row) => total + (row.byDay.find(item => item.eventDayId == day.id)?.eligible ?? 0), 0)} /></td>) : <td><Statistic value={sum.scanned} total={sum.count} /></td>}<td><Statistic value={sum.merch} total={sum.count} /></td>{sum.auth > 0 && <td><Statistic value={sum.auth} total={sum.count} /></td>}{canEdit && <td />}</tr></tfoot>
	</DataTable>;
}
