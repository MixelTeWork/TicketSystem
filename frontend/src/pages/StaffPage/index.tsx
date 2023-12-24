import { useState } from "react";
import { useHasPermission } from "../../api/operations";
import { useMutationDeleteStaff, useMutationResetStaffPassword, useStaff } from "../../api/staff";
import Layout from "../../components/Layout";
import { useTitle } from "../../utils/useTtile";
import styles from "./styles.module.css"
import CreateStaffForm from "../../components/create/CreateStaffForm";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";

export default function StaffPage()
{
	useTitle("Сотрудники");
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [delitionStaff, setDelitionStaff] = useState(-1);
	const [resetPasswordStaff, setResetPasswordStaff] = useState(-1);
	const staff = useStaff();

	return (
		<Layout centeredPage gap={8}>
			<h1>Сотрудники</h1>
			{staff.isLoading && <Spinner/>}
			{displayError(staff)}
			{staff.data?.length == 0 && <h2>У вас нет сотрудников</h2>}
			{staff.data?.map(v => <div className={styles.user} key={v.id}>
				<input type="checkbox" className={styles.toggleInp} id={`user${v.id}`} />
				<label className={styles.title} htmlFor={`user${v.id}`}>
					<div>{v.name}</div>
					<div>
						<span>{v.role}</span>
						<div className={styles.toggle}></div>
					</div>
				</label>
				<div className={styles.userInfo}>
					<div>Логин: {v.login}</div>
					<div>
						<span>Пароль: </span>
						{v.password || <button className="button button_light button_small" onClick={() => setResetPasswordStaff(v.id)}>Сбросить пароль</button>}
					</div>
					<div className={styles.space_between}>
						<span></span>
						<button className="button button_danger button_small" onClick={() => setDelitionStaff(v.id)}>Уволить</button>
					</div>
				</div>
			</div>)}
			{useHasPermission("add_staff") &&
				<div className={styles.space_between}>
					<span></span>
					<button className="button" onClick={() => setCreateFormOpen(true)}>Добавить</button>
				</div>
			}
			<CreateStaffForm open={createFormOpen} close={() => setCreateFormOpen(false)} />
			<PopupConfirmDeletion itemId={delitionStaff} title="Увольнение сотрудника" mutationFn={useMutationDeleteStaff} open={delitionStaff >= 0} close={() => setDelitionStaff(-1)} />
			<PopupConfirmDeletion itemId={resetPasswordStaff} title="Сброс пароля сотрудника" mutationFn={useMutationResetStaffPassword} open={resetPasswordStaff >= 0} close={() => setResetPasswordStaff(-1)} />
		</Layout>
	);
}
