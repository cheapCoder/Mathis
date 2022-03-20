import { ExtensionContext, languages } from "vscode";
import * as commands from "./action/command";
import { dispatchHover } from "./action/hover";
import * as barItems from "./action/statusBar";
import config from "./config";
import manger from "./manger";
import ThemeUpdater from "./theme_update";

export function activate(context: ExtensionContext) {
	const themeUpdater = new ThemeUpdater(context);

	manger.init(context);
	const hoverDis = languages.registerHoverProvider(config.activeFileLanguage, dispatchHover());

	// StatusBarItem
	Object.values(barItems).forEach((fn) => fn());
	// @ts-ignore Commands
	context.subscriptions.push(hoverDis, ...Object.keys(commands).map((name) => commands[name]));
}

export function deactivate() {}
