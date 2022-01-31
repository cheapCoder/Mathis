import { Range, Uri, window, workspace } from "vscode";
import applyParser from "./parser/apply";
import defParser from "./parser/def";

class Manger {
	public activeFileType: ActiveFileType = "apply";
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public keyMap: LocaleMapType = {};
	public applyMap: { [key: string]: ApplyInfo[] } | undefined;

	constructor() {
		this.init();

		window.onDidChangeActiveTextEditor((e) => {
			this.activeFileType = defParser.matchUris.find(
				(u) => u.fsPath === e.document.fileName
			)
				? "define"
				: "apply";

			// 懒加载到打开locale文件时再实例化
			if (this.activeFileType === "define" && !this.applyMap) {
				applyParser.init();
				// console.log(this);
				// console.log(Object.keys(this.keyMap).length);
				// console.log(Object.keys(this.applyMap).length);
			}
		});
	}

	public async init() {
		// 查找依赖库
		try {
			const path = (await workspace.findFiles("package.json"))[0].fsPath;
			const packageJson = (await import(path))["default"];

			this.i18nLib = Object.keys(applyParser.libFormatRegMap).find(
				(name) => packageJson["dependencies"][name]
			) as I18nLibType;
		} catch (e) {
			window.showErrorMessage("未发现package.json文件或i18n库依赖");
		}

		await defParser.init();

		this.activeFileType = defParser.matchUris.find(
			(u) => u.fsPath === window.activeTextEditor.document.fileName
		)
			? "define"
			: "apply";

		console.log(this);
		console.log(Object.keys(this.keyMap).length);
		console.log(Object.keys(this.applyMap));
	}

	public addDef(n: DefNode | DefNode[], lang: string) {
		Array.isArray(n) || (n = [n]);

		n.forEach((node) => {
			this.keyMap[node.key] ||= {};
			this.keyMap[node.key][lang] = node;
		});

		this.supportLang.add(lang);
	}

	public addApply(
		key: string,
		path: string,
		range: Range,
		meta: { code: string; languageId: string }
	) {
		Array.isArray(this.applyMap[key]) || (this.applyMap[key] = []);

		this.applyMap[key].push({ path, range, key, ...meta });
	}
}

export default new Manger();

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
