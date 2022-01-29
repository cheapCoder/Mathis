import { readFile } from "fs/promises";
import { Uri } from "vscode";

import nodeManger from "../../manger/nodes";
import tsParse from "./js|ts";
import jsonParse from "./json";

const parserMap = {
	json: jsonParse,
	js: tsParse,
	ts: tsParse,
};

export const dispatchDefParse = async (uris: Uri | Uri[]) => {
	Array.isArray(uris) || (uris = [uris]);

	const contents = await Promise.all(uris.map((u) => readFile(u.fsPath, { encoding: "utf-8" })));
	contents.forEach(async (content, i) => {
		const filename = uris[i].fsPath.split("/").pop();
		const ext = filename.split(".")[1];
		const lang = filename.split(".")[0];

		const nodes = parserMap[ext](content, { uri: uris[i], lang });
		nodeManger.addNodes(nodes, lang, "defs");
	});
};
