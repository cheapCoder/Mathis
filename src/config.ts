import manger from "./manger";

class Config {
	public projectName = manger?.context?.extension.packageJSON.name;
	public splitLetters = ["'", '"', "`"];
	public activeFileLanguage = [
		"javascript",
		"javascriptreact",
		"typescript",
		"typescriptreact",
		"svelte",
		"json",
		"jsonc",
	];
}

export default new Config();
