declare interface AstLocation {
	line: number;
	column: number;
}

declare interface LocaleFile {
	[key: string]: string;
}

declare interface AstMeta {
	lang?: string;
	uri?: import("vscode").Uri;
}

declare type ActiveFileType = "define" | "apply";

declare type I18nLibType = "react-intl" | "svelte-i18n" | undefined;

declare type DefMapType = {
	[path: string]: Map<string, import("./parser/def").DefNode>;
};

declare type ApplyMapType =
	| {
			[path: string]: Map<string, ApplyParseNode[]>;
	  }
	| undefined;

declare interface ApplyParseNode {
	key: string;
	loc: import("vscode").Location;
	code: string;
	languageId: string;
}
