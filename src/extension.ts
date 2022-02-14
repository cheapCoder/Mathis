import { ExtensionContext, languages } from "vscode";
import * as commands from "./action/command";
import { dispatchHover } from "./action/hover";
import config from "./config";
import manger from "./manger";

export function activate(context: ExtensionContext) {
	manger.context = context;

	languages.registerHoverProvider(config.activeFileLanguage, dispatchHover());

	context.subscriptions.push(...Object.keys(commands).map((name) => commands[name]));
}

export function deactivate() {}
