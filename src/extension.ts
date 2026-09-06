import { ExtensionContext, languages } from "vscode";
import * as commands from "./action/command";
import { keyCompletion } from "./action/completion";
import { dispatchHover } from "./action/hover";
import { indexStatus } from "./action/statusBar";
import config from "./config";
import manger from "./manger";
import { log } from "./util/log";

export function activate(context: ExtensionContext) {
	indexStatus.indexing();
	// 本地索引建好才 resolve，作为扩展 API 返回给 e2e 测试等待
	const ready = config.init().then(async () => {
		log.appendLine(
			`i18n 库: ${config.i18nLib ?? "未识别"}，定义文件 ${config.defList.size} 个，应用文件 ${config.applyList.size} 个`
		);
		await manger.init(context);
		if (config.defList.size === 0) {
			indexStatus.noDefs();
			return;
		}
		const { totalKeys, langs } = manger.getDefStats();
		const summary = `索引完成：${totalKeys} 个 key，语言 ${langs.join("/")}，被引用的 key ${manger.applyKeyCount} 个`;
		log.appendLine(summary);
		indexStatus.ready(`i18n 库 ${config.i18nLib ?? "未识别"}，${summary}`);
	});
	// 顶层收口：初始化失败只上报
	ready.catch(e => {
		log.appendLine(`[error] 初始化失败: ${e?.stack ?? e}`);
		indexStatus.failed();
	});

	const hoverDis = languages.registerHoverProvider(config.activeFileLanguage, dispatchHover());

	// @ts-ignore Commands
	context.subscriptions.push(hoverDis, log, indexStatus.item, ...Object.keys(commands).map(name => commands[name]));

	if (config.useCompletion) {
		// autocomplete
		context.subscriptions.push(keyCompletion());
	}

	return { ready };
}

export function deactivate() {
	manger.dispose();
}
