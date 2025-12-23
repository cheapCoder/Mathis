import path from "path";
import { Disposable, ExtensionContext, FileSystemWatcher, Uri, workspace } from "vscode";
import config from "./config";
import { LocaleDatabase } from "./db";
import applyParser from "./parser/apply";
import defParser from "./parser/def";
import DelayCell, { FileChangeEvent } from "./util/DelayCell";
import { getAppLocaleMessages } from "./util/remote";

class Manger {
	public i18nLib: I18nLibType;
	public context: ExtensionContext | undefined;

	private db: LocaleDatabase | undefined;
	private watchers: FileSystemWatcher[] = [];
	private disposables: Disposable[] = [];
	private delayCell: DelayCell | undefined;

	// ========== 兼容性 getter ==========

	public get keys(): string[] {
		return this.db?.getAllKeys() || [];
	}

	public get supportLang(): Set<string> {
		return new Set(this.db?.getSupportedLangs() || []);
	}

	// 兼容旧代码：返回类似 Map 的对象
	public get defMap(): DefMapProxy {
		const db = this.db;
		return {
			get: (key: string) => db?.getDefByKeyAsMap(key),
			has: (key: string) => db?.hasDefKey(key) || false,
			forEach: (callback: (value: Map<string, DefNode>, key: string) => void) => {
				const allKeys = db?.getAllDefKeys() || [];
				allKeys.forEach(key => {
					const map = db?.getDefByKeyAsMap(key);
					if (map) {
						callback(map, key);
					}
				});
			},
			get size() {
				return db?.getAllDefKeys().length || 0;
			},
		} as DefMapProxy;
	}

	public get remoteDefMap(): RemoteDefMapProxy {
		return {
			get: (key: string) => this.db?.getRemoteDefByKey(key),
			has: (key: string) => this.db?.hasRemoteDefKey(key) || false,
		} as RemoteDefMapProxy;
	}

	public get applyMap(): ApplyMapProxy {
		return {
			get: (key: string) => {
				const nodes = this.db?.getApplyByKey(key);
				return nodes && nodes.length > 0 ? nodes : undefined;
			},
			has: (key: string) => {
				const nodes = this.db?.getApplyByKey(key);
				return nodes !== undefined && nodes.length > 0;
			},
		} as ApplyMapProxy;
	}

	public get defFileBuckets(): DefFileBucketsProxy {
		return {
			get: (filePath: string) => this.db?.getDefKeysByFile(filePath),
		} as DefFileBucketsProxy;
	}

	// ========== 初始化 ==========

	public async init(context: ExtensionContext) {
		this.context = context;

		// 初始化数据库
		const dbPath = context.globalStorageUri
			? path.join(context.globalStorageUri.fsPath, "locale.db")
			: ":memory:";

		// 确保目录存在
		if (context.globalStorageUri) {
			try {
				await workspace.fs.createDirectory(context.globalStorageUri);
			} catch {
				// 目录可能已存在
			}
		}

		this.db = new LocaleDatabase(dbPath);
		await this.db.init();

		// 初始化文件监听
		this.initWatchers();

		// init def node
		await Promise.all([this.fetchRemote(), this.updateDef()]);

		// init apply node
		await this.updateApply();
	}

