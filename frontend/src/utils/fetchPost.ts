export default function fetchPost(input: RequestInfo | URL, body: any)
{
	return fetch(input, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body),
	});
}
