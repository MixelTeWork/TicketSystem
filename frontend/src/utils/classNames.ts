export default function classNames(...names: (string | undefined | null | false)[])
{
	return names.filter(v => !!v).join(" ");
}
