import { Fragment } from "react";
import { useUsers } from "../../api/user";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, SearchField } from "../../components/Page";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import useStateObj, { useStateObjNull } from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";

export default function UsersPage()
{
	useTitle("Пользователи");
	const users = useUsers();
	const search = useStateObj("");
	const expanded = useStateObjNull<number>();
	const filtered = users.data?.filter(user => matchesSearch(`${user.id} ${user.name} ${user.login} ${user.roles.map(([, name]) => name).join(" ")}`, search.v));
	return <Layout backLink="/d" centeredPage>
		<PageHeading title="Пользователи" />
		<div className="toolbar"><SearchField value={search.v} onChange={search.set} placeholder="ID, имя, логин или роль" /></div>
		{users.isLoading && <Spinner />}{displayError(users)}
		{users.isSuccess && <DataTable><thead><tr><th>ID / логин</th><th>Имя</th><th>Руководитель</th><th>Роли / статус</th><th>Права</th></tr></thead><tbody>
			{filtered?.map(user => <Fragment key={user.id}>
				<tr><td><span className="muted">{user.id}</span> <code>{user.login}</code></td><td>{user.name}</td><td>{users.data?.find(boss => boss.id == user.bossId)?.login || user.bossId || "—"}</td><td>{user.roles.map(([, name]) => name).join(", ")} {user.deleted && <span className="badge danger-text">Удалён</span>}</td>
					<td><button className="row-action" aria-expanded={expanded.v == user.id} aria-controls={`user-permissions-${user.id}`} onClick={() => expanded.set(expanded.v == user.id ? null : user.id)}>Права</button></td>
				</tr>{expanded.v == user.id && <tr id={`user-permissions-${user.id}`}><td colSpan={5}>
					<div className="permissions"><section><h3>Operations</h3><ul>{user.operations.map(operation => <li key={operation}><code>{operation}</code></li>)}</ul>{user.operations.length == 0 && <p className="muted">Нет прав</p>}</section>
						<section><h3>Access</h3><p>{user.access.join(", ") || "Нет доступа"}</p></section></div>
				</td></tr>}
			</Fragment>)}
			{filtered?.length == 0 && <tr><td colSpan={5}><EmptyState /></td></tr>}
		</tbody></DataTable>}
	</Layout>;
}
