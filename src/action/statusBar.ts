import { window } from "vscode";

export const copyItem = () => {
	const statusBar = window.createStatusBarItem(1, 2);
	statusBar.tooltip = "从剪切板中查找(⌘+V,⌘+V)";
	statusBar.command = "mathis.searchFromClipboard";
	statusBar.text = "查找";
	statusBar.show();
};
