import path from "path";
import { ExtensionContext, Uri, workspace } from "vscode";
import config from "./config";
import applyParser from "./parser/apply";
import defParser from "./parser/def";
import DelayCell from "./util/DelayCell";
import { getAppLocaleMessages } from "./util/remote";

class Manger {
	public i18nLib: I18nLibType;
	public supportLang: Set<string> = new Set();
	public context: ExtensionContext | undefined;
	public defMap: DefMapType = new Map();
	public remoteDefMap: Map<string, Map<string, { lang: string; value: string }>> = new Map();
	public defFileBuckets = new Map<string, Array<string>>();
	public applyMap: ApplyMapType = new Map();
	public applyFileBuckets = new Map<string, Array<string>>();

	public get keys() {
		return [...new Set([...this.defMap.keys(), ...this.remoteDefMap.keys()])];
	}

	public async init(context: ExtensionContext) {
		this.context = context;

		// FIXME:支持工作区
		// 监听文件修改
		const watcher = workspace.createFileSystemWatcher(
			`${workspace.workspaceFolders?.[0].uri.fsPath || "**"}/src/**/*`
		);
		const cell = new DelayCell(
			(list: Uri[][]) => {
				const dl: Uri[] = [];
				const al: Uri[] = [];
				list.forEach(args => {
					if (config.defList.has(args[0].fsPath)) {
						dl.push(args[0]);
					} else if (config.applyList.has(args[0].fsPath)) {
						al.push(args[0]);
					}
				});
				this.updateDef(dl);
				this.updateApply(al);
			},
			(e: Uri) => e.fsPath
		);
		watcher.onDidChange(cell.callback.bind(cell));

		// init def node
		await Promise.all([this.fetchRemote(), this.updateDef()]);

		// init apply node
		await this.updateApply();
		// console.log(this);
	}

	private async updateDef(list: Uri[] = [...config.defList].map(Uri.file)) {
		// def node查找
		const res = await Promise.all(list.map(u => defParser.parse(u)));

		res.forEach((nodeList, i) => {
			this.defFileBuckets.get(list[i].fsPath)?.forEach(key => {
				this.defMap.get(key)?.delete(list[i].fsPath);
			});

			// 更新记录filepath-key的桶
			this.defFileBuckets.set(
				list[i].fsPath,
				nodeList.map(n => n.key)
			);
			this.supportLang.add(path.parse(list[i].fsPath).name);

			nodeList.forEach(node => {
				if (!this.defMap.has(node.key)) {
					this.defMap.set(node.key, new Map());
				}

				this.defMap.get(node.key)?.set(node.defUri.fsPath, node);
			});
		});
	}

	private async updateApply(list: Uri[] = [...config.applyList].map(Uri.file)) {
		const res = await Promise.all(list.map(uri => applyParser.parse(uri, this.defMap)));

		// TODO:优化
		res.forEach((nodeList, i) => {
			// 记录key-node的map
			// 先删除原来的key-node记录
			this.applyFileBuckets.get(list[i].fsPath)?.forEach(key => {
				this.applyMap.set(
					key,
					(this.applyMap.get(key) || []).filter(n => n.loc.uri.fsPath !== list[i].fsPath)
				);
			});

			nodeList.forEach(node => {
				if (!this.applyMap.has(node.key)) {
					this.applyMap.set(node.key, []);
				}
				this.applyMap.get(node.key)?.push(node);
			});

			// 更新记录filepath-key的桶
			this.applyFileBuckets.set(
				list[i].fsPath,
				nodeList.map(node => node.key)
			);
		});
	}

	private async fetchRemote() {
		if (!workspace.name) return;
		const res = await Promise.all([
			getAppLocaleMessages({
				app: "dragon",
				locale: "zh_CN",
				env: "production",
			}),
			getAppLocaleMessages({
				app: "dragon",
				locale: "en_US",
				env: "production",
			}),
			getAppLocaleMessages({
				app: workspace.name,
				locale: "zh_CN",
				env: "production",
			}),
			getAppLocaleMessages({
				app: workspace.name,
				locale: "en_US",
				env: "production",
			}),
		]);

		if (res.some(obj => !obj)) return;

		const zh = { ...res[0], ...res[2] };
		const en = { ...res[1], ...res[3] };

		// TODO: zh?
		Object.keys(en).forEach(k => {
			this.remoteDefMap.set(
				k,
				// 为了和defMap结构统一
				new Map([
					["en_US", { lang: "en_US", value: en[k] }],
					["zh_CN", { lang: "zh_CN", value: zh[k] }],
				])
			);
		});
	}
}

export default new Manger();
