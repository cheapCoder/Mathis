import * as vscode from "vscode";
import { readFile as rf } from "fs";
import { promisify } from "util";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

const readFile = promisify(rf);

async function getWord() {
	const allLocaleFiles = await vscode.workspace.findFiles(
		`**/locale/{en_US,zh_CN}.*`,
		"**/node_modules/**"
	);
	console.log(allLocaleFiles);
	const filesContents = await Promise.all(
		allLocaleFiles.map((file) => readFile(file.fsPath, { encoding: "utf-8" }))
	);

	let contentsObj = filesContents.map((fileContent, i) => ({
		path: allLocaleFiles[i].fsPath,
		content: fileContent,
	}));
	const ast = parser.parse(contentsObj[0].content, {
		sourceType: "module",
		// plugins: ["typescript"],
	});

	traverse(ast, {
		enter(path) {
			console.log(path);

			if (path.isIdentifier({ name: "n" })) {
				path.node.name = "x";
			}
		},
	});

	// TODO: 太难懂
	let locales = contentsObj.reduce((locales, { content, path }) => {
		const curFileLocales = content
			.match(/export\s+default\s+{([\s\S]+)}/)[1]
			.split(/(?<=['"]),/) // 每个位一条键值对
			.reduce((pre, curStr) => {
				const res = curStr
					.split(/(?<=['"]):/) // 取键值对的key，value
					.map((v) => v.trim()) // 去除空格和换行符
					// .map((v) => v.replace(/^\s*/, "").replace(/\s*$/, ""));
					.map((v) => v.replace(/^['"]/, "").replace(/['"]$/, ""));

				if (!pre[res[0]]) {
					pre[res[0]] = [];
				}
				pre[res[0]] = { path, val: res[1] };
				return pre;
			}, {});

		// 合并当前文件的map到总map中
		Object.keys(curFileLocales).forEach((curKey) => {
			locales[curKey] || (locales[curKey] = []);

			locales[curKey].push(curFileLocales[curKey]);
		});

		return locales;
	}, {});
	return locales;
}

const formatMessageReg =
	/(?<=((props\.)?intl\.)?formatMessage\(\s*{\s*id:\s+['"])([a-zA-Z\._]+)(?=['"])/g;

// TODO:支持懒加载
export function activate(context: vscode.ExtensionContext) {
	console.log(context);

	let locales;
	(async function () {
		// TODO: 使用vscode的api存储
		locales = await getWord();
		console.log(locales);
	})();

	vscode.languages.registerHoverProvider(
		["javascript", "typescript", "javascriptreact", "typescriptreact"],
		{
			provideHover(document, position, token) {
				const lang =
					document.getText(
						new vscode.Range(
							// TODO: 不取两行为何可行？
							position.with(position.line - 1, 0), // position.line - 1 可能小于0
							position.with(position.line, document.lineAt(position.line).range.end.character)
						)
					) || "";
				const curWord = document.getText(document.getWordRangeAtPosition(position)) || "";

				// 检测是否为formatMessage格式,应为检测范围有两行，可能不止一个结果
				const matchWords = lang.match(formatMessageReg);
				const matchWord = matchWords.find((w) => w.includes(curWord));

				// 控制只有hover在具体的locale字段上才显示，即使在id，formatMessage上也不显示
				if (!matchWord) {
					return;
				}
				console.log(matchWord);

				return new vscode.Hover(
					locales[matchWord]
						// .sort()
						.reduce((pre, wordConfig) => [...pre, `[${wordConfig.val}](${wordConfig.path})`], [])
				);
			},
		}
	);

	// context.subscriptions.push(test);
}

export function deactivate() {}
