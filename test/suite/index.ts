import * as fs from "fs";
import * as path from "path";
import Mocha from "mocha";

// 扩展宿主内的测试入口：收集同目录下所有 *.e2e.js 交给 mocha
export function run(): Promise<void> {
	const mocha = new Mocha({ ui: "bdd", color: true, timeout: 60_000 });
	fs.readdirSync(__dirname)
		.filter(file => file.endsWith(".e2e.js"))
		.forEach(file => mocha.addFile(path.join(__dirname, file)));

	return new Promise((resolve, reject) => {
		mocha.run(failures => (failures ? reject(new Error(`${failures} 个 e2e 用例失败`)) : resolve()));
	});
}
