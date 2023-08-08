import { useNavigate } from "react-router-dom";
import styles from "./styles.module.css"

export default function HeaderBack()
{
	const navigate = useNavigate();
	return (
		<div className={styles.root}>
			<button onClick={() => navigate(-1)}>
				Назад
			</button>
		</div>
	);
}
