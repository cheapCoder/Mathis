import { ExtensionContext, languages } from "vscode";
import * as commands from "./command";
import { dispatchHover } from "./hover";
import "./manger";

export function activate(context: ExtensionContext) {
	console.log(context);

	const activeLang = context.extension.packageJSON.activationEvents
		.filter((s: string) => s.startsWith("onLanguage"))
		.map((lang: string) => lang.replace("onLanguage:", ""));

	languages.registerHoverProvider(activeLang, dispatchHover());

	context.subscriptions.push(...Object.keys(commands).map((name) => commands[name]));
}

export function deactivate() {}
