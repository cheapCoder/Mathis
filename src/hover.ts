import { Hover, MarkdownString } from "vscode";
import { getRestrictValue } from "./match";
import nodeManger from "./manger/nodes";

export const showLocaleHover = () => ({
	provideHover(document, position, token) {
		const curWord = getRestrictValue(document.getText(), document.offsetAt(position), ["'", '"']);

		const matchWord = nodeManger.defs[curWord];

		if (!matchWord) {
			return;
		}

		const markdownStrings = Object.keys(matchWord).map((lan) => {
			const ms = new MarkdownString(
				// `[${locale.value}](${locale.path}#${locale.locations.key.start.line})  [$(explorer-view-icon)](command:mathis.copyValue)`,
				`${
					matchWord[lan].value
				} [$(keybindings-edit)](command:mathis.definition?${encodeURIComponent(
					JSON.stringify(matchWord[lan])
				)})  [$(explorer-view-icon)](command:mathis.copy?${encodeURIComponent(
					JSON.stringify({
						value: matchWord[lan].value,
					})
				)})`,
				true
			);

			ms.isTrusted = true;
			ms.supportHtml = true;

			return ms;
		});

		return new Hover(markdownStrings);
	},
});
