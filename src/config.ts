import { ExtensionContext, Uri, window, workspace } from "vscode";

class Config {
	public projectName = "";
	public splitLetters = ["'", '"', "`"];
	public activeFileLanguage = [
		"javascript",
		"javascriptreact",
		"typescript",
		"typescriptreact",
		"svelte",
		"json",
		"jsonc",
	];
	public i18nLib = "";
	public libFormatRegMap = {
		"react-intl": [
			/(?<=((props\.)?intl\.)?formatMessage\(\s*{\s*id:\s+['"])([a-zA-Z\._]+)(?=['"])/,
		],
		"svelte-i18n": [/(?<=\$_\(['"])[\w\d_-]+(?=['"].*?\))/],
	};

	public applyList: Uri[] = [];
	public defList: Uri[] = [];

	async init(context: ExtensionContext) {
		this.projectName = context.extension.packageJSON.name;

		const conf = workspace.getConfiguration(this.projectName);
		// console.log(conf.get("defSelect"));

		// mergeConfig()

		await Promise.all([this.distinguishFiles(), this.findI18nLib()]);
	}

	private async distinguishFiles() {
		// 查找定义文件
		// TODO:可配置
		// ts,js,json格式的多语言文件
		this.defList = await workspace.findFiles(
			"**/locale/{en_US,zh_CN}.{ts,js,json}",
			"**/node_modules/**"
		);

		// 查找应用文件
		this.applyList = await workspace.findFiles(
			"**/*.{ts,js,tsx,jsx,svelte,vue}",
			"**/node_modules/**"
		);
		// 过滤匹配的locale定义文件
		this.applyList = this.applyList.filter(
			(al) => !this.defList.find((dl) => dl.fsPath === al.fsPath)
		);
	}

	private async findI18nLib() {
		// 查找依赖库
		try {
			const path = (await workspace.findFiles("package.json"))[0].fsPath;
			const packageJson = (await import(path))["default"];

			this.i18nLib = Object.keys(this.libFormatRegMap).find(
				(name) => packageJson["dependencies"][name]
			) as I18nLibType;
		} catch (e) {
			window.showErrorMessage("未发现package.json文件或i18n库依赖");
		}
	}
}

export default new Config();
