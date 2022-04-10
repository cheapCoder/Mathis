export function getRestrictValue(str: string, expandIndex: number, restricts: string[]) {
	if (expandIndex < 0 || expandIndex >= str.length) {
		return "";
	}
	let start: number = expandIndex;
	let end: number = expandIndex;

	// 若start到0还没检测到限制符，则为0，所以不用等于0
	while (start > 0) {
		if (restricts.includes(str[start])) {
			break;
		} else {
			start--;
		}
	}
	// end
	while (end < str.length - 1) {
		if (restricts.includes(str[end])) {
			break;
		} else {
			end++;
		}
	}

	// 去除限制符
	return str.substring(start + 1, end); // substring不包含结束值
}

export function getMarkdownListString(list: string[]) {
	return list.map((key) => `- \`${key}\``).join("\n") + "\n\n";
}
