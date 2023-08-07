import { useNavigate } from "react-router-dom";
import styles from "./styles.module.css"
import { useMutation, useQueryClient } from "react-query";
import { postLogout } from "../../api/auth";
import useUser from "../../api/user";

export default function Header()
{
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postLogout,
		onSuccess: () =>
		{
			queryClient.invalidateQueries("user");
			navigate("/auth");
		}
	});
	const user = useUser();

	return (
		<div className={styles.root}>
			<span>{user.data?.name}</span>
			<button onClick={() => mutation.mutate()} disabled={mutation.status == "loading"}>
				Выйти
			</button>
		</div>
	);
}
