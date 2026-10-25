import { useManagers, useMutationDeleteManager } from "../../api/managers";
import { useHasPermission } from "../../api/operations";
import useUser from "../../api/user";
import CreateManagerForm from "../../components/create/CreateManagerForm";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, SearchField } from "../../components/Page";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";

export default function ManagersPage()
{
	useTitle("Организаторы");
	const createFormOpen = useStateBool(false);
	const deletionManager = useStateObj(-1);
	const search = useStateObj("");
	const user = useUser();
	const managers = useManagers();
	const canAdd = useHasPermission("add_manager");
	const canDelete = useHasPermission("delete_manager");
	const filtered = managers.data?.filter(member => matchesSearch(`${member.name} ${member.login} ${member.roles.join(" ")}`, search.v));
	return <Layout backLink="/" centeredPage>
		<PageHeading title="Организаторы">{canAdd && <button className="button button_primary" onClick={createFormOpen.setT}>＋ Добавить</button>}</PageHeading>
		<div className="toolbar"><SearchField value={search.v} onChange={search.set} /></div>
		{managers.isLoading && <Spinner />}{displayError(managers)}
		{managers.isSuccess && <DataTable><thead><tr><th>Имя</th><th>Логин</th><th>Роли</th><th /></tr></thead><tbody>
			{filtered?.map(member => <tr key={member.id}><td>{member.name} {member.id == user.data?.id && <span className="badge">Вы</span>}</td><td className="code">{member.login}</td><td>{member.roles.join(", ")}</td><td>{canDelete && member.id != user.data?.id && <button className="row-action danger-text" onClick={() => deletionManager.set(member.id)}>Удалить</button>}</td></tr>)}
			{filtered?.length == 0 && <tr><td colSpan={4}><EmptyState>{search.v ? "Ничего не найдено" : "Организаторы отсутствуют"}</EmptyState></td></tr>}
		</tbody></DataTable>}
		<CreateManagerForm open={createFormOpen.v} close={createFormOpen.setF} />
		<PopupConfirmDeletion itemId={deletionManager.v} title="Удаление организатора" mutationFn={useMutationDeleteManager} open={deletionManager.v >= 0} close={() => deletionManager.set(-1)} />
	</Layout>;
}
