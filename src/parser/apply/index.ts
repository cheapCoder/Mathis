import { Location, Range, Uri, workspace } from "vscode";
import config from "../../config";

// TODO: move

class ApplyParser {
	public async parse(list: Uri[] = config.applyList, defMap: DefMapType) {
		const res = await Promise.all(
			list.map(
				(uri) =>
					// 法一
					this.getApplyOfFileByReg(uri)

				// 法二
				// this.getApplyOfFileBySplit(uri, defMap);
			)
		);

		return Object.fromEntries(res.filter((entry) => entry[1].size === 0));
	}

	// this.applyMap

	// public addApply(
	// 	key: string,
	// 	location: Location,
	// 	meta: { code: string; languageId: string }
	// ) {
	// 	this.applyMap;
	// 	Array.isArray(this.applyMap[key]) || (this.applyMap[key] = []);

	// 	this.applyMap[key].push({ location, key, ...meta });
	// }

	// 检测方式1-正则表达式
	private async getApplyOfFileByReg(
		uri: Uri
	): Promise<[string, Map<string, ApplyParseNode[]>]> {
		const document = await workspace.openTextDocument(uri);
		const text = document.getText();
		const res: Map<string, ApplyParseNode[]> = new Map();

		config.libFormatRegMap[config.i18nLib].forEach((reg) => {
			let tem;
			const r = new RegExp(reg, "g");
			while ((tem = r.exec(text))) {
				const start = document.positionAt(tem.index).translate(1, 1);
				const end = start.translate(0, tem[0].length - 1);

				if (!res.has(tem[0])) {
					res.set(tem[0], []);
				}
				// NOTE: 索引
				res.get(tem[0]).push({
					key: tem[0],
					loc: new Location(document.uri, new Range(start, end)),
					code: document.lineAt(start.line - 1).text.trim(),
					languageId: document.languageId,
				});

				// this.addApply(tem[0], new Location(document.uri, new Range(start, end)), {
				// 	code: document.lineAt(start.line - 1).text.trim(),
				// 	languageId: document.languageId,
				// });
			}
		});
		return [uri.fsPath, res];
	}

	// 检测方式2-split字符串查找方式
	private async getApplyOfFileBySplit(
		uri: Uri,
		defMap: DefMapType
	): Promise<[string, Map<string, ApplyParseNode[]>]> {
		const document = await workspace.openTextDocument(uri);
		const res: Map<string, ApplyParseNode[]> = new Map();

		for (let line = 1; line <= document.lineCount; line++) {
			const lineWord = config.splitLetters.flatMap((s) =>
				document.lineAt(line - 1).text.split(s)
			);

			let column = 1;
			// 保证顺序遍历
			for (let i = 0; i < lineWord.length; i++) {
				if (defMap[lineWord[i]]) {
					// TODO:整理所有的偏移计算,这里line为什么要+1而不是-1
					const range = new Range(line, column, line, column + lineWord[i].length - 1);

					if (!res.has(lineWord[i])) {
						res.set(lineWord[i], []);
					}
					res.get(lineWord[i]).push({
						key: lineWord[i],
						loc: new Location(document.uri, range),
						code: document.lineAt(line - 1).text.trim(),
						languageId: document.languageId,
					});
				}
				column += lineWord[i].length + 1;
			}
		}
		return [uri.fsPath, res];
	}
}

export default new ApplyParser();
