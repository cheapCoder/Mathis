import { commands, env, Selection, Uri, window } from "vscode";

// 跳转定义文件
export const disDefinition = commands.registerCommand("mathis.definition", (args) => {
	const {
		defUri,
		valueRange: [start, end],
	} = args;
	console.log(args);

	window.showTextDocument(defUri, {
		// Selection参数都是zero-based
		selection: new Selection(
			start.line - 1,
			start.character - 1,
			end.line - 1,
			end.character // 不用-1是因为要选到字符串右边引号的位置
		),
	});
});

// 复制
export const disCopy = commands.registerCommand(
	"mathis.copy",
	({ value }: { value: string }) => {
		if (!value) {
			window.showInformationMessage("未找到值...");
			return;
		}
		env.clipboard.writeText(value).then(() => {
			window.showInformationMessage(`“${value}”  复制成功`);
		});
	}
);

// 跳转文件
export const disNav = commands.registerCommand("mathis.navigate", (args) => {
	console.log(args);

	if (!args) {
		window.showInformationMessage("缺失参数");
		return;
	}
	const {
		location: { range, uri },
	} = args;

	window.showTextDocument(uri, {
		selection: new Selection(
			range[0].line - 1,
			range[0].character - 1,
			range[1].line - 1,
			range[1].character
		),
	});
});
