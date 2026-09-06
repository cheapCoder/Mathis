import { Location, Range, Uri, window, workspace } from "vscode";
import config from "../config";
import { scanNextIntlApply } from "./nextIntl";

class ApplyParser {
	public async parse(uri: Uri, defMap: DefMapType) {
		// next-intl 的字面量只是 key 的一段（t("title") 对应 agent.title），正则/分词拿不到完整 key
		if (config.i18nLib === "next-intl") {
			return this.getApplyOfFileByNamespace(uri);
		}
		return config.detectApplyWay === "reg"
			? this.getApplyOfFileByReg(uri)
			: this.getApplyOfFileBySplit(uri, defMap);
	}

	// 检测方式3-按 useTranslations("ns") 绑定解析 t("key") 的完整 key
	private async getApplyOfFileByNamespace(uri: Uri): Promise<ApplyNode[]> {
		const document = await workspace.openTextDocument(uri);

		return scanNextIntlApply(document.getText()).map(({ key, start, end }) => {
			// 偏移量转成项目约定的 base-one 且首尾包含的位置
			const startPos = document.positionAt(start).translate(1, 1);
			const endPos = document.positionAt(end - 1).translate(1, 1);
			return {
				key,
				loc: new Location(document.uri, new Range(startPos, endPos)),
				code: document.lineAt(startPos.line - 1).text.trim(),
				languageId: document.languageId,
			};
		});
	}

	// 检测方式1-正则表达式
	private async getApplyOfFileByReg(uri: Uri) {
		const document = await workspace.openTextDocument(uri);
		const text = document.getText();
		const res: ApplyNode[] = [];

		if (!config.i18nLib) {
			return [];
		}
		config.libFormatRegMap[config.i18nLib].forEach(reg => {
			let tem;
			const r = new RegExp(reg, "g");
			while ((tem = r.exec(text))) {
				const start = document.positionAt(tem.index).translate(1, 1);
				const end = start.translate(0, tem[0].length - 1);

				// NOTE: 索引
				res.push({
					key: tem[0],
					loc: new Location(document.uri, new Range(start, end)),
					code: document.lineAt(start.line - 1).text.trim(),
					languageId: document.languageId,
				});
			}
		});
		return res;
	}

	// 检测方式2-split字符串查找方式
	private async getApplyOfFileBySplit(uri: Uri, defMap: DefMapType) {
		if (!defMap) {
			window.showErrorMessage("国际化定义文件未加载!");
			return [];
		}
		const document = await workspace.openTextDocument(uri);
		const res: ApplyNode[] = [];

		for (let line = 1; line <= document.lineCount; line++) {
			config.splitLetters.forEach(split => {
				const lineWord = document.lineAt(line - 1).text.split(split);

				let column = 1;
				// 保证顺序遍历
				for (let i = 0; i < lineWord.length; i++) {
					if (defMap.get(lineWord[i])) {
						const range = new Range(line, column, line, column + lineWord[i].length - 1);

						res.push({
							key: lineWord[i],
							loc: new Location(document.uri, range),
							code: document.lineAt(line - 1).text.trim(),
							languageId: document.languageId,
						});
					}
					column += lineWord[i].length + 1;
				}
			});
		}
		return res;
	}
}

export default new ApplyParser();
