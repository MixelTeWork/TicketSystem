export interface ResponseMsg
{
	msg: string,
}

export interface User
{
	auth: boolean,
	name: string,
	login: string,
	operations: string[],
}