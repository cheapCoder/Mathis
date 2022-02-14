import { Uri, workspace } from "vscode";

import manger from "../../manger";
import tsParse from "./js|ts";
import jsonParse from "./json";

class Def {
	private static parserMap = {
		json: jsonParse,
		js: tsParse,
		ts: tsParse,
	};

	public isReady = false;

	public matchUris: Uri[] = [];

	public async init() {
		// TODO:可配置
		// ts,js,json格式的多语言文件
		this.matchUris = await workspace.findFiles(
			"**/locale/{en_US,zh_CN}.{ts,js,json}",
			"**/node_modules/**"
		);

		await this.dispatchDefParse();
		this.isReady = true;
	}

	public async dispatchDefParse() {
		const arrs = (
			await Promise.all(this.matchUris.map((u) => workspace.fs.readFile(u)))
		).map((a) => a.toString());

		arrs.forEach(async (content, i) => {
			const filename = this.matchUris[i].fsPath.split("/").pop().split(".");
			const ext = filename.pop();
			const lang = filename.join(".");

			const nodes = Def.parserMap[ext](content, { uri: this.matchUris[i], lang });
			manger.addDef(nodes, lang);
		});
	}
}

export default new Def();
