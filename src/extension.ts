import { ExtensionContext, languages } from "vscode";
import * as commands from "./action/command";
import { keyCompletion } from "./action/completion";
import { dispatchHover } from "./action/hover";
import config from "./config";
import manger from "./manger";
import TokenReplacer from "./tokenReplacer";

export function activate(context: ExtensionContext) {
	config.init().then(() => {
		if (config.useTokenReplace) {
			new TokenReplacer(context);
		}

		manger.init(context);
	});
	const hoverDis = languages.registerHoverProvider(config.activeFileLanguage, dispatchHover());

	// StatusBarItem
	// Object.values(barItems).forEach(fn => fn());
	// @ts-ignore Commands
	context.subscriptions.push(hoverDis, ...Object.keys(commands).map(name => commands[name]));

	if (config.useCompletion) {
		// autocomplete
		context.subscriptions.push(keyCompletion());
	}
}

export function deactivate() {}
