import { spawn } from "child_process";
import * as http from "http";
import * as path from "path";
import { Browser, chromium, Page } from "playwright-core";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";

// UI 层自测：起一个带调试端口的 VS Code，用 Playwright 通过 CDP 接进渲染进程，
// 真实移动鼠标到 t("...") 字面量上，读 hover 弹层里的文字并截图
const root = path.resolve(__dirname, "../..");
const PORT = 9333;

interface VisualCase {
	name: string;
	workspace: string; // 作为工作区根目录打开的文件夹
	file: string; // 要 hover 的文件
	snippet: string; // 定位行用的代码片段，鼠标落在其中字面量的中间
	expected: string[]; // 弹层里必须出现的文字
}

const cases: VisualCase[] = [
	{
		name: "demo/next-intl 作为工作区根目录",
		workspace: path.join(root, "demo/next-intl"),
		file: path.join(root, "demo/next-intl/src/components/Hello.tsx"),
		snippet: 't("title"',
		expected: ["greeting.title", "zh: 你好，{name}", "en: Hello, {name}"],
	},
	{
		// 仓库 .vscode/settings.json 把 mathis.define/apply/i18nLib 指到 demo，验证这条配置链
		name: "Mathis 仓库作为工作区根目录，hover demo 里的文件",
		workspace: root,
		file: path.join(root, "demo/next-intl/src/app/page.tsx"),
		snippet: 't("hint"',
		expected: ["greeting.hint", "zh: 欢迎使用 Mathis", "en: Welcome to Mathis"],
	},
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForCdp(timeoutMs: number) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const ok = await new Promise<boolean>(resolve => {
			http
				.get(`http://127.0.0.1:${PORT}/json/version`, res => resolve(res.statusCode === 200))
				.on("error", () => resolve(false));
		});
		if (ok) return;
		await sleep(500);
	}
	throw new Error("VS Code 调试端口未就绪");
}

// Electron 里还有别的隐藏窗口，只要 workbench 那个页面
async function findWorkbench(browser: Browser, timeoutMs: number): Promise<Page> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const page = browser
			.contexts()
			.flatMap(context => context.pages())
			.find(p => p.url().includes("workbench"));
		if (page) return page;
		await sleep(500);
	}
	throw new Error("没找到 workbench 页面");
}

async function runCase(exe: string, c: VisualCase, index: number) {
	console.log(`\n▶ ${c.name}`);
	const vscode = spawn(
		exe,
		[
			c.workspace,
			"-g",
			`${c.file}:1:1`,
			`--extensionDevelopmentPath=${root}`,
			"--disable-workspace-trust",
			"--skip-welcome",
			"--skip-release-notes",
			"--disable-updates",
			"--new-window",
			`--user-data-dir=${path.join(root, `.vscode-test/user-data-visual-${index}`)}`,
			`--extensions-dir=${path.join(root, ".vscode-test/extensions")}`,
			`--remote-debugging-port=${PORT}`,
		],
		{ stdio: "ignore" }
	);

	try {
		await waitForCdp(30_000);
		const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
		const page = await findWorkbench(browser, 30_000);

		// 等编辑器渲染出目标行，再按等宽字体算出字面量的屏幕坐标
		const line = page.locator(".part.editor .monaco-editor .view-line", { hasText: c.snippet }).first();
		await line.waitFor({ timeout: 60_000 });
		const lineSpan = line.locator("> span").first();
		const text = (await lineSpan.innerText()).replace(/ /g, " ");
		const box = (await lineSpan.boundingBox())!;
		const charWidth = box.width / text.length;
		const x = box.x + (text.indexOf(c.snippet) + 5 + 0.5) * charWidth;
		const y = box.y + box.height / 2;

		// 索引可能还没完成：鼠标移开再移回，直到弹层里出现文案
		let hoverText = "";
		for (let i = 0; i < 30 && !hoverText.includes("zh: "); i++) {
			await page.mouse.move(box.x + box.width + 300, y);
			await sleep(300);
			await page.mouse.move(x, y);
			await sleep(1200);
			hoverText = (await page.locator(".monaco-hover:visible").allInnerTexts()).join("\n");
		}

		const screenshot = path.join(root, `.vscode-test/hover-visual-${index}.png`);
		await page.screenshot({ path: screenshot });
		console.log(`hover 弹层内容：\n${hoverText || "(空)"}\n截图: ${screenshot}`);

		const missing = c.expected.filter(s => !hoverText.includes(s));
		if (missing.length) throw new Error(`hover 弹层里缺少: ${missing.join(" | ")}`);
		console.log("✔ 通过");
		await browser.close();
	} finally {
		vscode.kill();
		await sleep(1500);
	}
}

async function main() {
	const exe = process.env.MATHIS_VSCODE ?? (await downloadAndUnzipVSCode());
	for (const [index, c] of cases.entries()) {
		await runCase(exe, c, index);
	}
}

main().catch(e => {
	console.error("visual 测试失败:", e);
	process.exit(1);
});
