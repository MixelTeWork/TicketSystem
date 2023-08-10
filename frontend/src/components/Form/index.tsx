import classNames from "../../utils/classNames";
import styles from "./styles.module.css"

export function Form({ className, style, onSubmit, children }: FormProps)
{
	return (
		<form
			className={classNames(styles.form, className)}
			style={style}
			onSubmit={e =>
			{
				e.preventDefault();
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
	className?: string,
	style?: React.StyleHTMLAttributes<HTMLFormElement>,
}


export function FormField({ label, className, style, children }: FormFieldProps)
{
	return (
		<label className={classNames(styles.field, className)} style={style}>
			<span>{label}</span>
			{children}
		</label>
	);
}

interface FormFieldProps extends React.PropsWithChildren
{
	label?: string,
	className?: string,
	style?: React.StyleHTMLAttributes<HTMLLabelElement>,
}
