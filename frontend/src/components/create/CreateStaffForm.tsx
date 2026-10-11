import type { PopupProps } from "../Popup";
import { useMutationNewStaff, type StaffRole } from "../../api/staff";
import { type UserWithPwd } from "../../api/user";
import { useEffect } from "react";
import useStateObj from "../../utils/useStateObj";
import { FormField } from "../Form";
import CreateUserForm from "./CreateUserForm";

export default function CreateStaffForm(props: PopupProps)
{
	const role = useStateObj<StaffRole>("clerk");
	useEffect(() =>
	{
		const setRole = role.set;
		if (!props.open) setRole("clerk");
	}, [props.open, role.set]);
	function useCreate(onSuccess: (user: UserWithPwd) => void)
	{
		return useMutationNewStaff(onSuccess, role.v);
	}
	return <CreateUserForm {...props} title="Добавление сотрудника" credentialsTitle="Данные сотрудника" useCreate={useCreate}
		additionalFields={<FormField label="Роль">
			<select value={role.v} onChange={e => role.set(e.target.value == "usher" ? "usher" : "clerk")}>
				<option value="clerk">Клерк — работа с билетами и сканирование</option>
				<option value="usher">Билетёр — только сканирование</option>
			</select>
		</FormField>}
	/>;
}
