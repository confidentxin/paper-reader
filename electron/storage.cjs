const { DatabaseSync, backup } = require('node:sqlite');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const MAX_BYTES = 150 * 1024 * 1024;
class LibraryStore {
  constructor(root) {
    this.root = root;
    this.staged = new Map();
  }
  async open() {
    await fs.mkdir(path.join(this.root, 'documents'), { recursive: true });
    // A previous interrupted import has no committed record and can be discarded.
    await fs.rm(path.join(this.root, 'incoming'), { recursive: true, force: true });
    await fs.mkdir(path.join(this.root, 'incoming'), { recursive: true });
    this.db = new DatabaseSync(path.join(this.root, 'library.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 4) throw new Error('数据版本较新，请使用更新版本的应用。');
    if (version >= 1 && version < 4) {
      const dir = path.join(this.root, 'backups');
      await fs.mkdir(dir, { recursive: true });
      await backup(this.db, path.join(dir, `library-v${version}-${Date.now()}.sqlite`));
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, original_name TEXT NOT NULL,
      bytes INTEGER NOT NULL, pages INTEGER NOT NULL, category TEXT NOT NULL DEFAULT '未分类',
      favorite INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'unread',
      page INTEGER NOT NULL DEFAULT 1, offset REAL NOT NULL DEFAULT 0,
      zoom TEXT NOT NULL DEFAULT 'fit', imported_at TEXT NOT NULL, last_opened TEXT
    );`);
    require('./bilingual.cjs').migrate(this.db);
    require('./annotations.cjs').migrate(this.db);
    return this;
  }
  list() { return this.db.prepare('SELECT * FROM documents ORDER BY COALESCE(last_opened, imported_at) DESC').all(); }
  get(id) {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new Error('无效文献标识。');
    const row = this.db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    if (!row) throw new Error('文献不存在。');
    return row;
  }
  async stage(source) {
    if (typeof source !== 'string' || path.extname(source).toLowerCase() !== '.pdf') throw new Error('仅支持 .pdf 文件。');
    const stat = await fs.stat(source);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_BYTES) throw new Error('文件为空或超过当前 150 MB 限制。');
    const token = randomUUID();
    const target = path.join(this.root, 'incoming', token);
    // Copy first: validation and hash refer to the exact managed snapshot, not a changing source file.
    await fs.copyFile(source, target);
    try {
      const bytes = await fs.readFile(target);
      if (bytes.length > MAX_BYTES || !bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('不是有效的 PDF 文件。');
      const id = createHash('sha256').update(bytes).digest('hex');
      const existing = this.db.prepare('SELECT * FROM documents WHERE id=?').get(id);
      if (existing) {
        // Reimport can repair a missing/modified managed copy without losing metadata or progress.
        await fs.rename(target, path.join(this.root, 'documents', `${id}.pdf`));
        return { duplicate: existing };
      }
      this.staged.set(token, { target, id, name: path.basename(source), bytes: bytes.length });
      return { token, data: new Uint8Array(bytes), name: path.basename(source) };
    } catch (error) { await fs.rm(target, { force: true }); throw error; }
  }
  async discard(token) {
    const entry = this.staged.get(token);
    if (entry) { await fs.rm(entry.target, { force: true }); this.staged.delete(token); }
  }
  async commit(token, metadata) {
    const entry = this.staged.get(token);
    if (!entry) throw new Error('导入已过期，请重新选择文件。');
    if (!metadata || !Number.isInteger(metadata.pages) || metadata.pages < 1 || metadata.pages > 100000) throw new Error('PDF 页数无效。');
    const title = String(metadata.title || entry.name.replace(/\.pdf$/i, '')).trim().slice(0, 1000);
    await fs.rename(entry.target, path.join(this.root, 'documents', `${entry.id}.pdf`));
    this.db.prepare(`INSERT INTO documents (id,title,original_name,bytes,pages,imported_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
      .run(entry.id, title || entry.name, entry.name, entry.bytes, metadata.pages, new Date().toISOString());
    this.staged.delete(token);
    return this.get(entry.id);
  }
  async read(id) {
    this.get(id);
    const bytes = await fs.readFile(path.join(this.root, 'documents', `${id}.pdf`));
    if (createHash('sha256').update(bytes).digest('hex') !== id) throw new Error('文献副本已被修改，请重新导入原始文件以修复。');
    return new Uint8Array(bytes);
  }
  update(id, change) {
    const row = this.get(id);
    if (!change || typeof change !== 'object') throw new Error('无效更新。');
    const values = {};
    for (const key of Object.keys(change)) {
      const v = change[key];
      if (key === 'title' || key === 'category') {
        if (typeof v !== 'string' || !v.trim() || v.length > 1000) throw new Error('标题或分类无效。');
        values[key] = v.trim();
      } else if (key === 'favorite' && (v === 0 || v === 1)) values[key] = v;
      else if (key === 'status' && ['unread', 'reading', 'done'].includes(v)) values[key] = v;
      else if (key === 'page' && Number.isInteger(v) && v >= 1 && v <= row.pages) values[key] = v;
      else if (key === 'offset' && Number.isFinite(v) && v >= 0 && v <= 1) values[key] = v;
      else if (key === 'zoom' && (v === 'fit' || (Number.isFinite(Number(v)) && Number(v) >= 0.25 && Number(v) <= 3))) values[key] = String(v);
      else if (key === 'last_opened' && v === true) values[key] = new Date().toISOString();
      else throw new Error(`无效字段：${key}`);
    }
    const keys = Object.keys(values);
    if (keys.length) this.db.prepare(`UPDATE documents SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).run(...Object.values(values), id);
    return this.get(id);
  }
  close() { this.db?.close(); }
}
module.exports = { LibraryStore, MAX_BYTES };
