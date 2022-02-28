import { Location, Range, Uri, window, workspace } from "vscode";
import config from "../config";

class ApplyParser {
	public async parse(uri: Uri, defMap?: DefMapType) {
		// 法一
		return this.getApplyOfFileByReg(uri);

		// 法二
		//return this.getApplyOfFileBySplit(uri, defMap);
	}

	// 检测方式1-正则表达式
	private async getApplyOfFileByReg(uri: Uri) {
		const document = await workspace.openTextDocument(uri);
		const text = document.getText();
		const res: ApplyNode[] = [];

		if (!config.i18nLib) {
			return [];
		}
		config.libFormatRegMap[config.i18nLib].forEach((reg) => {
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
			return;
		}
		const document = await workspace.openTextDocument(uri);
		const res: ApplyNode[] = [];

		for (let line = 1; line <= document.lineCount; line++) {
			const lineWord = config.splitLetters.flatMap((s) => document.lineAt(line - 1).text.split(s));

			let column = 1;
			// 保证顺序遍历
			for (let i = 0; i < lineWord.length; i++) {
				if (defMap.get(lineWord[i])) {
					// TODO:整理所有的偏移计算,这里line为什么要+1而不是-1
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
		}
		return res;
	}
}

export default new ApplyParser();
