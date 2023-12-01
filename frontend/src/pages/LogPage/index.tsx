import { LogItem, useLog } from "../../api/log";
import Layout from "../../components/Layout"
import { datetimeToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTtile";
import styles from "./styles.module.css"

export default function LogPage()
{
	useTitle("Log");
	const log = useLog();

	return <Layout centeredPage>
		{log.isFetching && <h3>Загрузка</h3>}
		{displayError(log)}
		{!log.isFetching && <button className="button button_small" onClick={() => log.refetch()}>Update</button>}
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
	</Layout>
}

function colorizeAction(action: LogItem["actionCode"])
{
	const colors: { [key in LogItem["actionCode"]]: string } = {
		added: "#008000",
		deleted: "#b30000",
		updated: "#006fb3",
		restored: "#990099",
	}
	return <span style={{ color: colors[action] }}>{action}</span>
}
