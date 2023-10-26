import { useUsers } from "../../api/user";
import Layout from "../../components/Layout";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTtile";
import styles from "./styles.module.css"

export default function UsersPage()
{
	useTitle("Пользователи");
	const users = useUsers()

	return (
		<Layout centeredPage gap={8}>
			{users.isLoading && <h3>Загрузка</h3>}
			{displayError(users)}
			{users.data?.map(v => <div className={styles.user} key={v.id}>
				<input type="checkbox" className={styles.toggleInp} id={`user${v.id}`} />
				<label className={styles.title} htmlFor={`user${v.id}`}>
					<div>
						<div>{v.login}</div>
						<div style={{ color: "blue" }}>{v.id}</div>
						<div>|</div>
						<div>{v.name}</div>
						{v.bossId != null && <>
							<div>|</div>
							<div style={{ color: "#990099" }}>{users.data.find(u => u.id == v.bossId)?.login}</div>
						</>}
					</div>
					<div>
						{v.deleted && <>
							<div style={{ color: "tomato" }}>deleted</div>
							<div>|</div>
						</>}
						<span>{v.role}</span>
						<div className={styles.toggle}></div>
					</div>
				</label>
				<div className={styles.userInfo}>
					<div>
						<h4>Operations</h4>
						<div className={styles.operations}>
							{v.operations.map((o, i) => <div key={i}>{colorizeOperation(o)}</div>)}
						</div>
					</div>
					<div>
						<h4>Access</h4>
						<div className={styles.operations}>
							{v.access.map((o, i) => <div key={i}>{o}</div>)}
						</div>
					</div>
				</div>
			</div>)}
		</Layout>
	);
}

function colorizeOperation(operation: string)
{
	const colors = {
		page: "#990099",
		add: "#008000",
		get: "#008000",
		change: "#006fb3",
		delete: "#b30000",
	}
	for (const prefix in colors)
	{
		if (operation.startsWith(prefix))
			return <>
				<span style={{ color: colors[prefix as keyof typeof colors] }}>{prefix}</span>
				<span>{operation.slice(prefix.length)}</span>
			</>
	}
	return <span>{operation}</span>
}