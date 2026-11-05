import { useEffect, useRef } from "react";
import styles from "./styles.module.css";
import QrScanner from "qr-scanner";
import classNames from "../../utils/classNames";

export default function Scanner({ active = true, className, onScan, onCameraError }: ScannerProps)
{
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const scannerRef = useRef<QrScanner | null>(null);

	const onScanRef = useRef(onScan);
	const onCameraErrorRef = useRef(onCameraError);

	useEffect(() =>
	{
		onScanRef.current = onScan;
	}, [onScan]);

	useEffect(() =>
	{
		onCameraErrorRef.current = onCameraError;
	}, [onCameraError]);

	useEffect(() =>
	{
		if (!videoRef.current) return;

		const scanner = new QrScanner(
			videoRef.current,
			result => onScanRef.current(result.data),
			{
				highlightScanRegion: true,
				maxScansPerSecond: 10,
			},
		);

		scannerRef.current = scanner;

		return () =>
		{
			scanner.destroy();
			scannerRef.current = null;
		};
	}, []);

	useEffect(() =>
	{
		const scanner = scannerRef.current;
		if (!scanner) return;

		let cancelled = false;
		if (active) scanner.start().catch(() => { if (!cancelled) onCameraErrorRef.current(); });
		else scanner.stop();
		return () => { cancelled = true; };
	}, [active]);

	return (
		<video className={classNames(styles.root, className)} ref={videoRef} />
	);
}

interface ScannerProps {
	className?: string;
	active?: boolean;
	onScan: (result: string) => void;
	onCameraError: () => void;
}
