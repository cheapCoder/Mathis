import { Parser } from "acorn";
import { Range } from "vscode";
import { DefNode } from "../../manger";

export default function tsParse(text: string, meta: AstMeta = {}): void {
	const ast = Parser.parse(text, {
		ecmaVersion: "latest",
		sourceType: "module",
		locations: true,
	});

	const { lang, uri } = meta;

	return (
		ast["body"]
			// TODO:支持module.exports
			.find((def) => def.type === "ExportDefaultDeclaration")
			["declaration"]["properties"].map((n) => {
				// acorn ast loc contains the one-based line and zero-based column numbers, but vscode position define the one-based line and one-based column numbers
				// 且acorn返回的loc包含start不包含end，同时位置需要去除引号导致的偏差，统一保存为one-based
				const keyRange = new Range(
					n["key"]["loc"]["start"]["line"],
					n["key"]["loc"]["start"]["column"] + (n["key"]["value"] ? 2 : 1), // key无引号包含时，无value属性而是name属性
					n["key"]["loc"]["end"]["line"],
					n["key"]["loc"]["end"]["column"] + (n["key"]["value"] ? -1 : 0)
				);

				const valueRange = new Range(
					n["value"]["loc"]["start"]["line"],
					n["value"]["loc"]["start"]["column"] + 2,
					n["value"]["loc"]["end"]["line"],
					n["value"]["loc"]["end"]["column"] - 1
				);

				return new DefNode(
					n["key"]["value"] || n["key"]["name"], // key无引号包含时，无value属性而是name属性
					n["value"]["value"],
					keyRange,
					valueRange,
					lang,
					uri
				);
			})
	);
}
