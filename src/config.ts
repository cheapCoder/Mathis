import { workspace } from "vscode";
import packageJson from "../package.json";

interface LibFormatRegMap {
	"react-intl": RegExp[];
	"svelte-i18n": RegExp[];
}

class Config {
	public projectName = packageJson.name;
	public splitLetters = ["'", '"'];
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

	public applyList: Set<string> = new Set(); // 每个元素为uri path
	public defList: Set<string> = new Set();

	// public lazyLoadApply = true;
	public delayTime = 1500;
	public detectApplyWay = "split";
	public pathSlice = true;
	public useCompletion = false;
	public statusBar = false;
	public defSelect = "value";
	public define: { include: string; exclude: string }[] = [];
	public apply: { include: string; exclude: string }[] = [];
	public remoteLocaleENV = "production";

	// for主题升级
	public useTokenReplace = false;

	[key: string]: any;

	constructor() {
		this.mergeConfig();
		workspace.onDidChangeConfiguration(this.mergeConfig.bind(this));
	}

	async init() {
		await Promise.all([this.distinguishFiles(), this.findI18nLib()]);
		// console.log(this);
	}

	private mergeConfig() {
		const conf = workspace.getConfiguration(this.projectName);

		Object.keys(this).forEach(key => {
			if (conf[key] && !(this[key] instanceof Function)) {
				this[key] = conf[key];
			}
		});
	}

	private async distinguishFiles() {
		// 查找定义文件
		// ts,js,json格式的多语言文件
		this.defList = new Set(
			(await Promise.all(this.define.map(({ exclude, include }) => workspace.findFiles(include, exclude))))
				.flat()
				.map(v => v.fsPath)
		);

		// 查找应用文件, 过滤匹配的locale定义文件
		this.applyList = new Set(
			(await Promise.all(this.apply.map(({ include, exclude }) => workspace.findFiles(include, exclude))))
				.flat()
				.map(v => v.fsPath)
				.filter(al => !this.defList.has(al))
		);
	}

	private async findI18nLib() {
		// 查找依赖库
		try {
			const path = (await workspace.findFiles("package.json"))[0].fsPath;
			const packageJson = (await import(path))["default"];

			this.i18nLib = Object.keys(this.libFormatRegMap).find(
				// devDependencies
				name => packageJson["dependencies"]?.[name] || packageJson["devDependencies"]?.[name]
			) as I18nLibType;
		} catch (e) {
			// console.log("未发现package.json文件或i18n库依赖");
		}
	}
}

export default new Config();
