import https from "https";
import { URL } from "url";
import {
	CancellationToken,
	CodeAction,
	CodeActionContext,
	CodeActionKind,
	commands,
	ConfigurationTarget,
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
import config from "../config";

class ThemeUpdater {
	public static readonly SHOPLAZZA_TEAM = "SHOPLAZZA FE";
	public curColorLink = "";
	public colorReg = /#([\da-f]{8}|[\da-f]{6}|[\da-f]{3})(?=[;\s])/gi;
	public valueMap = new Map<string, string[]>();
	public nameMap = new Map<string, string>();
	public diagnosticsCollection = languages.createDiagnosticCollection("Shoplazza FE");

	constructor(context: ExtensionContext) {
		const self = this;

		this.parse(config.themeUpdateLink);
		// 创建code action provider
		const themeActionDis = languages.registerCodeActionsProvider("*", this.colorProvider, {
			providedCodeActionKinds: this.colorProvider.providedCodeActionKinds,
		});

		// 添加命令
		const colorRefDis = commands.registerCommand("mathis.colorRef", async () => {
			if (this.valueMap.size === 0 || this.curColorLink !== config.themeUpdateLink) {
				if (!config.themeUpdateLink) {
					window.showErrorMessage("未找到css链接设置");
					return;
				}

				await this.parse(config.themeUpdateLink);
				this.curColorLink = config.themeUpdateLink;
			}

			const files = await workspace.findFiles(config.themeUpdateIncludeGlob, config.themeUpdateExcludeGlob);
			// {ts,js,tsx,jsx,svelte,html,css,scss,sass,less}
			let edits = new WorkspaceEdit();
			this.diagnosticsCollection.clear();
			await Promise.all(files.map((file) => this.updateFile(file, edits)));
			edits.size > 0 && workspace.applyEdit(edits);
		});

		// ignore color command
		const ignoreColorDis = commands.registerCommand("mathis.ignoreColor", async (color: string) => {
			const conf = workspace.getConfiguration(config.projectName);

			if (conf["themeUpdateIgnoreColors"]?.includes(color)) {
				return;
			}
			await conf.update(
				"themeUpdateIgnoreColors",
				[...conf["themeUpdateIgnoreColors"], color],
				ConfigurationTarget.Global
			);
			commands.executeCommand("mathis.colorRef");
		});

		// replace color command
		const replaceColorDis = commands.registerCommand(
			"mathis.replaceColor",
			async (file: Uri, diag: Diagnostic, val: string) => {
				const edit = new WorkspaceEdit();
				edit.replace(file, diag.range, val);
				workspace.applyEdit(edit);
				this.diagnosticsCollection.set(
					file,
					this.diagnosticsCollection.get(file)?.filter((d) => !diag.range.isEqual(d.range))
				);
			}
		);

		//css var hover show value
		const colorValDis = languages.registerHoverProvider("*", {
			provideHover(document: TextDocument, position: Position, token: CancellationToken) {
				const lineText = document.lineAt(position.line).text;
				let reg = /var\((.*?)\)/gi;
				let cur;
				while ((cur = reg.exec(lineText))) {
					const value = self.nameMap.get(cur[1]);

					if (value && position.character >= cur.index && position.character < cur.index + cur[0].length) {
						const ms = new MarkdownString(
							`rgb: ${value} [$(explorer-view-icon)](command:mathis.copy?${encodeURIComponent(
								JSON.stringify({ value })
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
			themeActionDis,
			colorRefDis,
			replaceColorDis,
			ignoreColorDis,
			colorValDis,
			this.diagnosticsCollection
		);
	}

	private colorProvider = {
		providedCodeActionKinds: [CodeActionKind.QuickFix],

		provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext) {
			if (context.diagnostics.length !== 1) {
				return;
			}
			const diag = context.diagnostics[0];

			// @ts-ignore
			const res: CodeAction[] = diag["replaceList"].map((val: string) => {
				const action = new CodeAction(`替换为:${val}`, CodeActionKind.QuickFix);
				action.command = {
					command: "mathis.replaceColor",
					title: "替换颜色",
					arguments: [document.uri, diag, `var(${val})`],
				};
				action.diagnostics = [diag];
				// action.isPreferred = true;
				return action;
			});

			// TODO: 添加ignore css
			const ignoreAction = new CodeAction("全局忽略这种颜色", CodeActionKind.QuickFix);
			ignoreAction.command = {
				command: "mathis.ignoreColor",
				title: "ignore color",
				arguments: [diag.relatedInformation![0].message],
			};
			// @ts-ignore
			ignoreAction["replaceList"] = [];
			res.push(ignoreAction);
			return res;
		},
	};

	private async updateFile(file: Uri, edits?: WorkspaceEdit) {
		let passEdits: boolean = true;
		if (!edits) {
			passEdits = false;
			edits = new WorkspaceEdit();
		}
		let document;
		try {
			document = await workspace.openTextDocument(file);
		} catch (e) {
			console.log(e);
			return;
		}
		const diaList: Diagnostic[] = [];
		let regRes;
		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text.toLowerCase();
			const reg = new RegExp(this.colorReg.source, "gi");

			while ((regRes = reg.exec(text))) {
				const color = this.formatColor(regRes[0]);
				if (workspace.getConfiguration(config.projectName).themeUpdateIgnoreColors?.includes(color)) {
					continue;
				}
				const range = new Range(line, regRes.index, line, regRes.index + regRes[0].length);
				const arr = this.valueMap.get(color);

				if (arr && arr.length === 1) {
					// 只有一个直接替换
					edits.replace(file, range, `var(${arr[0]})`);
				} else {
					// 大于1个或不存在，则生成code action
					const diag = new Diagnostic(
						range,
						"请引用design token设置颜色",
						DiagnosticSeverity[arr?.length ? "Information" : "Warning"]
					);
					diag.relatedInformation = [new DiagnosticRelatedInformation(new Location(file, range), color)];
					// diag.code = { value: color, target: file };
					diag.source = ThemeUpdater.SHOPLAZZA_TEAM;

					// @ts-ignore
					diag.replaceList = [...(arr || [])];
					arr?.length || (diag.tags = [DiagnosticTag.Deprecated]);

					diaList.push(diag);
				}
			}
		}
		diaList.length && this.diagnosticsCollection.set(file, diaList);

		if (!passEdits) {
			workspace.applyEdit(edits);
		}
	}

	private formatColor(val: string) {
		if (val.length === 9) {
			// rgba => rgb
			val = val.slice(0, -2);
		} else if (val.length === 4) {
			// fff=>ffffff
			val = "#" + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
		}
		return val;
	}

	private async getText(link: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const url = new URL(link);

			const options = {
				hostname: url.hostname,
				port: url.port,
				path: url.pathname,
				method: "GET",
			};

			const req = https.request(options, (res) => {
				let text = "";
				res.on("data", (d) => {
					text += d;
				});
				res.on("end", () => {
					resolve(text);
				});
				res.on("error", (e) => {
					reject(e);
				});
			});
			req.on("error", (error) => {
				reject(error);
			});
			req.end();
		});
	}

	private async parse(link: string): Promise<void> {
		this.nameMap.clear();
		this.valueMap.clear();

		let text = "";
		try {
			text = await this.getText(link);
		} catch (e) {
			console.log(e);
			window.showErrorMessage("css链接无法解析");
		}
		text = text.replace(/\n/g, "");

		// let repeatNameList = new Set();
		let reg = /(.*?)\{([\w\W]*?)\}/g;
		let cur;
		while ((cur = reg.exec(text))) {
			cur[2].split(";").forEach((line, i, array) => {
				//最后一个是""
				if (array.length - 1 === i) {
					return;
				}
				let item = line.split(":").map((v) => v.trim().toLowerCase());
				// if (this.nameMap.has(item[0])) {
				// 	repeatNameList.add(item[0]);
				// }
				// 添加name-value
				this.nameMap.set(item[0], item[1]);

				// 添加value - name[]
				if (this.colorReg.test(item[1] + ";")) {
					item[1] = this.formatColor(item[1]);
				}
				if (!this.valueMap.has(item[1])) {
					this.valueMap.set(item[1], []);
				}
				this.valueMap.get(item[1])?.push(item[0]);
			});
		}
	}
}

export default ThemeUpdater;
