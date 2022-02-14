import { Location, Range, Uri, workspace } from "vscode";
import config from "../../config";
import manger from "../../manger";
import defParser from "../def/index";

class ApplyParser {
	public libFormatRegMap = {
		"react-intl": [
			/(?<=((props\.)?intl\.)?formatMessage\(\s*{\s*id:\s+['"])([a-zA-Z\._]+)(?=['"])/,
		],
		"svelte-i18n": [/(?<=\$_\(['"])[\w\d_-]+(?=['"].*?\))/],
	};

	public matchUris: Uri[] = [];

	public async init() {
		if (!defParser.isReady) {
			setTimeout(this.init, 500);
			return;
		}

		this.matchUris = await workspace.findFiles(
			"**/*.{ts,js,tsx,jsx,svelte,vue}",
			"**/node_modules/**"
		);

		// 过滤匹配的locale定义文件
		this.matchUris = this.matchUris.filter(
			(au) => !defParser.matchUris.find((du) => du.fsPath === au.fsPath)
		);

		// let arrs = (
		// 	await Promise.all(this.matchUris.map((u) => workspace.fs.readFile(u)))
		// ).map((a) => a.toString());

		this.matchUris.forEach(async (uri, i) => {
			// 法一
			this.getApplyOfFileByReg(uri);

			// 法二
			// this.getApplyOfFileBySplit(uri);
		});
	}

	// 检测方式1-正则表达式
	private async getApplyOfFileByReg(uri: Uri) {
		const document = await workspace.openTextDocument(uri);

		this.libFormatRegMap[manger.i18nLib].forEach((reg) => {
			let tem;
			const r = new RegExp(reg, "g");
			while ((tem = r.exec(document.getText()))) {
				const start = document.positionAt(tem.index).translate(1, 1);
				const end = start.translate(0, tem[0].length - 1);

				// NOTE: 索引
				manger.addApply(tem[0], new Location(document.uri, new Range(start, end)), {
					code: document.lineAt(start.line - 1).text.trim(),
					languageId: document.languageId,
				});
			}
		});
	}

	// 检测方式2-split字符串查找方式
	private async getApplyOfFileBySplit(uri: Uri) {
		const document = await workspace.openTextDocument(uri);
		for (let line = 1; line <= document.lineCount; line++) {
			const lineWord = config.splitLetters.flatMap((s) =>
				document.lineAt(line - 1).text.split(s)
			);

			let column = 1;
			// 保证顺序遍历
			for (let i = 0; i < lineWord.length; i++) {
				if (manger.keyMap[lineWord[i]]) {
					// TODO:整理所有的偏移计算,这里line为什么要+1而不是-1
					const range = new Range(line, column, line, column + lineWord[i].length - 1);

					manger.addApply(lineWord[i], new Location(document.uri, range), {
						code: document.lineAt(line - 1).text.trim(),
						languageId: document.languageId,
					});
				}

				column += lineWord[i].length + 1;
			}
		}
	}

	// private async dispatchApplyParser(uris: Uri | Uri[]) {
	// 	Array.isArray(uris) || (uris = [uris]);

	// 	await Promise.all(uris.map((u) => workspace.fs.readFile(u)));
	// }
}

export default new ApplyParser();
