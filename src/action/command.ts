import { commands, env, Range, Selection, window } from "vscode";
import config from "../config";
import manger from "../manger";

// 跳转定义文件
export const disDefinition = commands.registerCommand("mathis.navigateToDef", (args) => {
	let { defUri, valueRange, keyRange } = args;

	if (!valueRange.start) {
		valueRange = new Range(valueRange[0], valueRange[1]);
		keyRange = new Range(keyRange[0], keyRange[1]);
	}

	const start = "value" === config.defSelect ? valueRange.start : keyRange.start;
	const end = "key" === config.defSelect ? keyRange.end : valueRange.end;

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
export const disCopy = commands.registerCommand("mathis.copy", ({ value }: { value: string }) => {
	if (!value) {
		window.showInformationMessage("未找到值...");
		return;
	}
	env.clipboard.writeText(value).then(() => {
		window.showInformationMessage(`“${value}”  复制成功`);
	});
});

// 跳转应用文件
export const disNav = commands.registerCommand("mathis.navigateToApply", (args) => {
	if (!args) {
		window.showInformationMessage("缺失参数");
		return;
	}
	const { range, uri } = args.loc;

	window.showTextDocument(uri, {
		selection: new Selection(
			range[0].line - 1,
			range[0].character - 1,
			range[1].line - 1,
			range[1].character
		),
	});
});

// 从剪切板中的值查找
export const disSearch = commands.registerCommand("mathis.searchFromClipboard", async () => {
	const val = await env.clipboard.readText();

	if (!val) {
		window.showErrorMessage("剪切板未发现值");
	}

	let res: DefNode[] = [];
	if (manger.defMap.has(val)) {
		//@ts-ignore
		res = Array.from(manger.defMap.get(val)).map((entries) => entries[1]);
	} else {
		manger.defMap.forEach((langMap) => {
			langMap.forEach((node) => {
				if (node.value?.includes(val)) {
					res.push(node);
				}
			});
		});
	}
	if (res.length === 0) {
		window.showInformationMessage(`未查找到'${val}'`);
		return;
	}
	const msg = res.reduce(
		(str, cur) => `${str}${cur.key}: ${cur.value} || [前往](${cur.defUri.fsPath}) \n`,
		""
	);
	window
		.showQuickPick(
			res.map((node) => ({
				label: node.key,
				description: node.value,
				detail: node.defUri.fsPath,
				node,
			}))
		)
		.then((item) => {
			commands.executeCommand("mathis.navigateToDef", item?.node);
		});
});

// 过滤出语言定义有缺的字段
// 	Object.keys(this.applyMap).forEach((key) => {
// 		if (!this.keyMap[key]) {
// 			console.log(key);
// 		}
// 	});
// 	console.log("-----------");
// 	Object.keys(this.keyMap).forEach((key) => {
// 		if (!this.applyMap[key]) {
// 			console.log(key);
// 		}
// 	});
// 	console.log(Object.keys(this.applyMap).length);
// 	console.log(Object.keys(this.keyMap).length);
