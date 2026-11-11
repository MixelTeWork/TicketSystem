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
		const video = videoRef.current;
		if (!video) return;
		// Keep the region object supplied to qr-scanner in sync with the visible video crop.
		const region: QrScanner.ScanRegion = {};
		const calculateScanRegion = () =>
		{
			if (!video.videoWidth || !video.videoHeight || !video.clientWidth || !video.clientHeight) return region;
			const scale = Math.max(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
			const size = Math.max(1, Math.round(Math.min(video.clientWidth, video.clientHeight) / scale * 2 / 3));
			Object.assign(region, {
				x: Math.round((video.videoWidth - size) / 2), y: Math.round((video.videoHeight - size) / 2),
				width: size, height: size, downScaledWidth: 400, downScaledHeight: 400,
			});
			return region;
		};

		const scanner = new QrScanner(
			video,
			result => onScanRef.current(result.data),
			{
				highlightScanRegion: true,
				calculateScanRegion,
				maxScansPerSecond: 10,
			},
		);

		scannerRef.current = scanner;
		const observer = new ResizeObserver(() =>
		{
			calculateScanRegion();
			const overlay = scanner.$overlay;
			if (!overlay || !region.width || !video.videoWidth) return;
			const scale = Math.max(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
			const size = region.width * scale;
			overlay.style.width = `${size}px`;
			overlay.style.height = `${size}px`;
			overlay.style.left = `${video.offsetLeft + (video.clientWidth - size) / 2}px`;
			overlay.style.top = `${video.offsetTop + (video.clientHeight - size) / 2}px`;
		});
		observer.observe(video);

		return () =>
		{
			observer.disconnect();
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
