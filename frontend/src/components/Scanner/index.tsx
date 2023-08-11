import { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css"
import QrScanner from "qr-scanner";
import classNames from "../../utils/classNames";


export default function Scanner({ active = true, className, onScan, onCameraError }: ScannerProps)
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
		scanner.start().catch(() => onCameraError());

		return () =>
		{
			scanner.stop();
			scanner.destroy();
		}
	}, [videoRef, onScan]);

	useEffect(() =>
	{
		if (!qrScanner) return;
		if (active) qrScanner.start().catch(() => onCameraError());
		else qrScanner.pause(false);
	}, [active, qrScanner])

	return (
		<video className={classNames(styles.root, className)} ref={videoRef}></video>
	);
}

interface ScannerProps
{
	className?: string
	active?: boolean,
	onScan: (result: string) => void,
	onCameraError: () => void,
}