import * as path from "path";
import { runTests } from "@vscode/test-electron";

// 起一个真实的 VS Code 扩展宿主，以 demo/next-intl 为工作区跑 e2e 用例
// 默认由 test-electron 下载 stable 到 .vscode-test/；设 MATHIS_VSCODE 指向已装的可执行文件可省下载
async function main() {
	const root = path.resolve(__dirname, "../..");
	await runTests({
		vscodeExecutablePath: process.env.MATHIS_VSCODE,
		extensionDevelopmentPath: root,
		extensionTestsPath: path.resolve(__dirname, "./suite/index"),
		launchArgs: [
			path.join(root, "demo/next-intl"),
			"--disable-extensions",
			"--disable-workspace-trust",
			`--user-data-dir=${path.join(root, ".vscode-test/user-data")}`,
			`--extensions-dir=${path.join(root, ".vscode-test/extensions")}`,
		],
	});
}

main().catch(e => {
	console.error("e2e 运行失败:", e);
	process.exit(1);
});
