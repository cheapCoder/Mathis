export default class DelayCell {
	private cell: Set<string> = new Set();
	private args: any[] = [];
	private fn; // 调用时传入二维数组，一层的每一项为每次函数调用传入的rest数组
	private delay: number;
	private callThis: object;
	private compareFn: Function;
	constructor(fn: Function, compareFn: Function, delay?: number, callThis?: object) {
		this.fn = fn;
		this.compareFn = compareFn;
		this.delay = delay || 2000;
		this.callThis = callThis || globalThis;
	}

	public callback(...rest: any[]) {
		const com = this.compareFn(...rest);

		if (this.cell.has(com)) {
			return;
		}
		// console.log(rest[0].document.fileName);

		if (this.cell.size === 0) {
			setTimeout(() => {
				this.fn.call(this.callThis, this.args);
				this.cell.clear();
				this.args = [];
			}, this.delay);
		}
		this.args.push(rest);
		this.cell.add(com);
	}
}
