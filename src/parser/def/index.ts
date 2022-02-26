import path from "path";
import { Range, Uri, workspace } from "vscode";
import jsonParse from "./json";
import tsParse from "./js|ts";

export class DefNode {
	public constructor(
		public key: string,
		public value: string,
		public keyRange: Range,
		public valueRange: Range,
		public lang: string,
		public defUri: Uri
	) {
		this.key = key;
		this.value = value;
		this.lang = lang;
		this.defUri = defUri;
		this.keyRange = keyRange;
		this.valueRange = valueRange;
	}
}

class Def {
	private static parserMap = {
		json: jsonParse,
		js: tsParse,
		ts: tsParse,
	};

	public async parse(list: Uri[]) {
		const res: DefMapType = {};
		const contents = (await Promise.all(list.map((u) => workspace.fs.readFile(u)))).map(
			(a) => a.toString()
		);

		contents.forEach(async (content, i) => {
			const file = path.parse(list[i].fsPath);

			const nodes: DefNode[] = Def.parserMap[file.ext.substring(1)](content, {
				uri: list[i],
				lang: file.name,
			});

			const map = new Map();
			nodes.forEach((n) => {
				map.set(n.key, n);
			});
			res[list[i].fsPath] = map;
		});
		return res;
	}
}

export default new Def();