	private initWatchers() {
		// 创建防抖处理器
		this.delayCell = new DelayCell<FileChangeEvent, string>(
			this.handleFileChanges.bind(this),
			(event: FileChangeEvent) => event.uri.fsPath,
			config.delayTime
		);

		// 为 define 配置创建 watchers
		config.define.forEach(({ include }) => {
			const watcher = workspace.createFileSystemWatcher(include);
			this.setupWatcherEvents(watcher, "def");
			this.watchers.push(watcher);
		});

		// 为 apply 配置创建 watchers
		config.apply.forEach(({ include }) => {
			const watcher = workspace.createFileSystemWatcher(include);
			this.setupWatcherEvents(watcher, "apply");
			this.watchers.push(watcher);
		});

		// 监听配置变化，重建 watcher
		this.disposables.push(
			workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration("mathis.define") || e.affectsConfiguration("mathis.apply")) {
					this.recreateWatchers();
				}
			})
		);
	}

	private setupWatcherEvents(watcher: FileSystemWatcher, defaultType: "def" | "apply") {
		watcher.onDidCreate(uri => {
			const fileType = this.getFileType(uri, defaultType);
			this.delayCell?.add({ type: "create", uri, fileType });

			// 新建文件时更新 config 的文件列表
			if (fileType === "def") {
				config.defList.add(uri.fsPath);
			} else if (fileType === "apply") {
				config.applyList.add(uri.fsPath);
			}
		});

		watcher.onDidChange(uri => {
			const fileType = this.getFileType(uri, defaultType);
			this.delayCell?.add({ type: "change", uri, fileType });
		});

		watcher.onDidDelete(uri => {
			const fileType = this.getFileType(uri, defaultType);
			this.delayCell?.add({ type: "delete", uri, fileType });

			// 删除文件时更新 config 的文件列表
			if (fileType === "def") {
				config.defList.delete(uri.fsPath);
			} else if (fileType === "apply") {
				config.applyList.delete(uri.fsPath);
			}
		});
	}

	private getFileType(uri: Uri, defaultType: "def" | "apply"): "def" | "apply" | "unknown" {
		if (config.defList.has(uri.fsPath)) return "def";
		if (config.applyList.has(uri.fsPath)) return "apply";
		return defaultType;
	}

	private handleFileChanges(events: FileChangeEvent[]) {
		const defChanges: Uri[] = [];
		const defDeletes: string[] = [];
		const applyChanges: Uri[] = [];
		const applyDeletes: string[] = [];

		events.forEach(event => {
			if (event.fileType === "def") {
				if (event.type === "delete") {
					defDeletes.push(event.uri.fsPath);
				} else {
					defChanges.push(event.uri);
				}
			} else if (event.fileType === "apply") {
				if (event.type === "delete") {
					applyDeletes.push(event.uri.fsPath);
				} else {
					applyChanges.push(event.uri);
				}
			}
		});

		// 处理删除
		defDeletes.forEach(filePath => this.db?.deleteDefByFile(filePath));
		applyDeletes.forEach(filePath => this.db?.deleteApplyByFile(filePath));

		// 处理创建和更新
		if (defChanges.length > 0) {
			this.updateDef(defChanges);
		}
		if (applyChanges.length > 0) {
			this.updateApply(applyChanges);
		}
	}

	private recreateWatchers() {
		// 销毁旧的 watchers
		this.watchers.forEach(w => w.dispose());
		this.watchers = [];

		// 重新初始化
		this.initWatchers();
	}

	// ========== 数据更新 ==========

	private async updateDef(list: Uri[] = [...config.defList].map(Uri.file)) {
		const res = await Promise.all(list.map(u => defParser.parse(u)));

		res.forEach((nodeList, i) => {
			const filePath = list[i].fsPath;

			// 先删除该文件的旧数据
			this.db?.deleteDefByFile(filePath);

			// 插入新数据
			if (nodeList.length > 0) {
				this.db?.upsertDefNodes(nodeList);
			}
		});
	}

	private async updateApply(list: Uri[] = [...config.applyList].map(Uri.file)) {
		// 创建一个代理对象用于 applyParser
		const defMapProxy = {
			get: (key: string) => (this.db?.hasDefKey(key) ? true : undefined),
			keys: () => this.db?.getAllDefKeys() || [],
		};

		const res = await Promise.all(list.map(uri => applyParser.parse(uri, defMapProxy as any)));

		res.forEach((nodeList, i) => {
			const filePath = list[i].fsPath;

			// 先删除该文件的旧数据
			this.db?.deleteApplyByFile(filePath);

			// 插入新数据
			if (nodeList.length > 0) {
				this.db?.upsertApplyNodes(nodeList);
			}
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

		// 清空旧的远程数据
		this.db?.clearRemoteDef();

		Object.keys(en).forEach(k => {
			this.db?.upsertRemoteDef(
				k,
				new Map([
					["en_US", { lang: "en_US", value: en[k] }],
					["zh_CN", { lang: "zh_CN", value: zh[k] }],
				])
			);
		});
	}

	// ========== 数据查询方法（供 action 使用）==========

	public searchDefByValue(searchValue: string): DefNode[] {
		return this.db?.searchDefByValue(searchValue) || [];
	}

	public getAllDefNodes(): DefNode[] {
		return this.db?.getAllDefNodes() || [];
	}

	public getDefStats() {
		return this.db?.getDefStats() || { totalKeys: 0, totalFiles: 0, langs: [] };
	}

	// ========== 生命周期 ==========

	public async dispose() {
		// 销毁 watchers
		this.watchers.forEach(w => w.dispose());
		this.watchers = [];

		// 销毁其他 disposables
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];

		// 销毁 delayCell
		this.delayCell?.dispose();

		// 关闭数据库
		await this.db?.close();
	}
}

// ========== 兼容类型定义 ==========

interface DefMapProxy {
	get(key: string): Map<string, DefNode> | undefined;
	has(key: string): boolean;
	forEach(callback: (value: Map<string, DefNode>, key: string) => void): void;
	size: number;
}

interface RemoteDefMapProxy {
	get(key: string): Map<string, { lang: string; value: string }> | undefined;
	has(key: string): boolean;
}

interface ApplyMapProxy {
	get(key: string): ApplyNode[] | undefined;
	has(key: string): boolean;
}

interface DefFileBucketsProxy {
	get(filePath: string): string[] | undefined;
}

export default new Manger();
