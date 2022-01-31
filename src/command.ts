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
		console.log(args);

		const defDocument = await workspace.openTextDocument(defUri);
		const defEditor = await window.showTextDocument(defDocument);

		// Selection参数都是zero-based
		defEditor.selection = new Selection(
			start.line - 1,
			start.character - 1,
			end.line - 1,
			end.character
		);
		console.log(defEditor);

		defEditor.revealRange(defEditor.selection, TextEditorRevealType.InCenter);
	}
);

// 复制
export const disCopy = commands.registerCommand("mathis.copy", (args) => {
	if (!args.value) {
		window.showInformationMessage("未找到值...");
		return;
	}
	env.clipboard.writeText(args.value).then(() => {
		window.showInformationMessage(`“${args.value}”  复制成功`);
	});
});

// 跳转文件
export const disNav = commands.registerCommand("mathis.navigate", async (args) => {
	console.log(args);

	if (!args) {
		window.showInformationMessage("缺失参数");
		return;
	}

	const { range, path } = args;

	const document = await workspace.openTextDocument(path);
	const editor = await window.showTextDocument(document);

	editor.selection = new Selection(
		range[0].line,
		range[0].character,
		range[1].line,
		range[1].character
	);
	// editor.selection = new Selection(0, 0, 3, 3);
	editor.revealRange(editor.selection, TextEditorRevealType.InCenter);
});
