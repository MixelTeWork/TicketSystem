import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useEvents } from "../../api/events";
import { useHasPermission } from "../../api/operations";
import { useMutationDeleteStaff, useMutationResetStaffPassword, useStaff } from "../../api/staff";
import { type StaffMember } from "../../api/user";
import CreateStaffForm from "../../components/create/CreateStaffForm";
import EditStaffAccessForm from "../../components/edit/EditStaffAccessForm";
import Layout from "../../components/Layout";
import { DataTable, EmptyState, matchesSearch, PageHeading, SearchField } from "../../components/Page";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj, { useStateObjNull } from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

export default function StaffPage()
{
	useTitle("Сотрудники");
	const createFormOpen = useStateBool(false);
	const deletionStaff = useStateObj(-1);
	const resetPasswordStaff = useStateObj(-1);
	const search = useStateObj("");
	const menuOpen = useStateObjNull<number>();
	const editAccess = useStateObjNull<StaffMember>();
	const staff = useStaff();
	const events = useEvents();
	const canAdd = useHasPermission("add_staff");
	const canReset = useHasPermission("change_staff");
	const canDelete = useHasPermission("delete_staff");
	const canAccess = useHasPermission("change_staff_event");
	const filtered = staff.data?.filter(member => matchesSearch(`${member.name} ${member.login} ${member.roles.join(" ")}`, search.v));
	return <Layout backLink="/" centeredPage>
		<PageHeading title="Сотрудники">{canAdd && <button className="button button_primary" onClick={createFormOpen.setT}>＋ Добавить</button>}</PageHeading>
		<div className="toolbar"><SearchField value={search.v} onChange={search.set} /></div>
		{staff.isLoading && <Spinner />}{displayError(staff)}{displayError(events)}
		{staff.isSuccess && <DataTable><thead><tr><th>Имя</th><th>Роли</th><th>Доступ к мероприятиям</th><th /></tr></thead><tbody>
			{filtered?.map(member =>
			{
				const access = events.data?.filter(event => member.access?.includes(event.id)).sort((a, b) => b.date.localeCompare(a.date)) || [];
				return <Fragment key={member.id}><tr>
					<td>{member.name}</td>
					<td>{member.roles.join(", ")}</td>
					<td>{access.slice(0, 2).map(event => <div key={event.id}><Link to={`/events/${event.id}`}>{event.name}</Link></div>)}{access.length > 2 && <span className="badge" title={access.slice(2).map(event => event.name).join(", ")}>+{access.length - 2}</span>}{access.length == 0 && <span className="muted">Нет доступа</span>}</td>
					<td><button className="row-action" aria-label={`Действия сотрудника ${member.name}`} aria-expanded={menuOpen.v == member.id} aria-controls={`staff-actions-${member.id}`} onClick={() => menuOpen.set(menuOpen.v == member.id ? null : member.id)}>•••</button></td>
				</tr>{menuOpen.v == member.id && <tr id={`staff-actions-${member.id}`}><td colSpan={4}>
					<div className={styles.menuItems}>
						<span>Логин: <code>{member.login}</code></span>
						<span>Пароль: {member.password ? <code>{member.password}</code> : canReset ? <button className="row-action" onClick={() => resetPasswordStaff.set(member.id)}>Сбросить пароль</button> : "Недоступен"}</span>
						{canAccess && <button className="row-action" onClick={() => editAccess.set(member)}>Изменить доступ</button>}
						{canDelete && <button className="row-action danger-text" onClick={() => deletionStaff.set(member.id)}>Уволить</button>}
					</div>
					{access.length > 2 && <p className="muted">{access.map(event => event.name).join(", ")}</p>}
				</td></tr>}</Fragment>;
			})}
			{filtered?.length == 0 && <tr><td colSpan={4}><EmptyState>{search.v ? "Ничего не найдено" : "У вас нет сотрудников"}</EmptyState></td></tr>}
		</tbody></DataTable>}
		<CreateStaffForm open={createFormOpen.v} close={createFormOpen.setF} />
		{editAccess.v && <EditStaffAccessForm member={editAccess.v} close={editAccess.setNull} />}
		<PopupConfirmDeletion mutationParams={undefined} itemId={deletionStaff.v} title="Увольнение сотрудника" mutationFn={useMutationDeleteStaff} open={deletionStaff.v >= 0} close={() => deletionStaff.set(-1)} />
		<PopupConfirmDeletion mutationParams={undefined} itemId={resetPasswordStaff.v} title="Сброс пароля сотрудника" mutationFn={useMutationResetStaffPassword} open={resetPasswordStaff.v >= 0} close={() => resetPasswordStaff.set(-1)} />
	</Layout>;
}
