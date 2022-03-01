import { ExtensionContext, TextDocument, Uri, window, workspace } from "vscode";
import throttle from "lodash/throttle";
import path from "path";
import config from "./config";
import applyParser from "./parser/apply";
import defParser from "./parser/def";

class Manger {
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public context: ExtensionContext | undefined;
	public defMap: DefMapType = new Map();
	public defFileBuckets = new Map<string, Array<string>>();
	public applyMap: ApplyMapType = new Map();
	public applyFileBuckets = new Map<string, Array<string>>();

	private _activeFileType: ActiveFileType = "apply";
	public get activeFileType() {
		return this._activeFileType;
	}
	public set activeFileType(val) {
		this._activeFileType = val;

		// 懒加载到打开locale文件时再实例化
		if (val === "define" && this.applyMap.size === 0) {
			this.updateApply();
		}
	}

	constructor() {
		window.onDidChangeActiveTextEditor((e) => {
			if (!e) {
				return;
			}
			this.activeFileType = config.defList.find((u) => u.fsPath === e.document.fileName) ? "define" : "apply";
		});

		workspace.onDidSaveTextDocument(
			throttle(
				(e: TextDocument) => {
					this.activeFileType === "define" ? this.updateDef([e.uri]) : this.updateApply([e.uri]);
				},
				1000,
				{ leading: false, trailing: true }
			)
		);
	}

	public async init(context: ExtensionContext) {
		this.context = context;
		await config.init();

		this.activeFileType = config.defList.find(
			(u) => u.fsPath === (window.activeTextEditor || window.visibleTextEditors[0])?.document.fileName
		)
			? "define"
			: "apply";

		// init def node
		await this.updateDef();

		if (!config.lazyLoadApply) {
			// init apply node
			await this.updateApply();
		}
	}

	private async updateDef(list: Uri[] = config.defList) {
		// def node查找
		const res = await Promise.all(list.map((u) => defParser.parse(u)));

		res.forEach((nodeList, i) => {
			this.defFileBuckets.get(list[i].fsPath)?.forEach((key) => {
				this.defMap.get(key)?.delete(list[i].fsPath);
			});

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
		const res = await Promise.all(list.map((uri) => applyParser.parse(uri, this.defMap)));

		// TODO:优化
		res.forEach((nodeList, i) => {
			// 记录key-node的map
			// 先删除原来的key-node记录
			this.applyFileBuckets.get(list[i].fsPath)?.forEach((key) => {
				this.applyMap.set(
					key,
					(this.applyMap.get(key) || []).filter((n) => n.loc.uri.fsPath !== list[i].fsPath)
				);
			});

			nodeList.forEach((node) => {
				if (!this.applyMap.has(node.key)) {
					this.applyMap.set(node.key, []);
				}
				this.applyMap.get(node.key)?.push(node);
			});

			// 更新记录filepath-key的桶
			this.applyFileBuckets.set(
				list[i].fsPath,
				nodeList.map((node) => node.key)
			);
		});
	}
}

export default new Manger();
