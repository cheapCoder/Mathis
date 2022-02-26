import path from "path";
import { CancellationToken, Hover, MarkdownString, Position, TextDocument } from "vscode";
import config from "../config";
import manger from "../manger";
import { getRestrictValue } from "../util";

export const dispatchHover = () => ({
	provideHover(...args: [TextDocument, Position, CancellationToken]) {
		return manger.activeFileType === "define"
			? showApplyHover(...args)
			: showDefHover(...args);
	},
});

const showDefHover = (document: TextDocument, position: Position, token) => {
	const curWord = getRestrictValue(
		document.lineAt(position.line).text,
		position.character,
		config.splitLetters
	);
	const matchWord = manger.defMap[curWord];

	if (!matchWord) {
		return;
	}

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

	return new Hover(markdownStrings);
};

const showApplyHover = (document: TextDocument, position: Position, token) => {
	// TODO: 提供可关闭hover显示的配置
	position = position.translate(1, 1);

	// 获取语言
	const lang = path.parse(document.fileName).name;

	if (!manger.supportLang.has(lang)) {
		// window.showErrorMessage("未找到此定义类型文件的语言类型");
		return;
	}
	new Map().values;

	const key = manger.defMap[document.uri.fsPath].values()find((node) => {
		// TODO: 实现一个lru队列存储文件地址，优先查找最近使用的def文件，优化读取，获取前一个找到的文件，优先从此文件读取
		return (
			node?.defUri.fsPath === document.fileName &&
			((manger.defMap[key]?.keyRange.start.isBeforeOrEqual(position) &&
				manger.defMap[key]?.keyRange.end.isAfterOrEqual(position)) ||
				(manger.defMap[key]?.valueRange.start.isBeforeOrEqual(position) &&
					manger.defMap[key]?.valueRange.end.isAfterOrEqual(position)))
		);
	});

	if (!key) {
		return;
	}

	// const str = manger.applyMap[key].map((apply) => {
	// 	const ms = new MarkdownString(
	// 		`地址: [${apply.location.uri.fsPath.replace(/^.*src/, "")}#${
	// 			apply.location.range.start.line + 1
	// 		}](command:mathis.navigate?${encodeURIComponent(
	// 			JSON.stringify(apply)
	// 		)} "跳转链接")`,
	// 		true
	// 	);

	// 	ms.appendCodeblock(apply.code, apply.languageId);
	// 	ms.isTrusted = true;
	// 	return ms;
	// });

	return new Hover("str");
};
