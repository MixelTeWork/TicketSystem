import { useBugReports } from "../../api/bugReports";
import Layout from "../../components/Layout";
import Icon from "../../components/Icon";
import { EmptyState, PageHeading, Pagination } from "../../components/Page";
import Spinner from "../../components/Spinner";
import { datetimeToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

export default function BugReportsPage()
{
	useTitle("Сообщения об ошибках");
	const page = useStateObj(0);
	const reports = useBugReports(page.v);
	return <Layout backLink="/d" centeredPage>
		<PageHeading title="Сообщения об ошибках" description="Сообщения пользователей, новые первыми.">
			<button className="button button_icon" aria-label="Обновить" title="Обновить сообщения" disabled={reports.isFetching} onClick={() => void reports.refetch()}><Icon icon="refresh" /></button>
		</PageHeading>
		{displayError(reports)}{reports.isFetching && <Spinner />}
		{reports.data && <>
			<p className="muted">Всего: {reports.data.total}</p>
			{reports.data.items.length == 0 && <EmptyState>Сообщений пока нет</EmptyState>}
			<ol className={styles.list}>{reports.data.items.map(report => <li key={report.id} className="panel">
				<div className={styles.meta}><strong>№{report.id} · {report.userName}</strong><time dateTime={report.createdAt.toISOString()}>{datetimeToString(report.createdAt, true, true)}</time></div>
				<p className={styles.page}><code>{report.page}</code></p>
				<details><summary className={styles.preview}>{report.description.length > 140 ? report.description.slice(0, 140) + "…" : report.description}</summary>
					<p className={styles.description}>{report.description}</p>
					<p className="muted">Аккаунт: {report.userLogin} [ID {report.userId}]</p>
					<p className={styles.browser}>Браузер: {report.userAgent || "Не указан"}</p>
				</details>
			</li>)}</ol>
			<Pagination page={page.v + 1} pages={reports.data.pages} onChange={value => page.set(value - 1)} disabled={reports.isFetching} />
		</>}
	</Layout>;
}
