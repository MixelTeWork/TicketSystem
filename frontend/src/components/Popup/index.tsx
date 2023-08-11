import classNames from "../../utils/classNames";
import styles from "./styles.module.css"

export default function Popup({ children, open = false, close, title = "" }: CustomPopupProps)
{
	return (
		<div className={classNames(styles.root, open && styles.open)}>
			<div className={styles.popup}>
				{
					(title || close) &&
					<div className={styles.header}>
						<h3>{title}</h3>
						{close && <button className={styles.close} onClick={close}>✖</button>}
					</div>
				}
				<div className={styles.body}>
					{children}
				</div>
			</div>
		</div>
	);
}

export interface PopupProps
{
	open?: boolean,
	close?: () => void,
}

interface CustomPopupProps extends PopupProps, React.PropsWithChildren
{
	title?: string,
}