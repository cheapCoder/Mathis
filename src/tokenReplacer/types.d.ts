declare module "gonzales-pe";

declare interface TokenNode {
	key: string;
	val: string;
	usage: string[];
	valoc: import("vscode").Location;
}
