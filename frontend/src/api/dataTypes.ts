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


export interface ResponseEvent
{
	name: string,
	date: string,
}

export interface EventData
{
	name: string,
	date: Date,
}