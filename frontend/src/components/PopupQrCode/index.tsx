import { useEffect, useState } from "react";
import QRCode from "qrcode"
import Popup from "../Popup";

export default function PopupQrCode({ code, setCode, title }: ViewTicketProps)
{
	const [qrcode, setQrcode] = useState("");
	useEffect(() =>
	{
		if (!code) return;
		setQrcode("")
		QRCode.toDataURL(code, { errorCorrectionLevel: "H", scale: 10 }, (e, url) => setQrcode(url));
	}, [code]);

	return (
		<Popup open={!!code} close={() => setCode("")} title={title}>
			<img src={qrcode} alt={code} style={{ width: "100%" }} />
		</Popup>
	);
}

interface ViewTicketProps
{
	title?: string,
	code: string,
	setCode: (code: string) => void,
}