import { StatusBarAlignment, window } from "vscode";
import pj from "../../package.json";

// 右下角状态：索引中 / 就绪 / 失败。索引没完成前 hover 没有结果，点它打开 Mathis 日志
const item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
item.command = `${pj.name}.showLog`;

export const indexStatus = {
	item,
	indexing() {
		item.text = "$(sync~spin) Mathis 索引中";
		item.tooltip = "正在扫描多语言定义与应用文件，完成前 hover 没有结果";
		item.show();
	},
	ready(summary: string) {
		item.text = "$(globe) Mathis";
		item.tooltip = `${summary}\n点击查看日志`;
	},
	noDefs() {
		item.text = "$(warning) Mathis 未找到定义文件";
		item.tooltip =
			"mathis.define 的 glob 相对工作区根目录，没匹配到任何多语言文件。请单独打开应用工程目录，或在设置里调整 mathis.define / mathis.apply / mathis.i18nLib。点击查看日志";
	},
	failed() {
		item.text = "$(error) Mathis 初始化失败";
		item.tooltip = "点击查看日志";
	},
};
