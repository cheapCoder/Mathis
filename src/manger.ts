import { Range, Uri, window, workspace } from "vscode";
import applyParser from "./parser/apply";
import defParser from "./parser/def";

class Manger {
	// TODO: bug
	public activeFileType: ActiveFileType = "apply";
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public keyMap: LocaleMapType = {};
	public applyMap: { [key: string]: ApplyInfo[] } = {};

	constructor() {
		workspace.onDidChangeTextDocument((e) => {
			// console.log(e);
		});
		window.onDidChangeActiveTextEditor((e) => {
			this.activeFileType = defParser.matchUris.find(
				(u) => u.fsPath === e.document.fileName
			)
				? "define"
				: "apply";
			console.log(this);
		});
		// this.init();
	}

	public async init() {
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

		await applyParser.init();
		this.activeFileType = defParser.matchUris.find(
			(u) => u.fsPath === window.activeTextEditor.document.fileName
		)
			? "define"
			: "apply";

		console.log(this);
	}

	public addDef(n: DefNode | DefNode[], lang: string) {
		Array.isArray(n) || (n = [n]);

		n.forEach((node) => {
			this.keyMap[node.key] ||= {};
			this.keyMap[node.key][lang] = node;
		});

		this.supportLang.add(lang);
	}

	public addApply(key: string, path: string, offset: number) {
		Array.isArray(this.applyMap[key]) || (this.applyMap[key] = []);
		this.applyMap[key].push({ path, offset, key });
	}
}

export default new Manger();

export class DefNode {
	// TODO:优化写法
	public constructor(
		key: string,
		value: string,
		keyRange: Range,
		valueRange: Range,
		lang: string,
		defUri: Uri
	) {
		this.key = key;
		this.value = value;
		this.lang = lang;
		this.defUri = defUri;
		this.keyRange = keyRange;
		this.valueRange = valueRange;
	}
	key: string;
	value: string;
	lang: string;
	defUri: Uri;
	keyRange: Range;
	valueRange: Range;
}
