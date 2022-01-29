import { window, workspace } from "vscode";

class Manger {
	public static applyRegMap = {
		"react-intl": /(?<=((props\.)?intl\.)?formatMessage\(\s*{\s*id:\s+['"])([a-zA-Z\._]+)(?=['"])/g,
		"svelte-i18n": /\$_\(['"]([\w\d_-]+)['"]\)/g,
	};

	curFileType: CurFileType;
	public i18nLib: I18nLibType;

	constructor() {
		this.init();
	}

	public async init() {
		try {
			const path = (await workspace.findFiles("package.json"))[0].fsPath;
			const packageJson = (await import(path))["default"];

			this.i18nLib = Object.keys(Manger.applyRegMap).find(
				(name) => packageJson["dependencies"][name]
			) as I18nLibType;
		} catch (e) {
			window.showErrorMessage("未发现package.json文件或i18n库依赖");
		}
	}
}

export default new Manger();
