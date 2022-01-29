import { Range, Uri } from "vscode";

export class DefNode {
	public constructor(
		key: string,
		value: string,
		keyRange: Range,
		valueRange: Range,
		lang: string,
		fileUri: Uri
	) {
		this.key = key;
		this.value = value;
		this.lang = lang;
		this.fileUri = fileUri;
		this.keyRange = keyRange;
		this.valueRange = valueRange;
	}
	key: string;
	value: string;
	lang: string;
	fileUri: Uri;
	keyRange: Range;
	valueRange: Range;
	applyList: ApplyNode[] = [];
}

export class ApplyNode {
	public constructor() {}
	key: string;
	fileUri: Uri;
	range: Range;
	defList: [];
}

class NodeManger {
	public curFileType: "apply" | "define";
	public supportLang: Set<string> = new Set();
	public defs: { [key: string]: { [lang: string]: DefNode } } = {};
	public applys: { [key: string]: ApplyNode } = {};

	public addNodes(n: DefNode | DefNode[], lang: string, addType: "defs" | "applys") {
		Array.isArray(n) || (n = [n]);

		n.forEach((node) => {
			this[addType][node.key] ||= {};
			this[addType][node.key][lang] = node;
		});

		this.supportLang.add(lang);
	}
	// public void
}

export default new NodeManger();
