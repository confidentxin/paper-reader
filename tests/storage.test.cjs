const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LibraryStore } = require('../electron/storage.cjs');
const { makePDF } = require('./fixtures.cjs');
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-store-'));
  const source = path.join(root, 'original.pdf'), data = path.join(root, 'data');
  await fs.writeFile(source, makePDF());
  let store = await new LibraryStore(data).open();
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, source, data, get store() { return store; }, restart: async () => { store.close(); store = await new LibraryStore(data).open(); return store; } };
}
async function importDoc(s) { const staged = await s.store.stage(s.source); return s.store.commit(staged.token, { title: 'Real fixture', pages: 3 }); }
test('managed copy, title/category/favorite/status and normalized position survive reopening SQLite', async t => {
  const s = await setup(t), original = await fs.readFile(s.source), doc = await importDoc(s);
  s.store.update(doc.id, { title: 'Updated title', category: '机器学习', favorite: 1, status: 'reading', page: 2, offset: 0.37, zoom: '1.5', last_opened: true });
  await fs.unlink(s.source);
  await s.restart();
  assert.equal(s.store.list().length, 1);
  const restored = s.store.get(doc.id);
  for (const [key, value] of Object.entries({ title: 'Updated title', category: '机器学习', favorite: 1, status: 'reading', page: 2, offset: 0.37, zoom: '1.5' })) assert.equal(restored[key], value);
  assert.deepEqual(Buffer.from(await s.store.read(doc.id)), original);
});
test('hash duplicate does not add a row and can repair an absent managed file', async t => {
  const s = await setup(t), original = await fs.readFile(s.source), doc = await importDoc(s);
  s.store.update(doc.id, { page: 3, favorite: 1 });
  await fs.unlink(path.join(s.data, 'documents', `${doc.id}.pdf`));
  const duplicate = await s.store.stage(s.source);
  assert.equal(duplicate.duplicate.id, doc.id); assert.equal(duplicate.duplicate.page, 3);
  assert.equal(s.store.list().length, 1); assert.deepEqual(Buffer.from(await s.store.read(doc.id)), original);
  assert.deepEqual(await fs.readdir(path.join(s.data, 'incoming')), []);
});
test('invalid types, empty files, directories and oversized files leave existing library unchanged', async t => {
  const s = await setup(t); await importDoc(s);
  for (const [name, bytes] of [['bad.txt', '%PDF-1.7'], ['bad.pdf', 'hello'], ['empty.pdf', '']]) {
    const file = path.join(s.root, name); await fs.writeFile(file, bytes); await assert.rejects(s.store.stage(file));
  }
  const oversized = path.join(s.root, 'oversized.pdf'); const handle = await fs.open(oversized, 'w'); await handle.truncate(151 * 1024 * 1024); await handle.close();
  await assert.rejects(s.store.stage(oversized)); assert.equal(s.store.list().length, 1);
});
test('discarded or interrupted imports are never added to library', async t => {
  const s = await setup(t), a = await s.store.stage(s.source);
  await s.store.discard(a.token); await assert.rejects(s.store.commit(a.token, { pages: 3 }));
  await s.store.stage(s.source); await s.restart();
  assert.equal(s.store.list().length, 0); assert.deepEqual(await fs.readdir(path.join(s.data, 'incoming')), []);
});
test('invalid updates, identifiers, SQL-shaped keys and out-of-bounds positions rejected', async t => {
  const s = await setup(t), doc = await importDoc(s);
  for (const change of [{ page: 4 }, { page: 0 }, { offset: -1 }, { zoom: '1000' }, { category: ' ' }, { favorite: 2 }, { status: 'oops' }, { 'id=?; DROP TABLE documents;--': '' }]) assert.throws(() => s.store.update(doc.id, change));
  await assert.rejects(s.store.read('../original.pdf')); assert.equal(s.store.list().length, 1);
});
test('modified managed content is detected and original remains unchanged', async t => {
  const s = await setup(t), original = await fs.readFile(s.source), doc = await importDoc(s);
  await fs.writeFile(path.join(s.data, 'documents', `${doc.id}.pdf`), '%PDF-broken');
  await assert.rejects(s.store.read(doc.id), /修改/); assert.deepEqual(await fs.readFile(s.source), original);
});
test('read-only write failure preserves prior progress; future schema is not overwritten', async t => {
  const s = await setup(t), doc = await importDoc(s);
  s.store.db.exec('PRAGMA query_only=ON');
  assert.throws(() => s.store.update(doc.id, { page: 2 }));
  assert.equal(s.store.get(doc.id).page, 1);
  s.store.db.exec('PRAGMA query_only=OFF; PRAGMA user_version=99');
  const newer = new LibraryStore(s.data);
  await assert.rejects(newer.open(), /数据版本较新/);
  assert.equal(newer.db.prepare('PRAGMA user_version').get().user_version, 99);
  newer.close();
});
