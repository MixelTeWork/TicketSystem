import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutationLogout } from "../../api/auth";
import { useEvent } from "../../api/events";
import useUser from "../../api/user";
import displayError from "../../utils/displayError";
import Spinner from "../Spinner";
import logo from "./logo64.png";
import styles from "./styles.module.css";

const titles: Record<string, string> = { events: "Мероприятия", tickets: "Билеты", staff: "Сотрудники", fonts: "Шрифты", managers: "Организаторы", profile: "Профиль", d: "Администрирование", users: "Пользователи", log: "Журнал", help: "Инструкция", "whats-new": "Что нового" };

export default function Header({ backLink }: { backLink?: string })
{
	const location = useLocation();
	const navigate = useNavigate();
	const mutation = useMutationLogout();
	const user = useUser();
	const segments = location.pathname.split("/").filter(Boolean);
	const event = useEvent(segments[0] == "events" ? segments[1] || "" : "", { enabled: false });
	const title = (segment: string) => titles[segment] || (segments[0] == "help" ? "Статья" : segments[0] == "whats-new" ? "Выпуск" : event.data?.name || "Мероприятие");
	return <>
		<header className={styles.root}><div className={styles.inner}>
			<Link to="/" className={styles.brand} aria-label="Билетная система — на главную">
				<img src={logo} width={28} height={28} alt="" />
				<span>Билетная система</span>
			</Link>
			<nav className={styles.helpLinks} aria-label="Помощь"><Link to="/help">Инструкция</Link><Link to="/whats-new">Что нового</Link></nav>
			<details className={styles.account}><summary><span className={styles.accountName}>{user.data?.name}</span><span className={styles.avatar}>{user.data?.name.slice(0, 1)}</span></summary>
				<div className={styles.menu}><Link to="/profile">Профиль</Link><button className="row-action" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Выйти</button>{mutation.isPending && <Spinner />}{displayError(mutation)}</div>
			</details>
		</div></header>
		{segments.length > 0 && <nav className={styles.breadcrumbs} aria-label="Навигационная цепочка">
			{backLink ? <Link to={backLink}>← Назад</Link> : <button className="row-action" onClick={() => navigate(-1)}>← Назад</button>}
			<Link to="/">Главная</Link>
			{segments.map((segment, i) => <span key={i} className={styles.crumb}>
				<span aria-hidden="true">/</span>{i == segments.length - 1 ? <span aria-current="page">{title(segment)}</span> : <Link to={`/${segments.slice(0, i + 1).join("/")}`}>{title(segment)}</Link>}
			</span>)}
		</nav>}
	</>;
}
