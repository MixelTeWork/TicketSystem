import useStateObj from "../../utils/useStateObj";
import { type LogItem, useLog, useLogCacheClear, useLogLen } from "../../api/log";
import Layout from "../../components/Layout";
import { datetimeToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

export default function LogPage()
{
	useTitle("Log");
	const clearCache = useLogCacheClear();
	const page = useStateObj(0);
	const log = useLog(page.v);
	const logLen = useLogLen().data?.len ?? 0;

	return <Layout centeredPage>
		{displayError(log)}
		<div className={styles.btns}>
			<button disabled={log.isFetching} className="button button_small" onClick={() => { clearCache(); page.set(0); log.refetch(); }}>Update</button>
			<button disabled={log.isFetching} className="button button_small" onClick={() => page.set(0)}>&lt;&lt;</button>
			<button disabled={log.isFetching} className="button button_small" onClick={() => page.set(p => Math.max(p - 1, 0))}>&lt;</button>
			<span>{page.v + 1}/{logLen}</span>
			<button disabled={log.isFetching} className="button button_small" onClick={() => page.set(p => Math.max(0, Math.min(p + 1, logLen - 1)))}>&gt;</button>
			<button disabled={log.isFetching} className="button button_small" onClick={() => page.set(Math.max(0, logLen - 1))}>&gt;&gt;</button>
		</div>
		{log.isFetching && <h3>Загрузка</h3>}
		<table className={styles.table}>
			<thead>
				<tr>
					<th style={{ minWidth: "9.5em" }}>Date</th>
					<th style={{ minWidth: "4em" }}>Action</th>
					<th style={{ minWidth: "9.5em" }}>Table[id]</th>
					<th>User[id]</th>
					<th style={{ width: "18em" }}>Changes</th>
				</tr>
			</thead>
			<tbody>
				{log.data?.map(item => <tr key={item.id}>
					<td>{datetimeToString(item.date, true, true)}</td>
					<td>{colorizeAction(item.actionCode)}</td>
					<td>{item.tableName}[{item.recordId}]</td>
					<td>{item.userName} [{item.userId}]</td>
					<td className={styles.changesCell}>
						<div className={styles.changes}>
							<input type="checkbox" className={styles.toggleInp} id={`item${item.id}`} />
							<div>
								{item.changes.map(v => <div key={v[0]}>{v[0]}: {JSON.stringify(v[1])} {"->"} {JSON.stringify(v[2])}</div>)}
							</div>
							{item.changes.length > 0 &&
								<label className="button button_small" htmlFor={`item${item.id}`}>{item.changes.length}</label>
							}
						</div>
					</td>
				</tr>)}
			</tbody>
		</table>
	</Layout>;
}

function colorizeAction(action: LogItem["actionCode"])
{
	const colors: { [key in LogItem["actionCode"]]: string } = {
		added: "#008000",
		deleted: "#b30000",
		updated: "#006fb3",
		restored: "#990099",
	};
	return <span style={{ color: colors[action] }}>{action}</span>;
}
