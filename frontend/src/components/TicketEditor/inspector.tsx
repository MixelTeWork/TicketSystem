import { useEffect, useState } from "react";
import styles from "./styles.module.css"
import type { TicketEditor, TicketPatternObject } from "./editor";
import classNames from "../../utils/classNames";
import type { Font } from "../../api/dataTypes";

type E = React.ChangeEvent<HTMLInputElement>;

export function Inspector({ editor, fonts }: InspectorProps)
{
	const [obj, setObj] = useState<TicketPatternObject | null>(null);

	useEffect(() =>
	{
		editor.setInspector(setObj);
		return () => editor.setInspector(null);
	}, [editor]);

	return (
		<div className={classNames(styles.inspector, obj && styles.inspector_open)}>
			<h2>{{
				"qr": "QR код",
				"code": "Код билета",
				"name": "Посетитель",
				"promo": "Промокод",
				"price": "Цена",
				"": "",
			}[obj?.type || ""]}</h2>
			<div className={styles.fields}>
				<label>
					<span>X:</span>
					<input type="number" value={obj?.x ?? 0} onInput={(e: E) => editor.inspectorInput("x", e.target.valueAsNumber)} />
				</label>
				<label>
					<span>Y:</span>
					<input type="number" value={obj?.y ?? 0} onInput={(e: E) => editor.inspectorInput("y", e.target.valueAsNumber)} />
				</label>
				<label>
					<span>Ширина:</span>
					<input type="number" value={obj?.w ?? 0} onInput={(e: E) => editor.inspectorInput("w", e.target.valueAsNumber)} />
				</label>
				<label>
					<span>Высота:</span>
					<input type="number" value={obj?.h ?? 0} onInput={(e: E) => editor.inspectorInput("h", e.target.valueAsNumber)} />
				</label>
			</div>
			<label className={styles.colorInput}>
				<span>Цвет:</span>
				<input type="color" value={obj?.c ?? "#000000"} onInput={(e: E) => editor.inspectorInput("c", e.target.value)} />
			</label>
			{obj?.type != "qr" &&
				<label className={styles.fontInput}>
					<span>Шрифт:</span>
					<select value={obj?.f ?? -1} onChange={e => editor.inspectorInput("f", Number(e.target.value))}>
						<option value={-1}>Arial</option>
						{fonts.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
					</select>
				</label>
			}
		</div>
	)
}

interface InspectorProps
{
	editor: TicketEditor,
	fonts: Font[],
}
