import { commands, env, MarkdownString, Selection, Uri, window } from "vscode";
import manger from "../manger";

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

export const disSearch = commands.registerCommand(
	"mathis.searchFromClipboard",
	async () => {
		const val = await env.clipboard.readText();

		if (!val) {
			window.showErrorMessage("未发现查找值");
		}

		if (manger.keyMap[val]) {
			const matchWord = manger.keyMap[val];
			const markdownStrings = Object.keys(matchWord).map((lan) => {
				const ms = new MarkdownString(
					`${lan}: ${
						matchWord[lan].value
					} [$(keybindings-edit)](command:mathis.definition?${encodeURIComponent(
						JSON.stringify(matchWord[lan])
					)} "更改文案")  [$(explorer-view-icon)](command:mathis.copy?${encodeURIComponent(
						JSON.stringify({
							value: matchWord[lan].value,
						})
					)} "复制")`,
					true
				);

				ms.isTrusted = true;
				ms.supportHtml = true;

				return ms;
			});
			// TODO:markdownStrings？
			window.showInformationMessage(`查找到key: ${val}\n值: ${markdownStrings}`);
		}
	}
);
