import { useState } from "react";

export default function useSound(url: string)
{
	const [audio] = useState(() =>
	{
		const audio = new Audio(url)
		audio.preload = "auto";
		return audio;
	});

	const play = () =>
	{
		audio.currentTime = 0;
		audio.play();
	};

	return [play];
};
