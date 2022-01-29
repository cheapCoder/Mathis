import {
	commands,
	env,
	ExtensionContext,
	languages,
	Memento,
	Selection,
	TextEditorRevealType,
	window,
	workspace,
} from "vscode";
import { showLocaleHover } from "./hover";
import Manger from "./manger/index";
import nodeManger from "./manger/nodes";
import { dispatchDefParse } from "./parser/def";

export function activate(context: ExtensionContext) {
	console.log(context);
	console.log(Manger);

	init(context.workspaceState).then((res) => {});

	const activeLang = context.extension.packageJSON.activationEvents
		.filter((s: string) => s.startsWith("onLanguage"))
		.map((lang: string) => lang.replace("onLanguage:", ""));

	languages.registerHoverProvider(activeLang, showLocaleHover());

	// 跳转定义文件
	const disDefinition = commands.registerCommand("mathis.definition", async (args) => {
		console.log(args);
		const {
			fileUri,
			valueRange: [start, end],
		} = args;
		const defDocument = await workspace.openTextDocument(fileUri);
		const defEditor = await window.showTextDocument(defDocument);

		// Selection参数都是zero-based
		defEditor.selection = new Selection(
			start.line - 1,
			start.character - 1,
			end.line - 1,
			end.character - 1
		);
		defEditor.revealRange(defEditor.selection, TextEditorRevealType.InCenter);
		// commands.executeCommand("workbench.action.focusActiveEditorGroup");
	});

	// 复制
	const disCopy = commands.registerCommand("mathis.copy", (args) => {
		if (!args.value) {
			window.showInformationMessage("未找到值...", "确定");
			return;
		}
		env.clipboard.writeText(args.value).then(() => {
			window.showInformationMessage(`“${args.value}”  复制成功`);
		});
	});

	context.subscriptions.push(disDefinition, disCopy);
}

async function init(workspaceState: Memento) {
	// ts,js,json格式的多语言文件
	const uris = await workspace.findFiles(
		`**/locale/{en_US,zh_CN}.{ts,js,json}`,
		"**/node_modules/**"
	);

	dispatchDefParse(uris).then(() => {
		console.log(nodeManger);
	});
}

export function deactivate() {}
