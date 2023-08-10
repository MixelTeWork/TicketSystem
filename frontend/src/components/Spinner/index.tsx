import styles from "./styles.module.css"

export default function Spinner({ color, zIndex }: SpinnerProps)
{
	return (
		<div className={styles.root}>
			<div className={styles.spinner} style={{ "--color": color, zIndex } as React.CSSProperties}><div></div><div></div><div></div><div></div></div>
		</div>
	);
}

interface SpinnerProps
{
	color?: string,
	zIndex?: number,
}