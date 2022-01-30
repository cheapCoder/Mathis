import {
	commands,
	env,
	Selection,
	TextEditorRevealType,
	window,
	workspace,
} from "vscode";

// 跳转定义文件
export const disDefinition = commands.registerCommand(
	"mathis.definition",
	async (args) => {
		const {
			defUri,
			valueRange: [start, end],
		} = args;
		const defDocument = await workspace.openTextDocument(defUri);
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
	}
);

// 复制
export const disCopy = commands.registerCommand("mathis.copy", (args) => {
	args = {};
	if (!args.value) {
		window.showInformationMessage("未找到值...", "确定");
		return;
	}
	env.clipboard.writeText(args.value).then(() => {
		window.showInformationMessage(`“${args.value}”  复制成功`);
	});
});

// 跳转文件
export const disNav = commands.registerCommand("mathis.navigate", async (args) => {
	if (!args) {
		window.showInformationMessage("缺失参数");
		return;
	}

	const document = await workspace.openTextDocument(args.path);
	// const start = document.positionAt(args.offset);
	const editor = await window.showTextDocument(document);

	// editor.selection = new Selection(start, start.translate(0, args.key.length));
	editor.selection = new Selection(0, 0, 3, 3);
	editor.revealRange(editor.selection, TextEditorRevealType.InCenter);
});
