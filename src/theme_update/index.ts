import https from "https";
import { URL } from "url";
import {
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
	languages,
	Location,
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
	public static readonly SHOPLAZZA_TEAM = "Shoplazza FE";
	public curColorLink = "";
	public colorReg = /#([\da-f]{8}|[\da-f]{6}|[\da-f]{3})(?=[;\s])/gi;
	public cssMap = new Map<string, string[]>();
	public diagnosticsCollection = languages.createDiagnosticCollection("Shoplazza FE");

	constructor(context: ExtensionContext) {
		// 创建code action provider
		const themeActionDis = languages.registerCodeActionsProvider("*", this.colorProvider, {
			providedCodeActionKinds: this.colorProvider.providedCodeActionKinds,
		});

		// 添加命令
		const colorRefDis = commands.registerCommand("mathis.colorRef", async () => {
			if (this.cssMap.size === 0 || this.curColorLink !== config.themeUpdateLink) {
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

		context.subscriptions.push(
			themeActionDis,
			colorRefDis,
			replaceColorDis,
			ignoreColorDis,
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
		const document = await workspace.openTextDocument(file);
		const diaList: Diagnostic[] = [];
		let regRes;
		for (let line = 0; line < document.lineCount; line++) {
			const text = document.lineAt(line).text;
			const reg = new RegExp(this.colorReg.source, "gi");

			while ((regRes = reg.exec(text))) {
				const color = this.formatColor(regRes[0]);
				if (workspace.getConfiguration(config.projectName).themeUpdateIgnoreColors?.includes(color)) {
					continue;
				}
				const range = new Range(line, regRes.index, line, regRes.index + regRes[0].length);
				const arr = this.cssMap.get(color);

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
		// let text = (await workspace.fs.readFile(file)).toString();

		// let delta = 0;
		// text = text.replaceAll(this.colorReg, (...args) => {
		// 	// match, val, offset, string
		// 	// 格式化颜色
		// 	args[1] = this.formatColor(args[1]);
		// 	if (cssMap.has(args[1])) {
		// 		// console.log(args);

		// 		const arr = cssMap.get(args[1]);
		// 		if (arr?.length === 1) {
		// 			// 只有一个直接替换
		// 			const str = `var(${arr[0]})${args[3]}`;

		// 			delta += str.length - args[0].length;
		// 			return str;
		// 		} else {
		// 			// 大于1个生成诊断action
		// 			let offset = args[4] + delta;
		// 		}
		// 	}
		// 	return args[0];
		// });
		// workspace.fs.writeFile(file, Buffer.from(text, "utf8"));
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
		let text = "";
		try {
			text = await this.getText(link);
		} catch (e) {
			console.log(e);
			window.showErrorMessage("css链接无法解析");
		}
		text = text.replace(/\n/g, "");

		let reg = /(.*?)\{([\w\W]*?)\}/g;
		let cur;
		while ((cur = reg.exec(text))) {
			cur[2].split(";").forEach((line, i, array) => {
				//最后一个是""
				if (array.length - 1 === i) {
					return;
				}
				let item = line.split(":").map((v) => v.trim());

				if (this.colorReg.test(item[1] + ";")) {
					item[1] = this.formatColor(item[1]);
				}
				if (!this.cssMap.has(item[1])) {
					this.cssMap.set(item[1], []);
				}
				this.cssMap.get(item[1])?.push(item[0]);
			});
		}
	}
}

export default ThemeUpdater;
