import { Hover, MarkdownString, Position, TextDocument, window } from "vscode";
import path from "path";
import config from "../config";
import manger from "../manger";
import { getRestrictValue } from "../util";
import pj from "../../package.json";

export const dispatchHover = () => ({
	provideHover(document: TextDocument, position: Position) {
		if (config.defList.has(document.fileName)) {
			return showApplyHover(document, position);
		} else if (config.applyList.has(document.fileName)) {
			return showDefHover(document, position);
		} else {
			// console.log("hover: 无法区分该文件未定义或应用文件");
		}
	},
});

const showDefHover = (document: TextDocument, position: Position) => {
	const curWord = getRestrictValue(
		document.lineAt(position.line).text,
		position.character,
		config.splitLetters
	);
	const defList = manger.defMap.get(curWord);

	if (!defList || defList.size === 0) {
		return;
	}

	const markdownStrings: MarkdownString[] = [];
	defList.forEach(node => {
		const ms = new MarkdownString(
			`${node.lang}: ${node.value} [$(keybindings-edit)](command:${
				pj.name
			}.navigateToDef?${encodeURIComponent(
				JSON.stringify(node)
			)} "更改文案")  [$(explorer-view-icon)](command:${pj.name}.copy?${encodeURIComponent(
				JSON.stringify({ value: node.value })
			)} "复制")`,
			true
		);
		ms.isTrusted = true;
		ms.supportHtml = true;

		markdownStrings.push(ms);
	});

	return new Hover(markdownStrings);
};

const showApplyHover = (document: TextDocument, position: Position) => {
	position = position.translate(1, 1);

	// 获取语言
	const lang = path.parse(document.fileName).name;

	if (!manger.supportLang.has(lang)) {
		console.log("未找到此定义类型文件的语言类型");
		return;
	}

	const key = manger.defFileBuckets.get(document.uri.fsPath)?.find(key => {
		const node = manger.defMap.get(key)?.get(document.uri.fsPath);
		return (
			(node?.keyRange.start.isBeforeOrEqual(position) && node?.keyRange.end.isAfterOrEqual(position)) ||
			(node?.valueRange.start.isBeforeOrEqual(position) && node?.valueRange.end.isAfterOrEqual(position))
		);
	});

	if (!key || !manger.applyMap.has(key)) {
		return;
	}

	return new Hover(
		(manger.applyMap.get(key) || []).map(apply => {
			const path = config.pathSlice ? apply.loc.uri.fsPath.replace(/^.*src/, "") : apply.loc.uri.fsPath;
			const ms = new MarkdownString(
				`地址: [${path}#${apply.loc.range.start.line}](command:${
					pj.name
				}.navigateToApply?${encodeURIComponent(JSON.stringify(apply))} "跳转链接")`,
				true
			);

			ms.appendCodeblock(apply.code, apply.languageId);
			ms.isTrusted = true;
			return ms;
		})
	);
};
