import { ExtensionContext, languages, window } from "vscode";
import * as commands from "./action/command";
import { dispatchHover } from "./action/hover";
import config from "./config";
import manger from "./manger";

export function activate(context: ExtensionContext) {
	console.time("mathis");
	manger.context = context;

	languages.registerHoverProvider(config.activeFileLanguage, dispatchHover());

	const statusBar = window.createStatusBarItem(1, 2);
	statusBar.tooltip = "从剪切板中查看key或value, 也可用使用快捷键⌘+V,⌘+V";


	context.subscriptions.push(...Object.keys(commands).map((name) => commands[name]));
}

export function deactivate() {}
