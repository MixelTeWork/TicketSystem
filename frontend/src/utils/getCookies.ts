export default function getCookie(name: string): string | undefined 
{
	const matches = document.cookie.match(new RegExp(
		"(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)",
	));
	if (!matches) return undefined;
	try { return decodeURIComponent(matches[1]); } 
	catch { return matches[1]; }
}
