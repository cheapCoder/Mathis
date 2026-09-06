import { strict as assert } from "assert";
import { parseJsonDef, TextSpan } from "./jsonDef";

// 按 base-one 且首尾都包含的约定，从原文中切出 span 对应的文本
function sliceSpan(text: string, span: TextSpan) {
	assert.equal(span.startLine, span.endLine);
	return text.split("\n")[span.startLine - 1].slice(span.startColumn - 1, span.endColumn);
}

describe("parseJsonDef", () => {
	it("扁平 JSON：key 与 value 原样返回", () => {
		const text = `{\n  "sign_in": "Sign in",\n  "email": "Email"\n}`;
		const leaves = parseJsonDef(text);

		assert.deepEqual(
			leaves.map(l => [l.key, l.value]),
			[
				["sign_in", "Sign in"],
				["email", "Email"],
			]
		);
		assert.equal(sliceSpan(text, leaves[0].keySpan), "sign_in");
		assert.equal(sliceSpan(text, leaves[0].valueSpan), "Sign in");
	});

	it("嵌套 JSON：按 . 拼成完整 key，位置落在叶子节点上", () => {
		const text = `{\n  "common": {\n    "app_name": "TestPilot"\n  },\n  "agent": {\n    "tool": {\n      "browser": "浏览器"\n    }\n  }\n}`;
		const leaves = parseJsonDef(text);

		assert.deepEqual(
			leaves.map(l => [l.key, l.value]),
			[
				["common.app_name", "TestPilot"],
				["agent.tool.browser", "浏览器"],
			]
		);
		assert.deepEqual(leaves[0].keySpan, { startLine: 3, startColumn: 6, endLine: 3, endColumn: 13 });
		assert.deepEqual(leaves[0].valueSpan, { startLine: 3, startColumn: 18, endLine: 3, endColumn: 26 });
		assert.equal(sliceSpan(text, leaves[1].keySpan), "browser");
		assert.equal(sliceSpan(text, leaves[1].valueSpan), "浏览器");
	});

	it("数字/布尔叶子转成字符串，null 与数组跳过", () => {
		const text = `{"count": 3, "on": true, "none": null, "list": ["a"], "s": "x"}`;
		assert.deepEqual(
			parseJsonDef(text).map(l => [l.key, l.value]),
			[
				["count", "3"],
				["on", "true"],
				["s", "x"],
			]
		);
	});

	it("空对象或根节点不是对象时返回空数组", () => {
		assert.deepEqual(parseJsonDef(`{}`), []);
		assert.deepEqual(parseJsonDef(`["a", "b"]`), []);
	});
});
