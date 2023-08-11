export default function fetchDelete(input: RequestInfo | URL)
{
	return fetch(input, {
		method: "DELETE",
	});
}
