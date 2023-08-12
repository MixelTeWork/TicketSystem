import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./styles.module.css"
import logo from "./logo64.png"
import { useMutationLogout } from "../../api/auth";
import useUser from "../../api/user";
import Spinner from "../Spinner";

export default function Header({ backLink }: HeaderProps)
{
	const location = useLocation();
	const navigate = useNavigate();
	const mutation = useMutationLogout();
	const user = useUser();

	return (
		<div className={styles.root}>
			<span className={styles.block}>
				<Link to="/" className={styles.home}>
					<img src={logo} alt="На главную" />
				</Link>
				{backLink && <Link to={backLink}><button>Назад</button></Link>}
				{location.pathname != "/" && !backLink && <button onClick={() => backLink ? navigate(backLink) : navigate(-1)}>Назад</button>}
			</span>
			<span className={styles.block}>
				<span>{user.data?.name}</span>
				<button onClick={() => mutation.mutate()} disabled={mutation.status != "idle"}>
					Выйти
				</button>
			</span>
			{mutation.status != "idle" && <Spinner />}
		</div>
	);
}

interface HeaderProps
{
	backLink?: string,
}