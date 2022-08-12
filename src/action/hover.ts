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

interface HoverCommand {
	icon: string;
	command: string;
	params: Record<string, any>;
	alt: string;
}

const formatHoverAction = ({ icon, command, params, alt }: HoverCommand) =>
	`[$(${icon})](command:${command}?${encodeURIComponent(JSON.stringify(params))} "${alt}")`;

const showDefHover = (document: TextDocument, position: Position) => {
	const curWord = getRestrictValue(
		document.lineAt(position.line).text,
		position.character,
		config.splitLetters
	);

	// TODO:
	let defList: any = manger.defMap.get(curWord);

	if (!defList || !defList.size) {
		defList = manger.remoteDefMap.get(curWord);
		if (!defList) return;
	}

	const markdownStrings: MarkdownString[] = [];
	defList.forEach((node: any) => {
		const hoverCommands: Record<string, HoverCommand> = {
			update: {
				icon: "keybindings-edit",
				command: `${pj.name}.navigateToDef`,
				params: node,
				alt: "更改文案",
			},
			copy: {
				icon: "explorer-view-icon",
				command: `${pj.name}.copy`,
				params: { value: node.value },
				alt: "复制",
			},
		};

		let str = `${node.lang}: ${node.value}`;
		if (!defList || !defList.size) {
			str += " " + formatHoverAction(hoverCommands.update);
		}
		str += " " + formatHoverAction(hoverCommands.copy);

		const ms = new MarkdownString(str, true);
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
