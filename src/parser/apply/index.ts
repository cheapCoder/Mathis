import { Range, Uri, workspace } from "vscode";
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
		this.matchUris = await workspace.findFiles(
			"**/*.{ts,js,tsx,jsx,svelte,vue}",
			"**/node_modules/**"
		);

		// 过滤匹配的locale定义文件
		this.matchUris = this.matchUris.filter(
			(au) => !defParser.matchUris.find((du) => du.fsPath === au.fsPath)
		);

		let arrs = (
			await Promise.all(this.matchUris.map((u) => workspace.fs.readFile(u)))
		).map((a) => a.toString());

		// TODO: check bug
		arrs.forEach((text, i) => {
			// for (let i = 0; i < arrs.length; i++) {
			// const text = arrs[i];

			this.libFormatRegMap[manger.i18nLib].forEach(async (reg) => {
				// for (let j = 0; j < this.libFormatRegMap[manger.i18nLib.length]; j++) {
				// const reg = this.libFormatRegMap[manger.i18nLib[j]];

				let tem;
				const r = new RegExp(reg, "g");
				while ((tem = r.exec(text))) {
					const document = await workspace.openTextDocument(this.matchUris[i]);
					const start = document.positionAt(tem.index);
					const end = start.translate(0, tem[0].length);

					// NOTE: 索引
					manger.addApply(tem[0], this.matchUris[i].fsPath, new Range(start, end), {
						code: document.lineAt(start.line).text.trim(),
						languageId: document.languageId,
					});
				}
			});
		});
	}

	private async dispatchApplyParser(uris: Uri | Uri[]) {
		Array.isArray(uris) || (uris = [uris]);

		await Promise.all(uris.map((u) => workspace.fs.readFile(u)));
	}
}

export default new ApplyParser();
