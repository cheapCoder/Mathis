import { request } from "https";
import { URL } from "url";
import {
	CancellationToken,
	CodeAction,
	CodeActionContext,
	CodeActionKind,
	commands,
	Diagnostic,
	DiagnosticRelatedInformation,
	DiagnosticSeverity,
	DiagnosticTag,
	ExtensionContext,
	Hover,
	languages,
	Location,
	MarkdownString,
	Position,
	Range,
	Selection,
	TextDocument,
	Uri,
	window,
	workspace,
	WorkspaceEdit,
} from "vscode";

import gonzales from "gonzales-pe";
import path from "path";
import pj from "../../package.json";

class StyleToken {
	public static readonly SOURCE = "STYLE TOKEN";
	public static readonly SUPPORT_LANG = ["less", "scss", "sass", "css"];
	public curColorLink = "";
	public colorReg = /#([\da-f]{8}|[\da-f]{6}|[\da-f]{3})(?=[;\s])/gi;
	public valueMap = new Map<string, string[]>();
	public nameMap = new Map<string, { val: string; usage: true | string[] }>();
	public diagCollection = languages.createDiagnosticCollection(StyleToken.SOURCE);

	constructor(context: ExtensionContext) {
		const self = this;

		// replace all design token
		const replaceAllTokenDis = commands.registerCommand(`${pj.name}.replaceAllToken`, async () => {
			const config = workspace.getConfiguration(pj.name);

			if (self.valueMap.size === 0 || self.curColorLink !== config.tokenLink) {
				const sourceText = await self.getText();
				await self.parseSource(sourceText);
				self.curColorLink = config.tokenLink;
			}

			const files = await workspace.findFiles(config.includeGlob, config.excludeGlob);

			let edits = new WorkspaceEdit();
			self.diagCollection.clear();
			await Promise.all(files.map(file => self.replaceFileToken(file, edits)));
			edits.size > 0 && workspace.applyEdit(edits);
		});

		// replace to css variable command
		const replaceSingleTokenDis = commands.registerCommand(
			`${pj.name}.replaceSingleToken`,
			async (file: Uri, diag: Diagnostic, val: string) => {
				const edit = new WorkspaceEdit();
				edit.replace(file, diag.range, val);
				await workspace.applyEdit(edit);

				// TODO:BUG
				// tokenManager.replaceFileToken(file);
				self.diagCollection.set(
					file,
					self.diagCollection.get(file)?.filter(d => !diag.range.isEqual(d.range))
				);
			}
		);

		// 创建code action provider
		const themeActionDis = languages.registerCodeActionsProvider(
			StyleToken.SUPPORT_LANG,
			self.colorProvider,
			{
				providedCodeActionKinds: self.colorProvider.providedCodeActionKinds,
			}
		);

		//css var hover show value
		const colorValDis = languages.registerHoverProvider(StyleToken.SUPPORT_LANG, {
			provideHover(document: TextDocument, position: Position, token: CancellationToken) {
				const lineText = document.lineAt(position.line).text;
				let reg = /var\((.*?)\)/gi;
				let cur;
				while ((cur = reg.exec(lineText))) {
					const val = self.nameMap.get(cur[1])?.val;

					if (val && position.character >= cur.index && position.character < cur.index + cur[0].length) {
						const ms = new MarkdownString(
							`rgb: ${val} [$(explorer-view-icon)](command:${pj.name}.copy?${encodeURIComponent(
								JSON.stringify({ value: val })
							)} "复制")`,
							true
						);
						ms.isTrusted = true;
						return new Hover(ms);
					}
				}
			},
		});

		context.subscriptions.push(
			replaceAllTokenDis,
			replaceSingleTokenDis,
			themeActionDis,
			colorValDis,
			self.diagCollection
		);
	}

