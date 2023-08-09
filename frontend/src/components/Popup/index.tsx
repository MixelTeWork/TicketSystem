import classNames from "../../utils/classNames";
import styles from "./styles.module.css"

export default function Popup({ children, open = false, close, title = "" }: PopupProps)
{
	return (
		<div className={classNames(styles.root, open && styles.open)}>
			<div className={styles.popup}>
				<div className={styles.header}>
					<h3>{title}</h3>
					<button className={styles.close} onClick={close}>✖</button>
				</div>
				<div className={styles.body}>
					{children}
				</div>
			</div>
		</div>
	);
}

interface PopupProps extends React.PropsWithChildren
{
	open?: boolean,
	close?: () => void,
	title?: string,
}