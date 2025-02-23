import classNames from "../../utils/classNames";
import Header from "../Header";
import styles from "./styles.module.css"

export default function Layout({ children, className, backLink, centeredH = false, centered = false, centeredPage = false, height100 = false, gap = 0, padding, header }: LayoutProps)
{
	if (header === undefined) header = <Header backLink={backLink} />

	return (
		<div className={styles.root} style={{ maxHeight: height100 ? "100dvh" : "" }}>
			{header || <div></div>}
			<div
				className={classNames(
					styles.body, className,
					centered && styles.body_centered,
					centeredH && styles.body_centeredH,
					centeredPage && styles.body_centeredPage,
				)}
				style={{ gap, maxHeight: height100 ? "100%" : "", padding }}
			>
				{children}
			</div>
		</div>
	);
}

interface LayoutProps extends React.PropsWithChildren
{
	backLink?: string,
	centeredPage?: boolean,
	centered?: boolean,
	centeredH?: boolean,
	height100?: boolean,
	gap?: number | string,
	padding?: number | string,
	className?: string,
	header?: React.ReactNode,
}
