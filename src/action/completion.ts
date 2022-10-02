import {
	CompletionItem,
	CompletionItemKind,
	languages,
	MarkdownString,
	Position,
	Range,
	TextDocument,
} from "vscode";
import config from "../config";
import manger from "../manger";

export const keyCompletion = () =>
	languages.registerCompletionItemProvider(
		config.activeFileLanguage,
		{
			provideCompletionItems(document: TextDocument, position: Position) {
				// in formatMessage position
				const reg = /formatMessage\((.*?)\)/g;
				const text = document.lineAt(position.line).text;
				let match;
				while ((match = reg.exec(text))) {
					const methodRange = new Range(
						position.line,
						match.index,
						position.line,
						match.index + match[0].length
					);

					if (methodRange.contains(position)) {
						return manger.keys.map(key => {
							const complete = new CompletionItem(key, CompletionItemKind.Value);
							// @ts-ignore
							let value: Map<string, { lang: string; value: string }> = manger.defMap.get(key);
							let fromRemote = false;
							if (!value) {
								value = manger.remoteDefMap.get(key)!;
								fromRemote = true;
							}

							let label = "";
							value.forEach(node => {
								label += `${node.lang}: ${node.value} ${fromRemote ? "$(cloud)" : ""}\n\n`;
							});

							complete.documentation = new MarkdownString(label, true);
							return complete;
						});
					}
				}
				return;
			},
		},
		"'",
		'"'
	);
