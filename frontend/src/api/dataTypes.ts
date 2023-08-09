export interface ResponseMsg
{
	msg: string,
}

export interface User
{
	auth: boolean,
	id: number,
	name: string,
	login: string,
	operations: string[],
}


export interface ResponseEvent
{
	id: number,
	name: string,
	date: string,
}

export interface EventData
{
	id: number,
	name: string,
	date: Date,
}