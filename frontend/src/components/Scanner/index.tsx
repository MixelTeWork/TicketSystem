import { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css"
import QrScanner from "qr-scanner";


export default function Scanner({ active = true, onScan }: ScannerProps)
{
	const [qrScanner, setQrScanner] = useState<QrScanner>();
	const videoRef = useRef<HTMLVideoElement | null>(null)

	useEffect(() =>
	{
		if (!videoRef.current) return;
		const scanner = new QrScanner(
			videoRef.current,
			result => onScan(result.data),
			{
				highlightScanRegion: true,
				maxScansPerSecond: 10,

			},
		)
		setQrScanner((old: QrScanner | undefined) =>
		{
			old?.stop();
			old?.destroy();
			return scanner;
		});
		scanner.start()

		return () =>
		{
			scanner.stop();
			scanner.destroy();
		}
	}, [videoRef, onScan]);

	useEffect(() =>
	{
		if (!qrScanner) return;
		if (active) qrScanner.start();
		else qrScanner.pause(false);
	}, [active, qrScanner])

	return (
		<video className={styles.root} ref={videoRef}></video>
	);
}

interface ScannerProps
{
	active?: boolean,
	onScan: (result: string) => void,
}