import { strict as assert } from "assert";
import * as path from "path";
import * as vscode from "vscode";

const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
const openDoc = (relativePath: string) =>
	vscode.workspace.openTextDocument(path.join(workspaceRoot, relativePath));

// 定位文件里 snippet 中 inner 这段文字内部的一个位置，避免把行列写死
function positionOf(doc: vscode.TextDocument, snippet: string, inner: string) {
	const index = doc.getText().indexOf(snippet);
	assert.ok(index >= 0, `文件里找不到 ${snippet}`);
	return doc.positionAt(index + snippet.indexOf(inner) + 1);
}

// 把所有 hover provider 的 markdown 拼成一段文本便于断言
async function hoverText(doc: vscode.TextDocument, position: vscode.Position) {
	const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
		"vscode.executeHoverProvider",
		doc.uri,
		position
	);
	return hovers.flatMap(h => h.contents.map(c => (typeof c === "string" ? c : c.value))).join("\n");
}

describe("next-intl 示例工程 hover", () => {
	before(async () => {
		const extension = vscode.extensions.getExtension("happyHacking.mathis");
		assert.ok(extension, "未找到 Mathis 扩展");
		const api = await extension.activate();
		await api.ready;
	});

	it('t("title") 显示完整 key 与 zh/en 文案', async () => {
		const doc = await openDoc("src/components/Hello.tsx");
		const text = await hoverText(doc, positionOf(doc, 't("title"', "title"));
		assert.match(text, /greeting\.title/);
		assert.match(text, /zh: 你好，\{name\}/);
		assert.match(text, /en: Hello, \{name\}/);
	});

	it('嵌套 key t("nested.deep") 拼成三级 key', async () => {
		const doc = await openDoc("src/components/Hello.tsx");
		const text = await hoverText(doc, positionOf(doc, 't("nested.deep"', "nested.deep"));
		assert.match(text, /greeting\.nested\.deep/);
		assert.match(text, /zh: 三层嵌套/);
	});

	it("另一个变量 c 绑定到 common 命名空间", async () => {
		const doc = await openDoc("src/components/Hello.tsx");
		const text = await hoverText(doc, positionOf(doc, 'c("cancel"', "cancel"));
		assert.match(text, /common\.cancel/);
		assert.match(text, /zh: 取消/);
	});

	it("服务端 await getTranslations 也能解析", async () => {
		const doc = await openDoc("src/app/page.tsx");
		const text = await hoverText(doc, positionOf(doc, 't("hint"', "hint"));
		assert.match(text, /greeting\.hint/);
		assert.match(text, /en: Welcome to Mathis/);
	});

	it("命名空间字面量本身不是 key，没有文案 hover", async () => {
		const doc = await openDoc("src/components/Hello.tsx");
		const text = await hoverText(doc, positionOf(doc, 'useTranslations("greeting")', "greeting"));
		assert.doesNotMatch(text, /zh: |en: /);
	});

	it("定义文件叶子节点 hover 列出应用位置", async () => {
		const doc = await openDoc("src/locale/zh.json");
		const text = await hoverText(doc, positionOf(doc, '"deep": "三层嵌套"', "deep"));
		assert.match(text, /Hello\.tsx/);
		assert.match(text, /nested\.deep/);
	});
});
