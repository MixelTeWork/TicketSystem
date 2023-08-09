import { Link, useNavigate } from "react-router-dom";
import styles from "./styles.module.css"
import logo from "./logo64.png"
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
			<Link to="/" className={styles.home}>
				<img src={logo} alt="На главную" />
			</Link>
			<span className={styles.user}>
				<span>{user.data?.name}</span>
				<button onClick={() => mutation.mutate()} disabled={mutation.status == "loading"}>
					Выйти
				</button>
			</span>
		</div>
	);
}
