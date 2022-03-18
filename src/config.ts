import { Uri, window, workspace } from "vscode";
import packageJson from "../package.json";

interface LibFormatRegMap {
	"react-intl": RegExp[];
	"svelte-i18n": RegExp[];
}

class Config {
	public projectName = packageJson.name;
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
	public i18nLib: keyof LibFormatRegMap | undefined;
	public libFormatRegMap: LibFormatRegMap = {
		// TODO:优化正则匹配
		"react-intl": [/(?<=((props\.)?intl\.)?formatMessage\(\s*{\s*id:\s+['"])([a-zA-Z\._]+)(?=['"])/],
		"svelte-i18n": [/(?<=\$_\(['"])[\w\d_-]+(?=['"].*?\))/],
	};

	public applyList: Uri[] = [];
	public defList: Uri[] = [];

	public lazyLoadApply = true;
	public detectApplyWay = "split";
	public pathSlice = true;
	public defSelect = "value";

	constructor() {
		this.mergeConfig();
		workspace.onDidChangeConfiguration(this.mergeConfig.bind(this));
	}

	async init() {
		await Promise.all([this.distinguishFiles(), this.findI18nLib()]);
	}

	private mergeConfig() {
		const conf = workspace.getConfiguration(this.projectName);

		this.lazyLoadApply = conf.lazyLoadApply;
		this.detectApplyWay = conf.detectApplyWay;
		this.pathSlice = conf.pathSlice;
		this.defSelect = conf.defSelect;
	}

	private async distinguishFiles() {
		// 查找定义文件
		// TODO:可配置
		// ts,js,json格式的多语言文件
		this.defList = await workspace.findFiles(
			"src/**/locale/{en_US,zh_CN}.{ts,js,json}",
			"**/{node_modules,dist,out}/**"
		);

		// 查找应用文件
		this.applyList = await workspace.findFiles(
			"src/**/*.{ts,js,tsx,jsx,svelte,vue}",
			"**/{node_modules,dist,out}/**"
		);
		// 过滤匹配的locale定义文件
		this.applyList = this.applyList.filter((al) => !this.defList.find((dl) => dl.fsPath === al.fsPath));
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
