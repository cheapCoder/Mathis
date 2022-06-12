import { window } from "vscode";
import pj from "../../package.json";

export const copyItem = () => {
	const statusBar = window.createStatusBarItem(1, 2);
	statusBar.tooltip = "从剪切板中查找(⌘+shift+V)";
	statusBar.command = `${pj.name}.searchFromClipboard`;
	statusBar.text = "查找";
	statusBar.show();
};
