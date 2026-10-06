import useStateObj from "../../utils/useStateObj";
import { useEffect } from "react";
import QRCode from "qrcode";
import Popup from "../Popup";

export default function PopupQrCode({ code, setCode, title }: ViewTicketProps)
{
	const qrcode = useStateObj("");
	useEffect(() =>
	{
		const setQrcode = qrcode.set;
		if (!code) return;
		setQrcode("");
		QRCode.toDataURL(code, { errorCorrectionLevel: "H", scale: 10 }, (e, url) => setQrcode(url));
	}, [code, qrcode.set]);

	return (
		<Popup open={!!code} close={() => setCode("")} title={title}>
			<img src={qrcode.v} alt={code} style={{ width: "100%" }} />
		</Popup>
	);
}

interface ViewTicketProps
{
	title?: string,
	code: string,
	setCode: (code: string) => void,
}
