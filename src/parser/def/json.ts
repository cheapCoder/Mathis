import parser from "json-to-ast";
import { Range } from "vscode";
import { DefNode } from ".";

export default function jsonParse(text: string, meta: AstMeta = {}): DefNode[] {
	const { lang, uri } = meta;

	return parser(text)["children"].map((n) => {
		const keyRange = new Range(
			n["key"]["loc"]["start"]["line"],
			n["key"]["loc"]["start"]["column"] + 1,
			n["key"]["loc"]["end"]["line"],
			n["key"]["loc"]["end"]["column"] - 2
		);

		const valueRange = new Range(
			n["value"]["loc"]["start"]["line"],
			n["value"]["loc"]["start"]["column"] + 1,
			n["value"]["loc"]["end"]["line"],
			n["value"]["loc"]["end"]["column"] - 2
		);

		return new DefNode(
			n["key"]["value"],
			n["value"]["value"],
			keyRange,
			valueRange,
			lang,
			uri
		);
	});
}
