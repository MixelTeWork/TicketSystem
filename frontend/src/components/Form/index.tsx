import classNames from "../../utils/classNames";
import styles from "./styles.module.css";

export function Form({ className, style, onSubmit, children, disabled }: FormProps)
{
	return (
		<form
			className={classNames(styles.form, className)}
			style={style}
			onSubmit={e =>
			{
				e.preventDefault();
				if (!disabled)
					onSubmit();
			}}
		>
			{children}
		</form>
	);
}

interface FormProps extends React.PropsWithChildren
{
	onSubmit: () => void,
	disabled?: boolean,
	className?: string,
	style?: React.CSSProperties,
}


export function FormField({ label, className, style, children }: FormFieldProps)
{
	const Tag = label ? "label" : "div";
	return (
		<Tag className={classNames(styles.field, className)} style={style}>
			{label && <span>{label}</span>}
			{children}
		</Tag>
	);
}

interface FormFieldProps extends React.PropsWithChildren
{
	label?: string,
	className?: string,
	style?: React.CSSProperties,
}
