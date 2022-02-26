import { ExtensionContext, languages, Position, window } from "vscode";
import * as commands from "./action/command";
import { dispatchHover } from "./action/hover";
import * as barItems from "./action/statusBar";
import manger from "./manger";
import config from "./config";

export function activate(context: ExtensionContext) {
	manger.init(context);

	languages.registerHoverProvider(config.activeFileLanguage, dispatchHover());

	// StatusBarItem
	Object.values(barItems).forEach((fn) => fn());
	// Commands
	context.subscriptions.push(...Object.keys(commands).map((name) => commands[name]));
}

export function deactivate() {}
