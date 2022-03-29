declare interface AstLocation {
	line: number;
	column: number;
}

declare interface LocaleFile {
	[key: string]: string;
}

declare interface AstMeta {
	lang: string;
	uri: import("vscode").Uri;
}

declare type I18nLibType = "react-intl" | "svelte-i18n" | undefined;

declare type DefMapType = Map<string, Map<string, DefNode>>;

declare interface DefNode {
	key: string;
	value: string;
	keyRange: import("vscode").Range;
	valueRange: import("vscode").Range;
	lang: string;
	defUri: import("vscode").Uri;
}

declare type ApplyMapType = Map<string, ApplyNode[]>;

declare interface ApplyNode {
	key: string;
	loc: import("vscode").Location;
	code: string;
	languageId: string;
}
