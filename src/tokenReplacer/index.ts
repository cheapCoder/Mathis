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

	public async parseSource(text: string): Promise<void> {
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
