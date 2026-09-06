import { window, workspace } from "vscode";
import packageJson from "../package.json";

interface LibFormatRegMap {
	"react-intl": RegExp[];
	"svelte-i18n": RegExp[];
	"next-intl": RegExp[];
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
		"next-intl": [], // 靠 useTranslations("ns") 绑定解析完整 key（见 parser/nextIntl.ts），不走正则
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
			// i18nLib 由 findI18nLib 解析（设置为 auto 时按 package.json 识别），不直接覆盖
			if (key !== "i18nLib" && conf[key] && !(this[key] instanceof Function)) {
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

	// 按根 package.json 的依赖判断 i18n 库；用 fs 读而不是 import()：esbuild 打包后 import() 会原样保留，扩展宿主里导入 JSON 会失败
	private async findI18nLib() {
		const configured = workspace.getConfiguration(this.projectName).get<string>("i18nLib", "auto");
		if (configured !== "auto") {
			this.i18nLib = configured as I18nLibType;
			return;
		}

		const [uri] = await workspace.findFiles("package.json");
		if (!uri) return;

		let packageJson: Record<string, Record<string, string> | undefined>;
		try {
			packageJson = JSON.parse((await workspace.fs.readFile(uri)).toString());
		} catch (e) {
			// 系统边界：用户项目的 package.json 不合法，明确报错后按未识别到 i18n 库继续
			window.showErrorMessage(`Mathis: 解析 ${uri.fsPath} 失败，无法识别 i18n 库: ${e}`);
			return;
		}

		this.i18nLib = Object.keys(this.libFormatRegMap).find(
			name => packageJson["dependencies"]?.[name] || packageJson["devDependencies"]?.[name]
		) as I18nLibType;
	}
}

export default new Config();
