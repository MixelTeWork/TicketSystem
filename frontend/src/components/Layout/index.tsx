import classNames from "../../utils/classNames";
import Header from "../Header";
import styles from "./styles.module.css"

export default function Layout({ children, centered = false, gap = 0, header = <Header /> }: LayoutProps)
{
	return (
		<div className={styles.root}>
			{header}
			<div className={classNames(styles.body, centered && styles.body_centered)} style={{ gap }}>
				{children}
			</div>
		</div>
	);
}

interface LayoutProps extends React.PropsWithChildren
{
	centered?: boolean,
	gap?: number | string,
	header?: React.ReactNode,
}
