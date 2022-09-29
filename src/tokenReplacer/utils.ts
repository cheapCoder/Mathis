import { MarkdownString } from "vscode";
import StyleToken from ".";
import pj from "../../package.json";
import { formatHoverAction } from "../action/hover";

export const recurFindMapVal = (key: string, map: StyleToken["nameMap"]): string | undefined => {
	return map.get(key)?.origin.replace(/var\((.*?)\)/g, (match, k, offset, str) => {
		return recurFindMapVal(k, map) || match;
	});
};

// test
// const map = new Map([
// 	["--notification-padding", { origin: "var(--notification-py) var(--notification-px)" }],
// 	["--notification-px", { origin: "var(--space-4)" }],
// 	["--notification-py", { origin: "var(--space-5)" }],
// 	["--space-5", { origin: "20px" }],
// ]);

// console.log(recurFindMapVal("--notification-padding", map));

export const getMdStr = (type: string, val: string) => {
	const ms = new MarkdownString(
		`${type}: ${val} ${formatHoverAction({
			icon: "explorer-view-icon",
			command: `${pj.name}.copy`,
			params: { value: val },
			alt: "复制",
		})}`,
		true
	);
	ms.isTrusted = true;

	return ms;
};
