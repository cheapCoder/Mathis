import * as vscode from "vscode";
import { loadWord, renderHover, getRestrictValue } from "./util";

// TODO: hover支持复制 vscode.env.clipboard
export function activate(context: vscode.ExtensionContext) {
	loadWord(context.workspaceState).then((res) => {
		console.log(context.workspaceState.get("allLocales"));
	});

	const disposeRefresh = vscode.commands.registerCommand(
		"mathis.refresh",
		loadWord.bind(this, context.workspaceState)
	);

	vscode.languages.registerHoverProvider(
		["javascript", "typescript", "javascriptreact", "typescriptreact"],
		{
			provideHover(document, position, token) {
				const curWord = getRestrictValue(document.getText(), document.offsetAt(position), [
					"'",
					'"',
				]);

				const matchWord = context.workspaceState.get("allLocales")[curWord];
				if (!matchWord) {
					return;
				}

				return renderHover(matchWord);
			},
		}
	);

	context.subscriptions.push(disposeRefresh);
}

export function deactivate() {}
