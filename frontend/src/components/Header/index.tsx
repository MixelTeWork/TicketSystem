import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./styles.module.css"
import logo from "./logo64.png"
import { useMutationLogout } from "../../api/auth";
import useUser from "../../api/user";
import Spinner from "../Spinner";
import { useState } from "react";
import classNames from "../../utils/classNames";

export default function Header({ backLink }: HeaderProps)
{
	const [menuOpen, setMenuOpen] = useState(false);
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
				{backLink && <Link to={backLink}><button className="button button_light">Назад</button></Link>}
				{location.pathname != "/" && !backLink && <button onClick={() => backLink ? navigate(backLink) : navigate(-1)} className="button button_light">Назад</button>}
			</span>
			<span className={styles.block}>
				<button onClick={() => setMenuOpen(v => !v)} className="button button_light">
					<span>{user.data?.name}</span>
				</button>
				<div className={classNames(styles.menu, menuOpen && styles.menuVisible)}>
					<button onClick={() => navigate("/profile")} className="button button_light">
						Профиль
					</button>
					<button onClick={() => mutation.mutate()} disabled={mutation.status != "idle"} className="button button_light">
						Выйти
					</button>
				</div>
			</span>
			{mutation.status != "idle" && <Spinner />}
		</div>
	);
}

interface HeaderProps
{
	backLink?: string,
}