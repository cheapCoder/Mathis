import { strict as assert } from "assert";
import { scanNextIntlApply } from "./nextIntl";

// 把匹配结果压成 [完整 key, 源码里的字面量] 便于断言
function summarize(text: string) {
	return scanNextIntlApply(text).map(m => [m.key, text.slice(m.start, m.end)]);
}

describe("scanNextIntlApply", () => {
	it("useTranslations 绑定命名空间，t(\"key\") 解析为 ns.key", () => {
		const text = `const t = useTranslations("agent");\nreturn <h1>{t("title")}</h1>;`;
		assert.deepEqual(summarize(text), [["agent.title", "title"]]);
	});

	it("服务端 await getTranslations 与对象参数 namespace 都能绑定", () => {
		const text = [
			`const t = await getTranslations("run");`,
			`const c = await getTranslations({ locale, namespace: "common" });`,
			`t("title"); c('cancel');`,
		].join("\n");
		assert.deepEqual(summarize(text), [
			["run.title", "title"],
			["common.cancel", "cancel"],
		]);
	});

	it("不带命名空间时字面量本身就是完整 key", () => {
		const text = `const t = useTranslations();\nt("agent.title");`;
		assert.deepEqual(summarize(text), [["agent.title", "agent.title"]]);
	});

	it("key 里的 . 与命名空间拼接成多级 key", () => {
		const text = `const t = useTranslations("agent");\nt("tool.browser");`;
		assert.deepEqual(summarize(text), [["agent.tool.browser", "tool.browser"]]);
	});

	it("t.rich / t.markup / t.raw / t.has 同样解析", () => {
		const text = `const t = useTranslations("a");\nt.rich("r"); t.markup("m"); t.raw("w"); t.has("h");`;
		assert.deepEqual(
			summarize(text).map(([key]) => key),
			["a.r", "a.m", "a.w", "a.h"]
		);
	});

	it("多个变量各自绑定，变量名是后缀时不互相误匹配", () => {
		const text = [
			`const t = useTranslations("nav");`,
			`const commonT = useTranslations("common");`,
			`t("chat"); commonT("cancel");`,
		].join("\n");
		assert.deepEqual(summarize(text), [
			["nav.chat", "chat"],
			["common.cancel", "cancel"],
		]);
	});

	it("同名变量多次绑定时，调用取最近一次在它之前的绑定", () => {
		const text = [
			`function A() { const t = useTranslations("a"); return t("x"); }`,
			`function B() { const t = useTranslations("b"); return t("y"); }`,
		].join("\n");
		assert.deepEqual(summarize(text), [
			["a.x", "x"],
			["b.y", "y"],
		]);
	});

	it("未绑定的函数、成员调用、模板字符串、变量参数都忽略", () => {
		const text = [
			`const t = useTranslations("a");`,
			`other("k1"); i18n.t("k2"); t(\`dyn_\${id}\`); t(item.key); t("");`,
		].join("\n");
		assert.deepEqual(summarize(text), []);
	});

	it("绑定之前的调用没有命名空间可用，忽略", () => {
		const text = `t("early");\nconst t = useTranslations("a");\nt("late");`;
		assert.deepEqual(summarize(text), [["a.late", "late"]]);
	});

	it("跨行调用与带类型标注的绑定也能解析", () => {
		const text = [
			`const t: Translator = useTranslations("run");`,
			`const label = t(`,
			`  "steps_count",`,
			`  { count: 3 },`,
			`);`,
		].join("\n");
		assert.deepEqual(summarize(text), [["run.steps_count", "steps_count"]]);
	});

	it("返回的 start/end 是字面量内容的偏移量，按出现顺序排列", () => {
		const text = `const t = useTranslations("a");\nt("one"); t('two');`;
		const matches = scanNextIntlApply(text);
		assert.equal(matches.length, 2);
		assert.equal(text.slice(matches[0].start, matches[0].end), "one");
		assert.equal(text.slice(matches[1].start, matches[1].end), "two");
		assert.ok(matches[0].start < matches[1].start);
	});
});
