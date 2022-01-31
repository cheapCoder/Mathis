import { CancellationToken, Hover, MarkdownString, Position, TextDocument } from "vscode";
import manger from "./manger";
import { getRestrictValue } from "./match";

export const dispatchHover = () => ({
	provideHover(...args: [TextDocument, Position, CancellationToken]) {
		console.log(manger.activeFileType);

		return manger.activeFileType === "define"
			? showApplyHover(...args)
			: showDefHover(...args);
	},
});

const showDefHover = (document: TextDocument, position: Position, token) => {
	const curWord = getRestrictValue(
		document.getText(),
		document.offsetAt(position),
		/['"`]/
	);
	const matchWord = manger.keyMap[curWord];

	if (!matchWord) {
		return;
	}

	const markdownStrings = Object.keys(matchWord).map((lan) => {
		console.log(JSON.stringify(matchWord[lan]));

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
	const filename = document.fileName.split("/").pop().split(".");
	filename.pop();
	const lang = filename.join(".");

	if (!manger.supportLang.has(lang)) {
		// window.showErrorMessage("未找到此定义类型文件的语言类型");
		return;
	}

	const key = Object.keys(manger.keyMap).find((key) => {
		// if (key === "staff.credit_card_tips") {
		// 	console.log(manger.keyMap[key][lang]);
		// 	console.log(position);
		// }

		// TODO: 实现一个lru队列存储文件地址，优先查找最近使用的def文件，优化读取，获取前一个找到的文件，优先从此文件读取
		return (
			manger.keyMap[key][lang].defUri.fsPath === document.fileName &&
			((manger.keyMap[key][lang].keyRange.start.isBefore(position) &&
				manger.keyMap[key][lang].keyRange.end.isAfter(position)) ||
				(manger.keyMap[key][lang].valueRange.start.isBefore(position) &&
					manger.keyMap[key][lang].valueRange.end.isAfter(position)))
		);
	});
	// console.log("key: " + key);

	if (!key) {
		return;
	}

	// console.log(manger.applyMap[key]);

	const str = manger.applyMap[key].map((apply) => {
		const ms = new MarkdownString(
			`地址: [${apply.path.replace(/^.*src/, "")}#${
				apply.range.start.line + 1
			}](command:mathis.navigate?${encodeURIComponent(
				JSON.stringify(apply)
			)} "跳转链接")`,
			true
		);

		ms.appendCodeblock(apply.code, apply.languageId);
		ms.isTrusted = true;
		return ms;
	});

	return new Hover(str);
};
