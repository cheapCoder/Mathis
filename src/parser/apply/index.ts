import { Uri, workspace } from "vscode";
import manger from "../../manger";
import defParser from "../def/index";

// TODO: 懒加载到打开locale文件时再实例化
class ApplyParser {
	public libFormatRegMap = {
		// TODO:正则不可加全局匹配g
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

		const arrs = await Promise.all(this.matchUris.map((u) => workspace.fs.readFile(u)));

		arrs
			.map((a) => a.toString())
			.forEach((text, i) => {
				this.libFormatRegMap[manger.i18nLib].forEach(async (reg) => {
					let tem;
					const r = new RegExp(reg, "g");
					while ((tem = r.exec(text))) {
						// NOTE: 索引
						manger.addApply(tem[0], this.matchUris[i].fsPath, tem.index);
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
