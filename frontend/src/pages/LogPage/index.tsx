import { type LogItem, useLog, useLogCacheClear, useLogLen } from "../../api/log";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, Pagination, SearchField } from "../../components/Page";
import Spinner from "../../components/Spinner";
import { datetimeToString, parseUtcDate } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";

export default function LogPage()
{
	useTitle("Журнал");
	const clearCache = useLogCacheClear();
	const page = useStateObj(0);
	const search = useStateObj("");
	const log = useLog(page.v);
	const length = useLogLen();
	const pages = Math.max(1, length.data?.len ?? 1);
	const filtered = log.data?.filter(item => matchesSearch(`${item.actionCode} ${item.tableName} ${item.recordId} ${item.userName} ${item.userId} ${JSON.stringify(item.changes)}`, search.v));
	return <Layout backLink="/d" centeredPage>
		<PageHeading title="Журнал"><button disabled={log.isFetching} className="button" onClick={() => { clearCache(); page.set(0); void log.refetch(); }}>Обновить</button></PageHeading>
		<div className="toolbar"><SearchField value={search.v} onChange={search.set} placeholder="Поиск на текущей странице" /></div>
		{displayError(log)}{displayError(length)}{log.isFetching && <Spinner />}
		<DataTable footer={<Pagination page={page.v + 1} pages={pages} onChange={value => page.set(value - 1)} disabled={log.isFetching} />}>
			<thead><tr><th>Дата</th><th>Действие</th><th>Таблица [ID]</th><th>Пользователь [ID]</th><th>Изменения</th></tr></thead>
			<tbody>{filtered?.map(item => <tr key={item.id}>
				<td>{datetimeToString(item.date, true, true)}</td><td>{colorizeAction(item.actionCode)}</td><td>{item.tableName} [{item.recordId}]</td><td>{item.userName} [{item.userId}]</td>
				<td>{item.changes.length > 0 ? <details><summary>{item.changes.length} изменений</summary>{item.changes.map(change => <p key={change[0]}><code>{change[0]}</code>: {changeValue(change[0], change[1])} → {changeValue(change[0], change[2])}</p>)}</details> : "—"}</td>
			</tr>)}{filtered?.length == 0 && <tr><td colSpan={5}><EmptyState /></td></tr>}</tbody>
		</DataTable>
	</Layout>;
}

function colorizeAction(action: LogItem["actionCode"])
{
	return <span className={action == "deleted" ? "danger-text" : action == "added" ? "success-text" : "muted"}>{action}</span>;
}

function changeValue(field: string, value: unknown)
{
	if (/date$/i.test(field) && typeof value == "string")
	{
		const date = parseUtcDate(value);
		if (Number.isFinite(date.getTime())) return datetimeToString(date, true);
	}
	return JSON.stringify(value);
}
