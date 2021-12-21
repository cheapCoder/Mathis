import { readFile as rf } from "fs";
import { Hover, MarkdownString, Memento, workspace } from "vscode";

import { promisify } from "util";
import { parse } from "@babel/parser";

const readFile = promisify(rf);

export async function loadWord(workspaceState: Memento) {
	const allLocaleFiles = await workspace.findFiles(
		`**/locale/{en_US,zh_CN}.*`,
		"**/node_modules/**"
	);
	const filesContents = await Promise.all(
		allLocaleFiles.map((file) => readFile(file.fsPath, { encoding: "utf-8" }))
	);

	let contentsObj = filesContents.map((fileContent, i) => ({
		path: allLocaleFiles[i].fsPath,
		content: fileContent,
	}));

	let locales = contentsObj.reduce((locales, { content, path }) => {
		const contentAst = parse(content, {
			sourceType: "module",
			plugins: ["typescript"],
		});

		contentAst.program.body[0]["declaration"].properties.forEach((node) => {
			if (node.type !== "ObjectProperty") {
				return locales;
			}

			locales[node.key.value] || (locales[node.key.value] = []);

			locales[node.key.value].push({
				value: node.value.value,
				path,
				locations: {
					key: { start: node.key.loc.start, end: node.key.loc.end },
					value: { start: node.value.loc.start, end: node.value.loc.end },
				},
			});
		});

		return locales;
	}, {});

	workspaceState.update("allLocales", locales);
}

export function renderHover(allLocales: LocaleConfig[]): Hover {
	const markdownStrings = allLocales.map((locale) => {
		const ms = new MarkdownString(
			`[${locale.value}](${locale.path}#${locale.locations.key.start.line})  [$(explorer-view-icon)](command:mathis.copyValue)`,
			true
		);

		ms.isTrusted = true;
		ms.supportHtml = true;

		return ms;
	});

	return new Hover(markdownStrings);
}

export function getRestrictValue(str: string, expandIndex: number, restricts: string[]) {
	if (expandIndex < 0 || expandIndex >= str.length) {
		return "";
	}
	let start: number = expandIndex;
	let end: number = expandIndex;

	// 若start到0还没检测到限制符，则为0，所以不用等于0
	while (start > 0) {
		if (restricts.includes(str[start])) {
			break;
		} else {
			start--;
		}
	}
	// end同理
	while (end < str.length - 1) {
		if (restricts.includes(str[end])) {
			break;
		} else {
			end++;
		}
	}

	// 去除限制符
	return str.substring(start + 1, end); // substring不包含结束值
}
