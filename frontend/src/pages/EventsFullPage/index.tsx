import { useEventsFull, useMutationGetAccessToEvent } from "../../api/events";
import useUser from "../../api/user";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import { dateToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTtile";
import styles from "./styles.module.css"

export default function UsersPage()
{
	useTitle("События");
	const user = useUser();
	const events = useEventsFull()
	const getAccessToEvent = useMutationGetAccessToEvent();

	return (
		<Layout centeredPage gap={8}>
			{events.isLoading && <h3>Загрузка</h3>}
			{!events.isLoading && events.isFetching && <h3>Обновление</h3>}
			{getAccessToEvent.isLoading && <Spinner />}
			{displayError(events)}
			{displayError(getAccessToEvent)}
			{events.data?.map(v => <div className={styles.event} key={v.id}>
				<input type="checkbox" className={styles.toggleInp} id={`user${v.id}`} />
				<label className={styles.title} htmlFor={`user${v.id}`}>
					<div>
						<div style={{ color: "blue" }}>{v.id}</div>
						<div>|</div>
						<div>{dateToString(v.date)}</div>
						<div>|</div>
						<div>{v.name}</div>
					</div>
					<div>
						{v.deleted && <>
							<div style={{ color: "tomato" }}>deleted</div>
							<div>|</div>
						</>}
						<div className={styles.activeMark} style={{ backgroundColor: v.active ? "green" : "tomato" }} title="active"></div>
						<div className={styles.toggle}></div>
					</div>
				</label>
				<div className={styles.eventInfo}>
					<div>
						<h4>Access</h4>
						<div className={styles.access}>
							{v.access.map((o, i) => <div key={i}>
								<div>{o.login}</div>
								<div style={{ color: "blue" }}>{o.id}</div>
								<div>|</div>
								<div>{o.name}</div>
							</div>)}
						</div>
					</div>
					{!v.access.some(v => v.id == user.data?.id) &&
						<button
							className="button button_light button_small"
							style={{ alignSelf: "end" }}
							onClick={() => getAccessToEvent.mutate(v.id)}
						>Get access</button>
					}
				</div>
			</div>)
			}
		</Layout >
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