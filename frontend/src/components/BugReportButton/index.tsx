import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useReportBug } from "../../api/bugReports";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { Form, FormField } from "../Form";
import Popup from "../Popup";
import Spinner from "../Spinner";
import styles from "./styles.module.css";
import Icon from "../Icon";
import classNames from "../../utils/classNames";

export default function BugReportButton({ className = "button", iconOnly = false, onOpenChange }: { className?: string, iconOnly?: boolean, onOpenChange?: (open: boolean) => void })
{
	const location = useLocation();
	const open = useStateObj(false);
	const page = useStateObj("");
	const description = useStateObj("");
	const mutation = useReportBug(() => description.set(""));
	useEffect(() =>
	{
		onOpenChange?.(open.v);
		return () => onOpenChange?.(false);
	}, [open.v, onOpenChange]);
	return <>
		<button type="button" className={classNames(className, iconOnly && styles.iconButton)} aria-label={iconOnly ? "Сообщить об ошибке" : undefined} title={iconOnly ? "Сообщить об ошибке" : undefined} aria-haspopup="dialog" onClick={() =>
		{
			mutation.reset();
			page.set(location.pathname);
			open.set(true);
		}}>{iconOnly ? <Icon icon="bug_report" /> : "Сообщить об ошибке"}</button>
		{open.v && <Popup open close={() => open.set(false)} closeDisabled={mutation.isPending} title="Сообщить об ошибке">
			<div className={styles.content}>
				{mutation.isSuccess ? <>
					<p role="status">Сообщение №{mutation.data.id} отправлено. Спасибо!</p>
					<button className="button" onClick={() => open.set(false)}>Закрыть</button>
				</> : <>
					<p className="muted">Расскажите, что произошло и что вы ожидали. Если можете, укажите шаги для повторения ошибки.</p>
					{displayError(mutation)}
					<Form disabled={mutation.isPending} onSubmit={() =>
					{
						if (description.v.trim() && !mutation.isPending)
							mutation.mutate({ description: description.v.trim(), page: page.v });
					}}>
						<FormField label="Описание ошибки"><textarea className={styles.description} rows={6} maxLength={5000} required value={description.v} disabled={mutation.isPending} onChange={e => description.set(e.target.value)} /></FormField>
						<p className="muted">К сообщению добавятся ваш аккаунт, время, браузер и страница: <code className={styles.page}>{page.v}</code></p>
						<div className="actions"><button type="submit" className="button button_primary" disabled={!description.v.trim() || mutation.isPending}>{mutation.isPending ? "Отправка…" : "Отправить"}</button>{mutation.isPending && <Spinner />}</div>
					</Form>
				</>}
			</div>
		</Popup>}
	</>;
}
