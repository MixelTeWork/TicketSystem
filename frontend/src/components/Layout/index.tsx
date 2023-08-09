import classNames from "../../utils/classNames";
import Header from "../Header";
import styles from "./styles.module.css"

export default function Layout({ children, className, centered = false, centeredPage = false, height100 = false, gap = 0, header = <Header /> }: LayoutProps)
{
	return (
		<div className={styles.root} style={{ maxHeight: height100 ? "100dvh" : "" }}>
			{header || <div></div>}
			<div
				className={classNames(
					styles.body, className,
					centered && styles.body_centered,
					centeredPage && styles.body_centeredPage,
				)}
				style={{ gap, maxHeight: height100 ? "100%" : "" }}
			>
				{children}
			</div>
		</div>
	);
}

interface LayoutProps extends React.PropsWithChildren
{
	centeredPage?: boolean,
	centered?: boolean,
	height100?: boolean,
	gap?: number | string,
	className?: string,
	header?: React.ReactNode,
}
