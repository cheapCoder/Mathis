import initSqlJs, { Database } from "sql.js";
import { Location, Range, Uri, workspace } from "vscode";
import path from "path";

interface DbDefNode {
	id: number;
	key: string;
	value: string;
	lang: string;
	file_path: string;
	key_range: string;
	value_range: string;
}

interface DbRemoteDefNode {
	id: number;
	key: string;
	value: string;
	lang: string;
}

interface DbApplyNode {
	id: number;
	key: string;
	file_path: string;
	language_id: string;
	code: string;
	range: string;
}

interface RangeData {
	startLine: number;
	startChar: number;
	endLine: number;
	endChar: number;
}

export class LocaleDatabase {
	private db: Database | null = null;
	private dbPath: string;
	private saveTimer: NodeJS.Timeout | null = null;

	constructor(dbPath: string = ":memory:") {
		this.dbPath = dbPath;
	}

	public async init(): Promise<void> {
		const SQL = await initSqlJs();

		// 尝试从文件加载已有数据库
		if (this.dbPath !== ":memory:") {
			try {
				const fileUri = Uri.file(this.dbPath);
				const data = await workspace.fs.readFile(fileUri);
				this.db = new SQL.Database(data);
			} catch {
				// 文件不存在，创建新数据库
				this.db = new SQL.Database();
			}
		} else {
			this.db = new SQL.Database();
		}

		this.createTables();
	}

	private createTables(): void {
		this.db?.run(`
			CREATE TABLE IF NOT EXISTS def_nodes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				key TEXT NOT NULL,
				value TEXT,
				lang TEXT NOT NULL,
				file_path TEXT NOT NULL,
				key_range TEXT,
				value_range TEXT,
				UNIQUE(key, file_path)
			);

			CREATE TABLE IF NOT EXISTS remote_def_nodes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				key TEXT NOT NULL,
				value TEXT,
				lang TEXT NOT NULL,
				UNIQUE(key, lang)
			);

			CREATE TABLE IF NOT EXISTS apply_nodes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				key TEXT NOT NULL,
				file_path TEXT NOT NULL,
				language_id TEXT,
				code TEXT,
				range TEXT,
				UNIQUE(key, file_path, range)
			);

			CREATE INDEX IF NOT EXISTS idx_def_key ON def_nodes(key);
			CREATE INDEX IF NOT EXISTS idx_def_file ON def_nodes(file_path);
			CREATE INDEX IF NOT EXISTS idx_def_lang ON def_nodes(lang);

			CREATE INDEX IF NOT EXISTS idx_remote_key ON remote_def_nodes(key);

			CREATE INDEX IF NOT EXISTS idx_apply_key ON apply_nodes(key);
			CREATE INDEX IF NOT EXISTS idx_apply_file ON apply_nodes(file_path);
		`);
	}

	// 延迟保存到文件
	private scheduleSave(): void {
		if (this.dbPath === ":memory:") return;

		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}