	public colorProvider = {
		providedCodeActionKinds: [CodeActionKind.QuickFix],

		provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext) {
			// 多选区域内不止一个诊断信息则忽略
			if (context.diagnostics.length !== 1) return;

			const diag = context.diagnostics[0];
			if (diag.source !== StyleToken.SOURCE) return;

			// @ts-ignore
			const res: CodeAction[] = (diag["replaceList"] || []).map((val: string) => {
				const action = new CodeAction(`替换为:${val}`, CodeActionKind.QuickFix);
				action.command = {
					command: `${pj.name}.replaceSingleToken`,
					title: "替换颜色",
					arguments: [document.uri, diag, `var(${val})`],
				};
				action.diagnostics = [diag];
				return action;
			});

			return res;
		},
	};

	public async replaceFileToken(file: Uri, edits?: WorkspaceEdit) {
		// 替换antd的@{}语法
		const content = (await workspace.fs.readFile(file)).toString().replace(/@{(.*?)}/g, "__$1_");
		const list = this.parseApply(content, file);

		// 未传edits表示只更新单个文件
		let passEdits: boolean = true;
		if (!edits) {
			passEdits = false;
			edits = new WorkspaceEdit();
		}

		const diaList: Diagnostic[] = [];
		list.forEach(({ usage, valoc, key, val }) => {
			if (usage.length === 1) {
				// 只有一个直接替换
				edits!.replace(file, valoc.range, `var(${usage[0]})`);
			} else {
				// 大于1个或不存在，则生成code action
				const diag = new Diagnostic(
					valoc.range,
					"请引用design token设置颜色",
					DiagnosticSeverity[usage.length ? "Information" : "Warning"]
				);
				diag.relatedInformation = [new DiagnosticRelatedInformation(valoc, val)];
				// diag.code = { value: color, target: file };
				diag.source = StyleToken.SOURCE;

				// @ts-ignore
				diag.replaceList = usage;
				usage.length || (diag.tags = [DiagnosticTag.Deprecated]);

				diaList.push(diag);
			}
		});
		diaList.length && this.diagCollection.set(file, diaList);
		passEdits || workspace.applyEdit(edits);
	}

	public parseApply(content: string, uri: Uri): TokenNode[] {
		const res: TokenNode[] = [];
		try {
			const tree = gonzales.parse(content, { syntax: path.parse(uri.fsPath).ext.slice(1) });

			tree.traverseByType("declaration", (n: any) => {
				const key = n.content.find((subNode: any) => subNode.type === "property").toString();

				n.content
					.find((subNode: any) => subNode.type === "value")
					?.content.filter((subNode: any) => subNode.type !== "space")
					.forEach((n: any) => {
						const val = n.toString();
						const usage = (this.valueMap.get(val) || []).filter(
							// usage为undefined表示全部可用
							k =>
								this.nameMap.get(k)?.usage === true ||
								(this.nameMap.get(k)?.usage as string[]).some(k => key.includes(k))
						);

						usage.length &&
							res.push({
								key,
								val,
								usage,
								valoc: new Location(
									uri,
									new Range(n.start.line - 1, n.start.column - 1, n.end.line - 1, n.end.column)
								),
							});
					});
			});
		} catch (error) {
			console.log(error);
		} finally {
			// console.log(res);
			return res;
		}
	}

	public formatColor(val: string) {
		if (val.length === 9) {
			// rgba => rgb
			val = val.slice(0, -2);
		} else if (val.length === 4) {
			// fff=>ffffff
			val = "#" + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
		}
		return val;
	}

	public async getText(link = workspace.getConfiguration(pj.name).tokenLink): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const { hostname, port, pathname: path } = new URL(link);

			const req = request({ hostname, port, path, method: "GET" }, res => {
				let text = "";
				res.on("data", d => {
					text += d;
				});
				res.on("end", () => {
					resolve(text);
				});
				res.on("error", () => {
					reject();
				});
			});
			req.on("error", () => {
				reject();
			});
			req.end();
		}).catch(() => {
			window.showErrorMessage("token链接解析出现错误");
			return "";
		});
	}

	public async parseSource(text2: string): Promise<void> {
		this.nameMap.clear();
		this.valueMap.clear();

		// let text = "";
		// try {
		// 	text = await this.getText(link);
		// } catch (e) {
		// 	console.log(e);
		// 	window.showErrorMessage("css token源解析失败");
		// }
		// text = text.replace(/\n/g, "");

		// let repeatNameList = new Set();
		let reg = /(?<=.*?\{)[\w\W]*?(?=\})/g;
		// 每个css对象
		text.match(reg)?.forEach(s => {
			let curTypes: boolean | string[]; // true: 接收所有属性； false: 忽略此token; string[]: 可包含的css属性名子串
			let res: string;
			const lines = s.split(";").map(l => l.trim());
			// 每行
			lines.forEach(line => {
				if (!line) return;

				// 注释行
				if ((res = line.match(/(?<=\/\*.*?)@.*?(?=\*\/)/g)?.[0] || "")) {
					if (res.startsWith("@use")) {
						curTypes = res
							.match(/(?<=@use\().*?(?=\))/g)![0]
							.split("|")
							.map(s => s.trim());

						curTypes[0] === "*" && (curTypes = true);
					} else if (res.startsWith("@ignore")) {
						curTypes = false;
					}
				} else {
					// 为false忽略此token
					if (!curTypes) return;

					// css行
					let item = line.split(":").map(v => v.trim().toLowerCase());
					// if (this.nameMap.has(item[0])) {
					// 	repeatNameList.add(item[0]);
					// }
					// 添加name-value
					this.nameMap.set(item[0], { val: item[1], usage: curTypes });

					// 格式化颜色
					if (this.colorReg.test(item[1] + ";")) {
						item[1] = this.formatColor(item[1]);
					}
					// 添加value - name[]
					if (!this.valueMap.has(item[1])) {
						this.valueMap.set(item[1], []);
					}
					this.valueMap.get(item[1])?.push(item[0]);
				}
			});
		});
		// console.log(this.nameMap);
		// console.log(this.valueMap);
	}
}

