import { useEffect } from "react";
import type { Font } from "../../api/fonts";
import classNames from "../../utils/classNames";
import useStateObj from "../../utils/useStateObj";
import type { TicketEditor } from "./editor";
import styles from "./styles.module.css";
import type { TicketPatternObject } from "./types";

type E = React.ChangeEvent<HTMLInputElement>;

export function Inspector({ editor, fonts }: InspectorProps)
{
	const obj = useStateObj<TicketPatternObject | null>(null);

	useEffect(() =>
	{
		const setObj = obj.set;
		editor.setInspector(setObj);
		return () => editor.setInspector(null);
	}, [editor, obj.set]);

	return (
		<div className={classNames(styles.inspector, obj.v && styles.inspector_open)}>
			<h2>{{
				"qr": "QR код",
				"code": "Код билета",
				"name": "Посетитель",
				"promo": "Промокод",
				"price": "Цена",
				"": "",
			}[obj.v?.type || ""]}</h2>
			<div className={styles.fields}>
				<label>
					<span>X:</span>
					<input type="number" value={obj.v?.x ?? 0} onInput={(e: E) => editor.inspectorInput("x", e.target.valueAsNumber)} />
				</label>
				<label>
					<span>Y:</span>
					<input type="number" value={obj.v?.y ?? 0} onInput={(e: E) => editor.inspectorInput("y", e.target.valueAsNumber)} />
				</label>
				<label>
					<span>Ширина:</span>
					<input type="number" value={obj.v?.w ?? 0} onInput={(e: E) => editor.inspectorInput("w", e.target.valueAsNumber)} />
				</label>
				<label>
					<span>Высота:</span>
					<input type="number" value={obj.v?.h ?? 0} onInput={(e: E) => editor.inspectorInput("h", e.target.valueAsNumber)} />
				</label>
			</div>
			<label className={styles.colorInput}>
				<span>Цвет:</span>
				<input type="color" value={obj.v?.c ?? "#000000"} onInput={(e: E) => editor.inspectorInput("c", e.target.value)} />
			</label>
			{obj.v?.type != "qr" &&
				<label className={styles.fontInput}>
					<span>Шрифт:</span>
					<select value={obj.v?.f ?? -1} onChange={e => editor.inspectorInput("f", Number(e.target.value))}>
						<option value={-1}>Arial</option>
						{fonts.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
					</select>
				</label>
			}
		</div>
	);
}

interface InspectorProps
{
	editor: TicketEditor,
	fonts: Font[],
}
