// @ts-nocheck
import { Parser } from "acorn";
import JSONParser, { ObjectNode } from "json-to-ast";
import path from "path";
import { Range, Uri, window, workspace } from "vscode";

class Def {
	private parserMap: Record<string, Function> = {
		json: this.jsonParse,
		js: this.tsParse,
		ts: this.tsParse,
	};

	public async parse(uri: Uri): Promise<DefNode[]> {
		const text = (await workspace.fs.readFile(uri)).toString();

		const { ext, name: lang } = path.parse(uri.fsPath);

		if (!this.parserMap[ext.substring(1)]) {
			window.showErrorMessage(`${uri.fsPath}无法解析`);
			return [];
		}

		let res: DefNode[] = [];
		try {
			res = this.parserMap[ext.substring(1)](text, { uri, lang });
		} catch (error) {
			console.log(error);
		}
		return res;
	}

	// 解析json ast
	private jsonParse(text: string, meta: AstMeta): DefNode[] {
		const { lang, uri } = meta;

		return (JSONParser(text) as ObjectNode)["children"].map((n) => {
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

			return {
				key: n["key"]["value"],
				value: n["value"]["value"],
				keyRange: keyRange,
				valueRange: valueRange,
				defUri: uri,
				lang,
			};
		});
	}

	// 解析js/ts ast
	private tsParse(text: string, meta: AstMeta): DefNode[] {
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

					return {
						key: n["key"]["value"] || n["key"]["name"], // key无引号包含时，无value属性而是name属性
						value: n["value"]["value"], // NOTE: 模板字符串是为undefined
						keyRange: keyRange,
						valueRange: valueRange,
						defUri: uri,
						lang,
					};
				})
		);
	}
}

export default new Def();
