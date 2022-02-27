import path from "path";
import { ExtensionContext, Uri, window } from "vscode";
import config from "./config";
import applyParser from "./parser/apply";
import defParser from "./parser/def";

// TODO: 支持代码补全
class Manger {
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public context: ExtensionContext | undefined;
	public defMap: DefMapType = new Map();
	public defFileBuckets = new Map<string, Array<string>>();
	public applyMap: ApplyMapType = new Map();
	public applyFileBuckets = new Map<string, Set<string>>();

	private _activeFileType: ActiveFileType = "apply";
	public get activeFileType() {
		return this._activeFileType;
	}
	public set activeFileType(val) {
		this._activeFileType = val;

		// 懒加载到打开locale文件时再实例化
		// if (val === "define" && JSON.stringify(this.applyMap) === "{}") {
		// applyParser.parse(undefined, this.defMap).then((res) => {
		// this.applyMap = { ...this.applyMap, ...res };
		// setTimeout(() => {
		// 	console.log(this);
		// }, 5000);
		// });
		// }
	}

	constructor() {
		window.onDidChangeActiveTextEditor((e) => {
			if (!e) {
				return;
			}

			this.activeFileType = config.defList.find((u) => u.fsPath === e.document.fileName)
				? "define"
				: "apply";

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

		this.activeFileType = config.defList.find(
			(u) =>
				u.fsPath ===
				(window.activeTextEditor || window.visibleTextEditors[0])?.document.fileName
		)
			? "define"
			: "apply";

		// init def node
		await this.updateDef();

		// init apply node
		await this.updateApply();

		console.log(this);
		console.timeEnd("mathis");
	}

	private async updateDef(list: Uri[] = config.defList) {
		// def node查找
		const res = await Promise.all(list.map((u) => defParser.parse(u)));

		res.forEach((nodeList, i) => {
			// 更新记录filepath-key的桶
			this.defFileBuckets.set(
				list[i].fsPath,
				nodeList.map((n) => n.key)
			);
			this.supportLang.add(path.parse(list[i].fsPath).name);

			nodeList.forEach((node) => {
				if (!this.defMap.has(node.key)) {
					this.defMap.set(node.key, new Map());
				}

				this.defMap.get(node.key)?.set(node.defUri.fsPath, node);
			});
		});
	}

	private async updateApply(list: Uri[] = config.applyList) {
		const res = await Promise.all(list.map((uri) => applyParser.parse(uri)));

		// TODO:优化
		res.forEach((nodeList, i) => {
			// 记录key-node的map
			// 先删除原来的key-node记录
			this.applyFileBuckets.get(list[i].fsPath)?.forEach((key) => {
				this.applyMap.set(
					key,
					(this.applyMap.get(key) || []).filter(
						(n) => n.loc.uri.fsPath !== list[i].fsPath
					)
				);
			});
			nodeList.forEach((node) => {
				if (!this.applyMap.has(node.key)) {
					this.applyMap.set(node.key, []);
				}
				this.applyMap.get(node.key)?.push(node);
			});

			// FIXME:记录不对
			// 更新记录filepath-key的桶
			this.applyFileBuckets.set(
				list[i].fsPath,
				new Set(nodeList.map((node) => node.key))
			);
		});

		// Array.isArray(this.applyMap[key]) || (this.applyMap[key] = []);

		// this.applyMap[key].push({ location, key, ...meta });
	}
}

export default new Manger();