		this.saveTimer = setTimeout(() => {
			this.saveToFile();
		}, 1000);
	}

	private async saveToFile(): Promise<void> {
		if (!this.db || this.dbPath === ":memory:") return;

		try {
			const data = this.db.export();
			const buffer = Buffer.from(data);

			// 确保目录存在
			const dir = path.dirname(this.dbPath);
			try {
				await workspace.fs.createDirectory(Uri.file(dir));
			} catch {
				// 目录可能已存在
			}

			await workspace.fs.writeFile(Uri.file(this.dbPath), buffer);
		} catch (e) {
			console.error("Failed to save database:", e);
		}
	}

	// ========== Def 操作 ==========

	public upsertDefNodes(nodes: DefNode[]): void {
		if (!this.db) return;

		for (const node of nodes) {
			this.db.run(
				`INSERT OR REPLACE INTO def_nodes (key, value, lang, file_path, key_range, value_range)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				[
					node.key,
					node.value,
					node.lang,
					node.defUri.fsPath,
					this.rangeToJson(node.keyRange),
					this.rangeToJson(node.valueRange),
				]
			);
		}
		this.scheduleSave();
	}

	public getDefByKey(key: string): DefNode[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT * FROM def_nodes WHERE key = ?`);
		stmt.bind([key]);

		const results: DefNode[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as unknown as DbDefNode;
			results.push(this.rowToDefNode(row));
		}
		stmt.free();
		return results;
	}

	public getDefByKeyAsMap(key: string): Map<string, DefNode> | undefined {
		const nodes = this.getDefByKey(key);
		if (nodes.length === 0) return undefined;
		return new Map(nodes.map(n => [n.defUri.fsPath, n]));
	}

	public hasDefKey(key: string): boolean {
		if (!this.db) return false;
		const stmt = this.db.prepare(`SELECT 1 FROM def_nodes WHERE key = ? LIMIT 1`);
		stmt.bind([key]);
		const hasResult = stmt.step();
		stmt.free();
		return hasResult;
	}

	public deleteDefByFile(filePath: string): void {
		if (!this.db) return;
		this.db.run(`DELETE FROM def_nodes WHERE file_path = ?`, [filePath]);
		this.scheduleSave();
	}

	public getDefKeysByFile(filePath: string): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT key FROM def_nodes WHERE file_path = ?`);
		stmt.bind([filePath]);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { key: string };
			results.push(row.key);
		}
		stmt.free();
		return results;
	}

	public getAllDefKeys(): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT key FROM def_nodes`);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { key: string };
			results.push(row.key);
		}
		stmt.free();
		return results;
	}

	public getSupportedLangs(): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT lang FROM def_nodes`);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { lang: string };
			results.push(row.lang);
		}
		stmt.free();
		return results;
	}

	public getAllDefFiles(): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT file_path FROM def_nodes`);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { file_path: string };
			results.push(row.file_path);
		}
		stmt.free();
		return results;
	}

	public searchDefByValue(searchValue: string): DefNode[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT * FROM def_nodes WHERE value LIKE ?`);
		stmt.bind([`%${searchValue}%`]);

		const results: DefNode[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as unknown as DbDefNode;
			results.push(this.rowToDefNode(row));
		}
		stmt.free();
		return results;
	}

	public getAllDefNodes(): DefNode[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT * FROM def_nodes`);

		const results: DefNode[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as unknown as DbDefNode;
			results.push(this.rowToDefNode(row));
		}
		stmt.free();
		return results;
	}

	// ========== Remote Def 操作 ==========

	public upsertRemoteDef(key: string, langMap: Map<string, { lang: string; value: string }>): void {
		if (!this.db) return;

		for (const [, { lang, value }] of langMap.entries()) {
			this.db.run(
				`INSERT OR REPLACE INTO remote_def_nodes (key, value, lang) VALUES (?, ?, ?)`,
				[key, value, lang]
			);
		}
		this.scheduleSave();
	}

	public getRemoteDefByKey(key: string): Map<string, { lang: string; value: string }> | undefined {
		if (!this.db) return undefined;
		const stmt = this.db.prepare(`SELECT * FROM remote_def_nodes WHERE key = ?`);
		stmt.bind([key]);

		const results: [string, { lang: string; value: string }][] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as unknown as DbRemoteDefNode;
			results.push([row.lang, { lang: row.lang, value: row.value }]);
		}
		stmt.free();

		if (results.length === 0) return undefined;
		return new Map(results);
	}

	public hasRemoteDefKey(key: string): boolean {
		if (!this.db) return false;
		const stmt = this.db.prepare(`SELECT 1 FROM remote_def_nodes WHERE key = ? LIMIT 1`);
		stmt.bind([key]);
		const hasResult = stmt.step();
		stmt.free();
		return hasResult;
	}

	public getAllRemoteDefKeys(): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT key FROM remote_def_nodes`);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { key: string };
			results.push(row.key);
		}
		stmt.free();
		return results;
	}

	public clearRemoteDef(): void {
		if (!this.db) return;
		this.db.run(`DELETE FROM remote_def_nodes`);
		this.scheduleSave();
	}

	// ========== Apply 操作 ==========

	public upsertApplyNodes(nodes: ApplyNode[]): void {
		if (!this.db) return;

		for (const node of nodes) {
			this.db.run(
				`INSERT OR REPLACE INTO apply_nodes (key, file_path, language_id, code, range)
				 VALUES (?, ?, ?, ?, ?)`,
				[
					node.key,
					node.loc.uri.fsPath,
					node.languageId,
					node.code,
					this.rangeToJson(node.loc.range),
				]
			);
		}
		this.scheduleSave();
	}

	public getApplyByKey(key: string): ApplyNode[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT * FROM apply_nodes WHERE key = ?`);
		stmt.bind([key]);

		const results: ApplyNode[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as unknown as DbApplyNode;
			results.push(this.rowToApplyNode(row));
		}
		stmt.free();
		return results;
	}

	public deleteApplyByFile(filePath: string): void {
		if (!this.db) return;
		this.db.run(`DELETE FROM apply_nodes WHERE file_path = ?`, [filePath]);
		this.scheduleSave();
	}

	public getApplyKeysByFile(filePath: string): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT key FROM apply_nodes WHERE file_path = ?`);
		stmt.bind([filePath]);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { key: string };
			results.push(row.key);
		}
		stmt.free();
		return results;
	}

	public getAllApplyKeys(): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`SELECT DISTINCT key FROM apply_nodes`);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { key: string };
			results.push(row.key);
		}
		stmt.free();
		return results;
	}

	// ========== 聚合查询 ==========

	public getAllKeys(): string[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`
			SELECT DISTINCT key FROM def_nodes
			UNION
			SELECT DISTINCT key FROM remote_def_nodes
		`);

		const results: string[] = [];
		while (stmt.step()) {
			const row = stmt.getAsObject() as { key: string };
			results.push(row.key);
		}
		stmt.free();
		return results;
	}

	public getDefStats(): { totalKeys: number; totalFiles: number; langs: string[] } {
		if (!this.db) return { totalKeys: 0, totalFiles: 0, langs: [] };

		const keysStmt = this.db.prepare(`SELECT COUNT(DISTINCT key) as count FROM def_nodes`);
		keysStmt.step();
		const totalKeys = (keysStmt.getAsObject() as { count: number }).count;
		keysStmt.free();

		const filesStmt = this.db.prepare(`SELECT COUNT(DISTINCT file_path) as count FROM def_nodes`);
		filesStmt.step();
		const totalFiles = (filesStmt.getAsObject() as { count: number }).count;
		filesStmt.free();

		const langs = this.getSupportedLangs();

		return { totalKeys, totalFiles, langs };
	}

	// ========== 生命周期 ==========

	public async close(): Promise<void> {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}

		// 关闭前保存
		await this.saveToFile();
		this.db?.close();
		this.db = null;
	}

	// ========== 辅助方法 ==========

	private rangeToJson(range: Range): string {
		return JSON.stringify({
			startLine: range.start.line,
			startChar: range.start.character,
			endLine: range.end.line,
			endChar: range.end.character,
		});
	}

	private jsonToRange(json: string): Range {
		const data: RangeData = JSON.parse(json);
		return new Range(data.startLine, data.startChar, data.endLine, data.endChar);
	}

	private rowToDefNode(row: DbDefNode): DefNode {
		return {
			key: row.key,
			value: row.value,
			lang: row.lang,
			defUri: Uri.file(row.file_path),
			keyRange: this.jsonToRange(row.key_range),
			valueRange: this.jsonToRange(row.value_range),
		};
	}

	private rowToApplyNode(row: DbApplyNode): ApplyNode {
		const range = this.jsonToRange(row.range);
		return {
			key: row.key,
			code: row.code,
			languageId: row.language_id,
			loc: new Location(Uri.file(row.file_path), range),
		};
	}
}
