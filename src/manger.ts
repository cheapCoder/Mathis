import { ExtensionContext, Location, Range, Uri, window, workspace } from "vscode";
import applyParser from "./parser/apply";
import defParser from "./parser/def";

// TODO: 支持代码补全
class Manger {
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public context: ExtensionContext;
	public defParser = defParser;
	public applyParser = applyParser;
	public keyMap: LocaleMapType = {};
	public applyMap: { [key: string]: ApplyInfo[] } | undefined;

	private _activeFileType: ActiveFileType = "apply";
	public get activeFileType() {
		return this._activeFileType;
	}
	public set activeFileType(val) {
		this._activeFileType = val;

		// 懒加载到打开locale文件时再实例化
		if (val === "define" && !this.applyMap) {
			applyParser.init();
		}
	}

	constructor() {
		this.init();

		window.onDidChangeActiveTextEditor((e) => {
			this.activeFileType = defParser.matchUris.find(
				(u) => u.fsPath === e.document.fileName
			)
				? "define"
				: "apply";

			console.log(this);
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
		// uri: Uri,
		// range: Range,
		location: Location,
		meta: { code: string; languageId: string }
	) {
		this.applyMap ||= {};
		Array.isArray(this.applyMap[key]) || (this.applyMap[key] = []);

		this.applyMap[key].push({ location, key, ...meta });
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
