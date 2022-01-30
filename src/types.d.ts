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

declare type LocaleMapType = {
	[value: string]: { [lang: string]: import("./manger").DefNode };
};

declare type ApplyInfo = { key: string; path: string; offset: number };
