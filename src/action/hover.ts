import { Hover, MarkdownString, Position, TextDocument, workspace } from "vscode";
import path from "path";
import config from "../config";
import manger from "../manger";
import { log } from "../util/log";
import pj from "../../package.json";

export const dispatchHover = () => ({
	provideHover(document: TextDocument, position: Position) {
		if (config.defList.has(document.fileName)) {
			return showApplyHover(document, position);
		} else if (config.applyList.has(document.fileName)) {
			return showDefHover(document, position);
		} else {
			log.appendLine(`hover 跳过：${document.fileName} 不在 define/apply 文件列表（apply 共 ${config.applyList.size} 个）`);
		}
	},
});

interface HoverCommand {
	icon: string;
	command: string;
	params: Record<string, any>;
	alt: string;
}

export const formatHoverAction = ({ icon, command, params, alt }: HoverCommand) =>
	`[$(${icon})](command:${command}?${encodeURIComponent(JSON.stringify(params))} "${alt}")`;

const showDefHover = (document: TextDocument, position: Position) => {
	const pos = document.getWordRangeAtPosition(position, /[$_a-z0-9A-Z\.]+/i);
	if (!pos) return;
	const curWord = document.getText(pos);
	// 命名空间写法下字面量只是 key 的一段，优先用已解析的应用节点拿完整 key
	const key = manger.getApplyNodeAt(document.uri.fsPath, position.translate(1, 1))?.key ?? curWord;

	let defList: any = manger.defMap.get(key);
	log.appendLine(
		`hover ${path.basename(document.fileName)}:${position.line + 1}:${position.character + 1} 词=${curWord} key=${key} 定义=${defList?.size ?? 0}`
	);
	let fromRemote = false;
	if (!defList || !defList.size) {
		defList = manger.remoteDefMap.get(key);
		if (!defList) return;
		fromRemote = true;
	}

	const markdownStrings: MarkdownString[] = [];
	if (key !== curWord) {
		markdownStrings.push(new MarkdownString(`\`${key}\``));
	}
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
		if (!fromRemote) {
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
			const path = config.pathSlice
				? apply.loc.uri.fsPath
						.replace(workspace.getWorkspaceFolder(apply.loc.uri)?.uri.fsPath || "", "")
						.replace(/^\/src/, "")
				: apply.loc.uri.fsPath;
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
