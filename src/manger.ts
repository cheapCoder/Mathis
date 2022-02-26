import { ExtensionContext, Location, Range, Uri, window, workspace } from "vscode";
import applyParser from "./parser/apply";
import defParser from "./parser/def";
import config from "./config";
import path from "path";

// TODO: 支持代码补全
class Manger {
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public context: ExtensionContext;
	public defMap: DefMapType = {};
	public applyMap: ApplyMapType = {};

	private _activeFileType: ActiveFileType = "apply";
	public get activeFileType() {
		return this._activeFileType;
	}
	public set activeFileType(val) {
		this._activeFileType = val;

		// 懒加载到打开locale文件时再实例化
		if (val === "define" && JSON.stringify(this.applyMap) === "{}") {
			applyParser.parse(undefined, this.defMap).then((res) => {
				this.applyMap = { ...this.applyMap, ...res };
				setTimeout(() => {
					console.log(this);
				}, 5000);
			});
		}
	}

	constructor() {
		window.onDidChangeActiveTextEditor((e) => {
			if (!e) {
				return;
			}

			this.activeFileType = config.defList.find((u) => u.fsPath === e.document.fileName)
				? "define"
				: "apply";

			console.log(this);

			// setTimeout(() => {
			// 	Object.keys(this.applyMap).forEach((key) => {
			// 		if (!this.keyMap[key]) {
			// 			console.log(key);
			// 		}
			// 	});
			// 	console.log("-----------");
			// 	Object.keys(this.keyMap).forEach((key) => {
			// 		if (!this.applyMap[key]) {
			// 			console.log(key);
			// 		}
			// 	});
			// 	console.log(Object.keys(this.applyMap).length);
			// 	console.log(Object.keys(this.keyMap).length);
			// }, 10000);
		});
	}

	public async init(context: ExtensionContext) {
		this.context = context;
		await config.init(context);

		const defRes = await defParser.parse(config.defList);

		// set supportLang
		config.defList.forEach((uri) => {
			this.supportLang.add(path.parse(uri.fsPath).name);
		});

		this.defMap = { ...this.defMap, ...defRes };

		this.activeFileType = config.defList.find(
			(u) =>
				u.fsPath ===
				(window.activeTextEditor || window.visibleTextEditors[0])?.document.fileName
		)
			? "define"
			: "apply";

		console.log(this);
	}

	// public addDef(n: DefNode | DefNode[], lang: string) {
	// 	Array.isArray(n) || (n = [n]);

	// 	n.forEach((node) => {
	// 		this.defMap[node.key] ||= {};
	// 		this.defMap[node.key][lang] = node;
	// 	});

	// 	this.supportLang.add(lang);
	// }

	// public addApply(
	// 	key: string,
	// 	location: Location,
	// 	meta: { code: string; languageId: string }
	// ) {
	// 	this.applyMap ||= {};
	// 	Array.isArray(this.applyMap[key]) || (this.applyMap[key] = []);

	// 	this.applyMap[key].push({ location, key, ...meta });
	// }
}

export default new Manger();
