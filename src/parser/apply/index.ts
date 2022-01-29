import { commands, Uri, workspace } from "vscode";


export const dispatchApplyParser = async (uris: Uri | Uri[]) => {
	Array.isArray(uris) || (uris = [uris]);

	await Promise.all(uris.map((u) => workspace.fs.readFile(u)));
};
