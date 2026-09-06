// next-intl 写法：先 const t = useTranslations("ns") 绑定命名空间，再 t("key") 取文案，
// 完整 key = ns.key。服务端为 await getTranslations("ns") 或 getTranslations({ namespace: "ns" })

export interface ApplyMatch {
	key: string; // 拼好命名空间的完整 key
	start: number; // 源码里字面量内容的起始偏移
	end: number; // 结束偏移（不含）
}

interface Binding {
	name: string;
	namespace: string;
	offset: number;
}

const BINDING_REG =
	/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+?)?=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:(["'])([\w.-]*)\2|\{[^}]*?\bnamespace\s*:\s*(["'])([\w.-]+)\4)?/g;

const escapeReg = (str: string) => str.replace(/[$]/g, "\\$&");

function collectBindings(text: string): Binding[] {
	const bindings: Binding[] = [];
	let match: RegExpExecArray | null;
	while ((match = BINDING_REG.exec(text))) {
		bindings.push({ name: match[1], namespace: match[3] ?? match[5] ?? "", offset: match.index });
	}
	return bindings;
}

// 同名变量可能在同一文件多次绑定（多个组件各自 const t = ...），取调用位置之前最近的一次
function resolveNamespace(bindings: Binding[], name: string, offset: number) {
	let found: Binding | undefined;
	for (const b of bindings) {
		if (b.offset >= offset) break;
		if (b.name === name) found = b;
	}
	return found;
}

export function scanNextIntlApply(text: string): ApplyMatch[] {
	const bindings = collectBindings(text);
	const names = [...new Set(bindings.map(b => b.name))];
	const matches: ApplyMatch[] = [];

	names.forEach(name => {
		// 排除成员调用（i18n.t）和变量名只是后缀（commonT 之于 t）的情况；只收字符串字面量参数
		const callReg = new RegExp(
			`(?<![\\w$.])${escapeReg(name)}(?:\\.(?:rich|markup|raw|has))?\\(\\s*(["'])([\\w.-]+)\\1`,
			"g"
		);
		let match: RegExpExecArray | null;
		while ((match = callReg.exec(text))) {
			const binding = resolveNamespace(bindings, name, match.index);
			if (!binding) continue;

			const start = match.index + match[0].length - match[2].length - 1;
			matches.push({
				key: binding.namespace ? `${binding.namespace}.${match[2]}` : match[2],
				start,
				end: start + match[2].length,
			});
		}
	});

	return matches.sort((a, b) => a.start - b.start);
}