export default StyleToken;

var text = `body {
	/* @use(color | background) */
	--color-branding-logo-red: #f00;
	--color-branding-primary-red: #eb4646;
	--color-branding-dark-red: #c83c3c;
	--color-branding-light-red: #ff7784;
	--color-branding-lighter-red: #fef4f4;
	--color-branding-purple: #5959ff;
	--color-branding-cream: #f2eada;
	--color-branding-neutral: #222;
	--color-branding-grey100: #4c5d66;
	--color-branding-grey75: #79868c;
	--color-branding-grey50: #a5adb2;
	--color-branding-grey25: #d2d6d8;
	--color-basic-blue: #4d74ed;
	--color-basic-dark-blue: #4263ca;
	--color-basic-light-blue: #c7e3ff;
	--color-basic-white: #fff;
	--color-basic-success: #21a470;
	--color-basic-info: #3369ff;
	--color-basic-light-warning: #e5ae00;
	--color-basic-warning: #f5891d;
	--color-basic-critical: #db393a;
	--color-basic-background-grey: #fafafa;
	--color-basic-background-cream: #f5f4f1;
	--color-primary-default: #4d74ed;
	--color-primary-hover: #5e82ef;
	--color-primary-pressed: #4263ca;
	--color-primary-disabled: #b8c7f8;
	--color-secondary-default: #fff;
	--color-secondary-hover: #eff1f4;
	--color-secondary-pressed: #e5e7ea;
	--color-secondary-disabled: #fff;
	--color-flat-default: #fff;
	--color-flat-hover: #eff1f4;
	--color-flat-pressed: #e5e7ea;
	--color-flat-disabled: #eff1f4;
	--color-critical-default: #db393a;
	--color-critical-hover: #c93033;
	--color-critical-pressed: #bc292c;
	--color-critical-disabled: #fbc9c9;
	--color-line-border: #d5d6d9;
	--color-line-separator: #e5e5e5;
	--color-info-primary: #3369ff;
	--color-info-border: #6790ff;
	--color-info-background: #ebf0ff;
	--color-success-primary: #21a470;
	--color-success-border: #72caa7;
	--color-success-background: #ebfff7;
	--color-light-warning-primary: #e5ae00;
	--color-light-warning-border: #ffda66;
	--color-light-warning-background: #fffaeb;
	--color-warning-primary: #f5891d;
	--color-warning-border: #fca854;
	--color-warning-background: #fef4ea;
	--color-critical-primary: #db393a;
	--color-critical-border: #f5a1a1;
	--color-critical-background: #ffebeb;
	--color-tag-info: #3369ff;
	--color-tag-partial-success: #00a0ac;
	--color-tag-success: #21a470;
	--color-tag-light-warning: #ffc81a;
	--color-tag-warning: #f5891d;
	--color-tag-failed: #c4c7cc;
	--color-tag-critical: #db393a;
	--color-tag-custom: #222;
	--color-tag-enterprise: #6faac0;
	--color-tag-base: #ebc143;
	--color-tag-pro: #7d849a;
	--color-tag-free: #a42c2b;
	--color-tag-advanced: #84b386;
	--color-tag-premier: #b194bd;
	--color-tag-na: #cacccb;
	--color-blue-50: #ebf0ff;
	--color-blue-100: #c1d1fe;
	--color-blue-200: #99b4fe;
	--color-blue-300: #6790ff;
	--color-blue-400: #3369ff;
	--color-blue-500: #004dfc;
	--color-blue-600: #0044f0;
	--color-blue-700: #0039e4;
	--color-blue-800: #002cd9;
	--color-blue-900: #0014c0;
	--color-green-50: #ebfff7;
	--color-green-100: #cef5e5;
	--color-green-200: #9cd9c1;
	--color-green-300: #72caa7;
	--color-green-400: #50bf93;
	--color-green-500: #27b37b;
	--color-green-600: #21a470;
	--color-green-700: #1a9262;
	--color-green-800: #188056;
	--color-green-900: #146040;
	--color-red-50: #ffebeb;
	--color-red-100: #fbc9c9;
	--color-red-200: #f5a2a2;
	--color-red-300: #f57f7f;
	--color-red-400: #e65253;
	--color-red-500: #ea423b;
	--color-red-600: #db3939;
	--color-red-700: #c93033;
	--color-red-800: #bc292c;
	--color-red-900: #ad2021;
	--color-orange-50: #fef4ea;
	--color-orange-100: #fed8b2;
	--color-orange-200: #ffc285;
	--color-orange-300: #fca854;
	--color-orange-400: #fb9734;
	--color-orange-500: #f98c1f;
	--color-orange-600: #f5891d;
	--color-orange-700: #ee7a1b;
	--color-orange-800: #e86a19;
	--color-orange-900: #dd5217;
	--color-yellow-50: #fffce5;
	--color-yellow-100: #fffacc;
	--color-yellow-200: #fff599;
	--color-yellow-300: #ffef66;
	--color-yellow-400: #ffea33;
	--color-yellow-500: #ffe600;
	--color-yellow-600: #fcdb00;
	--color-yellow-700: #fad000;
	--color-yellow-800: #f7c600;
	--color-yellow-900: #f5bc00;
	--color-black-50: #f7f8fb;
	--color-black-100: #eff1f4;
	--color-black-200: #e5e7ea;
	--color-black-300: #d5d6d9;
	--color-black-400: #b0b2b4;
	--color-black-500: #909294;
	--color-black-600: #686a6c;
	--color-black-700: #555659;
	--color-black-800: #37383a;
	--color-black-900: #17181a;
	--color-text-primary: #222222;
	--color-text-secondary: #686a6c;
	--color-text-disabled: #b3b4b5;
	--color-text-critical: #db393a;
	--color-text-link: #4d74ed;
	--color-text-white: #ffffff;
	/* @use(font) */
	--font-size-xs: 12px;
	--font-size-sm: 14px;
	--font-size-base: 16px;
	--font-size-lg: 20px;
	--font-size-xl: 24px;
	--font-size-2xl: 28px;
	/* @use(line-height) */
	--leading-xs: 16px;
	--leading-sm: 20px;
	--leading-base: 24px;
	--leading-lg: 28px;
	--leading-xl: 32px;
	--leading-2xl: 32px;
	/* @use(font-weight) */
	--font-weight-normal: 400;
	--font-weight-medium: 500;
	--font-weight-semibold: 600;
	--font-weight-bold: 700;
	/* @use(font-family) */
	--font-family: "Helvetica Neue For Number", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
	"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
	/* @ignore */
	--text-badge: var(--font-weight-medium) var(--font-size-xs) / var(--leading-xs) var(--font-family);
	--text-annotation: var(--font-weight-normal) var(--font-size-xs) / var(--leading-xs) var(--font-family);
	--text-body: var(--font-weight-normal) var(--font-size-sm) / var(--leading-sm) var(--font-family);
	--text-button: var(--font-weight-medium) var(--font-size-sm) / var(--leading-sm) var(--font-family);
	--text-title-sm: var(--font-weight-semibold) var(--font-size-sm) / var(--leading-sm) var(--font-family);
	--text-title-base: var(--font-weight-semibold) var(--font-size-base) / var(--leading-base)
		var(--font-family);
	--text-title-lg: var(--font-weight-semibold) var(--font-size-lg) / var(--leading-lg) var(--font-family);
	--text-title-xl: var(--font-weight-semibold) var(--font-size-xl) / var(--leading-xl) var(--font-family);
	--text-title-2xl: var(--font-weight-semibold) var(--font-size-2xl) / var(--leading-2xl) var(--font-family);
	/* @use(border-radius) */
	--rounded-none: 0px;
	--rounded-sm: 2px;
	--rounded: 4px;
	--rounded-md: 6px;
	--rounded-lg: 8px;
	--rounded-xl: 12px;
	--rounded-2xl: 16px;
	--rounded-3xl: 20px;
	/* @use(margin | padding) */
	--space-1px: 1px;
	--space-2px: 2px;
	--space-1: 4px;
	--space-2: 8px;
	--space-3: 12px;
	--space-4: 16px;
	--space-5: 20px;
	--space-6: 24px;
	--space-7: 28px;
	--space-8: 32px;
	--space-9: 36px;
	--space-10: 40px;
	--space-12: 48px;
	--space-16: 64px;
	--space-24: 96px;
	--space-40: 160px;
	/* @use(shadow) */
	--shadow-card: 0px 2px 1px rgba(0, 0, 0, 0.05), 0px 2px 1px rgba(0, 0, 0, 0.05);
	--shadow-popover: 0px 0px 2px rgba(0, 0, 0, 0.1), 0px 2px 10px rgba(0, 0, 0, 0.1);
	--shadow-modal: 0px 0px 4px rgba(0, 0, 0, 0.1), 0px 8px 40px rgba(0, 0, 0, 0.2);
}

body {
	/* @ignore */
	--animation-duration-slow: 0.3s;
	--animation-duration-base: 0.2s;
	--animation-duration-fast: 0.1s;
	--animation-ease-in-out: cubic-bezier(0.645, 0.045, 0.355, 1);
	--animation-ease-out: cubic-bezier(0.215, 0.61, 0.355, 1);
	--frame-min-width: 1280px;
	--frame-bg-color: var(--color-basic-white);
	--frame-notification-bar-bg-color: #eef0f5;
	--frame-side-bar-width: 210px;
	--frame-side-bar-collapsed-width: 64px;
	--frame-side-bar-bg-color: var(--color-basic-white);
	--frame-side-bar-br-color: var(--color-line-separator);
	--frame-side-bar-header-height: 60px;
	--frame-side-bar-header-color: var(--color-text-primary);
	--frame-side-bar-header-bg-color: var(--color-basic-white);
	--frame-side-bar-header-secondary-bg-color: var(--color-basic-background-grey);
	--frame-side-bar-footer-height: 70px;
	--frame-side-bar-footer-bg-color: var(--color-basic-background-grey);
	--frame-top-bar-height: 60px;
	--frame-top-bar-bg-color: var(--color-basic-white);
	--frame-top-bar-bb-color: var(--color-line-separator);
	--frame-content-bg-color: #eef0f5;
	--frame-avatar-color: var(--color-branding-primary-red);
	--frame-avatar-bg-color: var(--color-branding-lighter-red);
	--nav-bg-color: var(--color-basic-white);
	--nav-item-bg-color: var(--color-basic-white);
	--nav-item-text-color: var(--color-text-primary);
	--nav-item-color-hover: var(--color-text-primary);
	--nav-item-bg-color-hover: var(--color-branding-lighter-red);
	--nav-item-bg-color-selected: var(--color-basic-white);
	--nav-item-text-color-selected: var(--color-branding-primary-red);
	--nav-item-text-font-weight-selected: var(--font-weight-normal);
	--nav-px: var(--space-2);
	--nav-py: var(--space-6);
	--nav-group-mt: var(--space-8);
	--nav-section-sibling-mt: var(--space-2);
	--nav-section-px: var(--space-2);
	--nav-section-py: var(--space-2);
	--nav-section-rounded: var(--rounded);
	--nav-item-pl: var(--space-8);
	--nav-item-pr: var(--space-2);
	--nav-item-py: var(--space-2);
	--nav-arrow-placeholder-width: 32px;
	--nav-icon-font-size: var(--font-size-base);
	--nav-font: var(--text-body);
	--nav-leading: var(--leading-sm);
	--nav-item-icon-mr: var(--space-2);
	--nav-badge-ml: var(--space-2);
	--nav-badge-min-width: 20px;
	--nav-badge-py: var(--space-2px);
	--nav-badge-px: var(--space-1);
	--nav-badge-font: var(--text-badge);
	--nav-badge-rounded: var(--rounded-3xl);
	--nav-badge-bg-color: var(--color-branding-cream);
	--nav-badge-color: var(--color-text-primary);
	--nav-scrollbar-thumb-bg-color: var(--color-black-300);
	--nav-scrollbar-track-bg-color: var(--color-basic-white);
	--logo-icon-image: url("https://assets.shoplazza.com/oss/operation/68a8c24df36c0faf77534e90a33b0d34.svg");
	--logo-icon-text-image: url("https://assets.shoplazza.com/oss/operation/c8ffec9f61f63cca1fa78bcff44c9615.svg");
	--button-transition-duration: 0;
	--button-small-min-width: 70px;
	--button-middle-min-width: 78px;
	--button-middle-square-size: 28px;
	--button-small-height: 32px;
	--button-middle-height: 36px;
	--button-small-px: var(--space-3);
	--button-middle-px: var(--space-4);
	--button-line-height: var(--leading-sm);
	--button-rounded: var(--rounded);
	--button-primary-color: var(--color-text-white);
	--button-primary-bg-color: var(--color-primary-default);
	--button-primary-bg-color-hover: var(--color-primary-hover);
	--button-primary-bg-color-active: var(--color-primary-pressed);
	--button-primary-bg-color-disabled: var(--color-primary-disabled);
	--button-danger-primary-bg-color: var(--color-critical-default);
	--button-danger-primary-bg-color-hover: var(--color-red-400);
	--button-danger-primary-bg-color-active: var(--color-critical-pressed);
	--button-danger-primary-bg-color-disable: var(--color-critical-disabled);
	--button-default-color: var(--color-text-secondary);
	--button-default-bg-color: var(--color-basic-white);
	--button-default-color-hover: var(--color-primary-hover);
	--button-default-border-color-hover: var(--color-primary-hover);
	--button-default-color-active: var(--color-primary-pressed);
	--button-default-border-color-active: var(--color-primary-pressed);
	--button-default-color-disabled: var(--color-text-disabled);
	--button-default-border-color-disabled: var(--color-text-disabled);
	--button-default-border-color: var(--color-line-border);
	--button-danger-default-color: var(--color-critical-default);
	--button-danger-default-color-disabled: var(--color-critical-disabled);
	--button-danger-default-bg-color: var(--color-basic-white);
	--button-danger-default-bg-color-hover: var(--color-branding-lighter-red);
	--button-danger-default-bg-color-active: var(--color-critical-background);
	--button-danger-default-border-color-disabled: var(--color-critical-disabled);
	--button-danger-default-border-color: var(--color-critical-default);
	--button-link-color: var(--color-primary-default);
	--button-link-color-hover: var(--color-primary-hover);
	--button-link-color-active: var(--color-primary-pressed);
	--button-link-color-disabled: var(--color-primary-disabled);
	--button-danger-link-color: var(--color-critical-default);
	--button-danger-link-color-hover: var(--color-critical-hover);
	--button-danger-link-color-active: var(--color-critical-pressed);
	--button-danger-link-color-disabled: var(--color-critical-disabled);
	--button-font: var(--text-button);
	--button-icon-font-size: var(--font-size-base);
	--button-middle-icon-vertical-align: -0.21875em;
	--button-small-icon-vertical-align: -0.2em;
	--icon-button-large-size: 36px;
	--icon-button-middle-size: 28px;
	--icon-button-small-size: 24px;
	--icon-button-font-size: var(--font-size-base);
	--icon-button-rounded: var(--rounded);
	--icon-button-gray-color: var(--color-text-secondary);
	--icon-button-gray-bg-color: var(--color-basic-white);
	--icon-button-gray-color-hover: var(--color-text-primary);
	--icon-button-gray-color-active: var(--color-text-primary);
	--icon-button-gray-bg-color-hover: var(--color-secondary-hover);
	--icon-button-gray-bg-color-active: var(--color-secondary-pressed);
	--icon-button-gray-color-disabled: var(--color-text-disabled);
	--icon-button-gray-bg-color-disabled: var(--color-secondary-hover);
	--icon-button-black--color: var(--color-text-primary);
	--icon-button-black-bg-color: var(--color-basic-white);
	--icon-button-black-color-hover: var(--color-branding-primary-red);
	--icon-button-black-color-active: var(--color-branding-primary-red);
	--icon-button-black-bg-color-hover: var(--color-branding-lighter-red);
	--icon-button-black-bg-color-active: var(--color-branding-lighter-red);
	--icon-button-black-color-disabled: var(--color-critical-disabled);
	--icon-button-black-bg-color-disabled: var(--color-secondary-hover);
	--modal-mask-z-index: 1001;
	--modal-wrap-z-index: 1004;
	--modal-mask-bg-color: rgba(0, 0, 0, 0.45);
	--modal-content-max-h: 80vh;
	--modal-content-bg-color: var(--color-basic-white);
	--modal-content-shadow: 0px 0px 4px rgba(0, 0, 0, 0.1), 0px 8px 40px rgba(0, 0, 0, 0.2);
	--modal-content-rounded: var(--rounded);
	--modal-header-height: 57px;
	--modal-header-px: var(--space-5);
	--modal-header-py: var(--space-4);
	--modal-header-bg-color: var(--color-basic-white);
	--modal-header-border-color: var(--color-line-separator);
	--modal-title-color: var(--color-text-primary);
	--modal-title-font: var(--text-title-base);
	--modal-close-z-index: 10;
	--modal-close-top: var(--space-4);
	--modal-close-right: var(--space-4);
	--modal-body-px: var(--space-5);
	--modal-body-py: var(--space-5);
	--modal-body-font: var(--text-body);
	--modal-body-color: var(--color-text-secondary);
	--modal-footer-px: var(--space-5);
	--modal-footer-py: var(--space-4);
	--modal-footer-bg-color: var(--color-basic-white);
	--modal-footer-border-color: var(--color-line-separator);
	--modal-footer-btn-space: var(--space-3);
	--modal-loading-overlay-index: 100;
	--modal-loading-overlay-bg-color: rgba(255, 255, 255, 0.8);
	--modal-loading-icon-font-size: 48px;
	--message-top: 72px;
	--message-max-w: 460px;
	--message-z-index: 1046;
	--message-icon-text-space: var(--space-2);
	--message-bg-py: var(--space-3);
	--message-bg-px: var(--space-4);
	--message-bg-color: var(--color-basic-white);
	--message-rounded: var(--rounded);
	--message-box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.04), 0px 2px 10px rgba(0, 0, 0, 0.1);
	--message-success-color: var(--color-basic-success);
	--message-error-color: var(--color-basic-critical);
	--message-warning-color: var(--color-basic-warning);
	--message-info-color: var(--color-basic-info);
	--message-icon-font-size: var(--font-size-lg);
	--message-close-icon-space: var(--space-4);
	--message-content-text-align: left;
	--message-content-color: var(--color-text-secondary);
	--message-content-font: var(--text-body);
	--link-color: var(--color-primary-default);
	--link-color-hover: var(--color-primary-hover);
	--link-color-active: var(--color-primary-pressed);
	--link-text-decoration: none;
	--link-text-decoration-hover: underline;
	--link-outer-text-decoration: underline;
	--link-outer-text-decoration-hover: none;
	--tabs-font-size: var(--font-size-sm);
	--tabs-nav-border-color: var(--color-line-separator);
	--tabs-btn-ml: var(--space-8);
	--tabs-full-btn-ml: var(--space-2);
	--tabs-btn-py: var(--space-3);
	--tabs-btn-color: var(--color-text-secondary);
	--tabs-btn-color-hover: var(--color-text-primary);
	--tabs-btn-color-active: var(--color-text-primary);
	--tabs-btn-color-selected: var(--color-text-primary);
	--tabs-ink-bar-height: 3px;
	--tabs-ink-bar-color: transparent;
	--tabs-ink-bar-color-hover: var(--color-black-300);
	--tabs-ink-bar-color-active: var(--color-blue-100);
	--tabs-ink-bar-color-selected: var(--color-text-link);
	--tabs-full-px: 0;
	--tabs-px: var(--space-5);
	--radio-wrapper-mt: var(--space-3);
	--radio-wrapper-mr: var(--space-4);
	--radio-leading: var(--leading-sm);
	--radio-top: 1px;
	--radio-size: 18px;
	--radio-dot-size: 10px;
	--radio-dot-size-disabled: 8px;
	--radio-dot-bg-color: var(--color-primary-default);
	--radio-dot-bg-color-disabled: var(--color-basic-white);
	--radio-border-width: 2px;
	--radio-border-width-disabled: 5px;
	--radio-border-color: var(--color-black-400);
	--radio-border-color-disabled: var(--color-line-border);
	--radio-bg-color: var(--color-basic-white);
	--radio-bg-color-disabled: var(--color-basic-white);
	--radio-border-color-checked: var(--color-primary-default);
	--radio-text-px: var(--space-2);
	--radio-text-font: var(--text-body);
	--radio-text-color: var(--color-text-primary);
	--radio-text-color-disabled: var(--color-text-disabled);
	--checkbox-size: 18px;
	--check-leading: var(--leading-sm);
	--checkbox-wrapper-mt: var(--space-3);
	--checkbox-wrapper-mr: var(--space-4);
	--checkbox-top: 1px;
	--checkbox-bg-color: var(--color-basic-white);
	--checkbox-bg-color-checked: var(--color-primary-default);
	--checkbox-bg-color-indeterminate: var(--color-primary-default);
	--checkbox-bg-color-disabled: var(--color-black-300);
	--checkbox-rounded: var(--rounded);
	--checkbox-border-width: 2px;
	--checkbox-border-color: var(--color-black-400);
	--checkbox-border-color-hover: var(--color-black-500);
	--checkbox-border-color-checked: var(--color-primary-default);
	--checkbox-border-color-indeterminate: var(--color-primary-default);
	--checkbox-border-color-disabled: var(--color-black-300);
	--checkbox-text-px: var(--space-2);
	--checkbox-text-font: var(--text-body);
	--checkbox-text-color: var(--color-text-primary);
	--checkbox-text-color-disabled: var(--color-text-disabled);
	--checkbox-checked-width: 10px;
	--checkbox-checked-height: 8px;
	--checkbox-checked-background: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEwIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMy4zMTQ3NiA3Ljg1OEwwLjEzMjk1NCA0LjQ0MUMtMC4wNDQzMTggNC4yNTMgLTAuMDQ0MzE4IDMuOTQ3IDAuMTMyOTU0IDMuNzU3TDAuNzc1Njc4IDMuMDc0QzAuOTUyOTUgMi44ODYgMS4yNDExMyAyLjg4NiAxLjQxODQgMy4wNzRMMy42MzY1NyA1LjQ2Nkw4LjU4MTEgMC4xNDFDOC43NTgzNyAtMC4wNDcgOS4wNDY1NSAtMC4wNDcgOS4yMjM4MiAwLjE0MUw5Ljg2NjU1IDAuODI1QzEwLjA0MzggMS4wMTMgMTAuMDQzOCAxLjMyIDkuODY2NTUgMS41MDdMMy45NTc0OCA3Ljg1OEMzLjc4MDIxIDguMDQ2IDMuNDkyMDMgOC4wNDYgMy4zMTQ3NiA3Ljg1OFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=");
}`;
