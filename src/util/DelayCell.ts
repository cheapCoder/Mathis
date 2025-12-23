import config from "../config";

export interface FileChangeEvent {
	type: "create" | "change" | "delete";
	uri: import("vscode").Uri;
	fileType: "def" | "apply" | "unknown";
}

export default class DelayCell<T = FileChangeEvent, K = string> {
	private pending: Map<K, T> = new Map();
	private timer: NodeJS.Timeout | null = null;
	private fn: (list: T[]) => void;
	private keyFn: (item: T) => K;
	private delay: number;

	constructor(fn: (list: T[]) => void, keyFn: (item: T) => K, delay?: number) {
		this.fn = fn;
		this.keyFn = keyFn;
		this.delay = delay || config.delayTime;
	}

	public add(item: T): void {
		const key = this.keyFn(item);

		// 总是更新为最新状态（覆盖旧值）
		this.pending.set(key, item);

		// 重置定时器实现防抖
		if (this.timer) {
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(() => {
			const items = Array.from(this.pending.values());
			this.pending.clear();
			this.timer = null;
			this.fn(items);
		}, this.delay);
	}

	public flush(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.pending.size > 0) {
			const items = Array.from(this.pending.values());
			this.pending.clear();
			this.fn(items);
		}
	}

	public dispose(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.pending.clear();
	}
}
