import { parse as parseJSON } from "@humanwhocodes/momoa";

// 位置按项目约定存 base-one，且首尾都包含
export interface TextSpan {
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
}

export interface JsonLeaf {
	key: string;
	value: string;
	keySpan: TextSpan;
	valueSpan: TextSpan;
}

interface MomoaLoc {
	start: { line: number; column: number };
	end: { line: number; column: number };
}

interface MomoaNode {
	type: string;
	value?: unknown;
	loc: MomoaLoc;
	members?: { name: MomoaNode; value: MomoaNode }[];
}

// momoa 的 loc 含引号且 end 列为开区间，这里去掉引号换成首尾都包含的内容区间
function stringContentSpan(loc: MomoaLoc): TextSpan {
	return {
		startLine: loc.start.line,
		startColumn: loc.start.column + 1,
		endLine: loc.end.line,
		endColumn: loc.end.column - 2,
	};
}

// 解析多语言 JSON 定义文件，嵌套对象按 . 拼成完整 key（如 agent.tool.browser），位置落在叶子的 key/value 上
export function parseJsonDef(text: string): JsonLeaf[] {
	const root = (parseJSON(text) as unknown as { body: MomoaNode }).body;
	if (root.type !== "Object") return [];

	const leaves: JsonLeaf[] = [];
	const walk = (node: MomoaNode, prefix: string) => {
		node.members?.forEach(({ name, value }) => {
			const key = prefix + (name.value as string);
			if (value.type === "Object") {
				walk(value, key + ".");
			} else if (value.type === "String" || value.type === "Number" || value.type === "Boolean") {
				leaves.push({
					key,
					value: String(value.value),
					keySpan: stringContentSpan(name.loc),
					valueSpan: stringContentSpan(value.loc),
				});
			}
		});
	};
	walk(root, "");
	return leaves;
}
