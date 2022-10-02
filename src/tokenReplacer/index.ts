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
import { getMdStr, recurFindMapVal } from "./utils";

class StyleToken {
	public static readonly SOURCE = "STYLE TOKEN";
	public static readonly SUPPORT_LANG = ["less", "scss", "sass", "css"];
	public curColorLink = "";
	public colorReg = /#([\da-f]{8}|[\da-f]{6}|[\da-f]{3})(?=[;\s])/gi;
	public valueMap = new Map<string, string[]>();
	public nameMap = new Map<string, { final: string; origin: string }>();
	public diagCollection = languages.createDiagnosticCollection(StyleToken.SOURCE);

	constructor(context: ExtensionContext) {
		const self = this;

		// replace all design token
		const replaceAllTokenDis = commands.registerCommand(`${pj.name}.replaceAllToken`, async () => {
			const config = workspace.getConfiguration(pj.name);

			if (self.valueMap.size === 0 || self.curColorLink !== config.tokenLink) {
				const sourceText = await self.reqTokensFile();

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
					const val = self.nameMap.get(cur[1]);

					if (val && position.character >= cur.index && position.character < cur.index + cur[0].length) {
						const mdList = [getMdStr("final", val.final)];
						if (val.final !== val.origin) {
							mdList.push(getMdStr("origin", val.origin));
						}

						return new Hover(mdList);
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
				const action = new CodeAction(`${val}`, CodeActionKind.QuickFix);
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

				const valueNode = n.content.find((subNode: any) => subNode.type === "value");

				if (!valueNode) return;

				// 根据空格分组
				const valueGroup: any[][] = [[]];

				valueNode.content.forEach((subNode: any) => {
					if (subNode.type !== "space") {
						valueGroup.at(-1)!.push(subNode);
					} else {
						valueGroup.push([]);
					}
				});

				valueGroup.forEach(subs => {
					if (!subs.length) return;
					let val = subs.reduce((cur, sub) => cur + sub, "");
					const usage = this.valueMap.get(val) || [];
					usage.length &&
						res.push({
							key,
							val,
							usage,
							valoc: new Location(
								uri,
								new Range(
									subs[0].start.line - 1,
									subs[0].start.column - 1,
									subs.at(-1).end.line - 1,
									subs.at(-1).end.column
								)
							),
						});
				});
			});
		} catch (error) {
			// console.log(error);
		} finally {
			return res;
		}
	}

	public formatColor(val: string) {
		if (!this.colorReg.test(val)) return val;
		if (val.length === 9) {
			// rgba => rgb
			val = val.slice(0, -2);
		} else if (val.length === 4) {
			// fff=>ffffff
			val = "#" + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
		}
		return val;
	}

	public async reqTokensFile(link = workspace.getConfiguration(pj.name).tokenLink): Promise<string> {
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
				res.on("error", reject);
			});
			req.on("error", reject);
			req.end();
		}).catch(() => {
			window.showErrorMessage("token链接解析出现错误");
			return "";
		});
	}

	public async parseSource(text: string): Promise<void> {
		this.nameMap.clear();
		this.valueMap.clear();

		const tree = gonzales.parse(text, { syntax: "css" });

		// 只取第一个body的值，忽略组件的变量
		tree.content[0].traverseByTypes(["declaration"], (n: any) => {
			this.nameMap.set(n.content[0].toString(), { origin: n.content[2].toString(), final: "" });

			// // 格式化颜色
			// if (this.colorReg.test(item[1] + ";")) {
			// 	item[1] = this.formatColor(item[1]);
			// }
		});

		// recursive find `var()` value to final val
		this.nameMap.forEach((val, key) => {
			val.final = recurFindMapVal(key, this.nameMap) || val.origin;

			// 添加value - name[]
			if (!this.valueMap.has(val.final)) {
				this.valueMap.set(val.final, []);
			}
			this.valueMap.get(val.final)?.push(key);
		});
	}
}

export default StyleToken;
