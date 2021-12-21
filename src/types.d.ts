declare interface AstLocation {
	line: number;
	column: number;
}

declare interface LocaleConfig {
	value: "string";
	path: "string";
	locations: {
		key: { start: AstLocation; end: AstLocation };
		value: { start: AstLocation; end: AstLocation };
	};
}
