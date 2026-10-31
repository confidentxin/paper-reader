import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { makePDF } = createRequire(import.meta.url)('./fixtures.cjs');
const root = path.resolve('artifacts');
await fs.mkdir(path.join(root, 'samples'), { recursive: true });
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-desktop-'));
const dataDir = path.join(sandbox, 'data');
const sample = path.join(sandbox, 'fixture.pdf'), damaged = path.join(sandbox, 'damaged.pdf');
const noText = path.join(sandbox, 'no-text.pdf'), long = path.join(sandbox, 'long.pdf');
await fs.writeFile(sample, makePDF()); await fs.writeFile(damaged, '%PDF-1.7\nbroken');
await fs.writeFile(noText, makePDF({ pages: 1, text: false, outline: false }));
await fs.writeFile(long, makePDF({ pages: 180, outline: false }));
const results = [], errors = [], warnings = [];
let app, page;
async function check(name, fn) { await fn(); results.push(name); console.log(`PASS ${name}`); }
async function launch() {
  app = await electron.launch({ ...(process.env.READER_TEST_EXECUTABLE ? { executablePath: process.env.READER_TEST_EXECUTABLE, args: [] } : { args: ['.'] }), env: { ...process.env, PAPER_READER_DATA_DIR: dataDir } });
  page = await app.firstWindow();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); if (message.type() === 'error') errors.push(message.text()); });
  await page.getByRole('heading', { name: '全部论文' }).waitFor();
}
async function chooseFiles(files) {
  if (await page.getByRole('button', { name: '关闭导入结果', exact: true }).count()) await page.getByRole('button', { name: '关闭导入结果', exact: true }).click();
  await app.evaluate(({ dialog }, files) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files }); }, files);
  await page.getByRole('button', { name: '导入 PDF', exact: true }).click();
  await page.locator('.rp-import-results').waitFor();
}
async function waitRendered(expected) {
  if (expected !== undefined) await page.waitForFunction(n => document.querySelector('[aria-label="页码"]')?.value === String(n), expected);
  await page.locator('.rp-pane-heading').filter({ hasText: '可选择与复制文字' }).waitFor();
}
async function openCard(index = 0) { await page.locator('.rp-card-title').nth(index).click();await page.getByRole('button',{name:'PDF 原稿',exact:true}).click(); await waitRendered(); }
async function back() { await page.getByRole('button', { name: '返回文献库', exact: true }).click(); await page.locator('.rp-library').waitFor(); }
try {
  await launch();
  await check('empty real library and isolated demo entry', async () => { await page.getByRole('heading', { name: '把第一篇论文放进书架' }).waitFor(); assert.equal(await page.locator('.rp-card').count(), 0); await page.getByRole('button', { name: '独立示例体验' }).waitFor(); });
  await chooseFiles([sample]);
  await check('native chooser pipeline imports a real PDF and preserves original', async () => { assert.equal(await page.locator('.rp-card').count(), 1); assert.deepEqual(await fs.readFile(sample), makePDF()); assert.match(await page.locator('.rp-import-results').innerText(), /已导入/); });
  await chooseFiles([sample, damaged, path.resolve('tests/encrypted.pdf')]);
  await check('duplicate, encrypted and corrupt imports are isolated', async () => { assert.equal(await page.locator('.rp-card').count(), 1); assert.match(await page.locator('.rp-import-results').innerText(), /已在文献库/); assert.match(await page.locator('.rp-import-results').innerText(), /损坏|不受支持/); assert.match(await page.locator('.rp-import-results').innerText(), /加密 PDF 暂不支持/); });
  await page.getByRole('button', { name: '编辑资料', exact: true }).click();
  await page.getByLabel('文献标题', { exact: true }).fill('Fixture 阅读验收'); await page.getByLabel('文献分类', { exact: true }).fill('测试分类'); await page.getByRole('button', { name: '保存资料' }).click();
  await page.getByRole('button', { name: '收藏 Fixture 阅读验收', exact: true }).click();
  await page.getByLabel('Fixture 阅读验收 阅读状态', { exact: true }).selectOption('reading');
  await check('metadata/status/favorite saved through UI', async () => { const [doc] = await page.evaluate(() => window.reader.list()); assert.equal(doc.category, '测试分类'); assert.equal(doc.favorite, 1); assert.equal(doc.status, 'reading'); });
  await openCard();
  await check('PDF canvas and selectable text layer are real', async () => {
    assert.equal(await page.locator('.rp-page > canvas').count(), 1);
    assert.match(await page.locator('.textLayer').innerText(), /Reader fixture page 1/);
    const nonWhite = await page.locator('.rp-page > canvas').evaluate(c => { const ctx = c.getContext('2d'); const data = ctx.getImageData(0, 0, c.width, c.height).data; return data.some((v, i) => i % 4 !== 3 && v < 200); }); assert.ok(nonWhite);
    const span = page.locator('.textLayer span').first(); const rect = await span.boundingBox();
    await page.mouse.move(rect.x + 2, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(rect.x + rect.width - 2, rect.y + rect.height / 2, { steps: 15 }); await page.mouse.up();
    assert.match(await page.evaluate(() => window.getSelection().toString()), /Reader fixture/);
  });
  await check('native outline navigation', async () => { await page.getByRole('button', { name: 'Chapter final', exact: true }).click(); await waitRendered(3); assert.equal(await page.getByLabel('页码', { exact: true }).inputValue(), '3'); });
  await check('page controls and exact page entry', async () => { await page.getByRole('button', { name: '上一页', exact: true }).click(); await waitRendered(2); assert.equal(await page.getByLabel('页码', { exact: true }).inputValue(), '2'); await page.getByLabel('页码', { exact: true }).fill('1'); await page.getByLabel('页码', { exact: true }).press('Enter'); await waitRendered(1); });
  await check('full text search and page result navigation', async () => { await page.getByLabel('搜索 PDF 全文', { exact: true }).fill('evidence 2'); await page.getByRole('button', { name: '执行全文搜索', exact: true }).click(); await page.locator('.rp-hit').waitFor(); await page.locator('.rp-hit').click(); await waitRendered(2); assert.equal(await page.getByLabel('页码', { exact: true }).inputValue(), '2'); });
  await check('real translation modes never show sample translations', async () => { await page.getByRole('button', { name: '双语对照', exact: true }).click(); await page.locator('.rp-en').first().waitFor(); assert.ok(!(await page.locator('[data-side="zh"] .rp-content-scroll').innerText()).includes('模拟'));  await page.getByRole('button', { name: '中文精读', exact: true }).click(); await page.locator('.rp-en').first().waitFor(); assert.ok(!(await page.locator('[data-side="zh"] .rp-content-scroll').innerText()).includes('模拟'));  await page.getByRole('button', { name: 'PDF 原稿', exact: true }).click(); await waitRendered(); });
  await check('zoom and normalized page offset', async () => { await page.getByLabel('PDF 缩放', { exact: true }).selectOption('1.5'); await waitRendered(); await page.locator('.rp-pdf-scroll').evaluate(el => { el.scrollTop = 320; el.dispatchEvent(new Event('scroll', { bubbles: true })); }); await page.waitForFunction(() => document.querySelector('.rp-pdf-scroll').scrollTop >= 319); });
  await page.screenshot({ path: path.join(root, 'desktop-reader.png') });
  // Close immediately after scrolling: the quit handshake must flush the latest position.
  await app.close();
  await launch();
  await check('library survives full process exit', async () => { assert.equal(await page.locator('.rp-card').count(), 1); const [doc] = await page.evaluate(() => window.reader.list()); assert.equal(doc.title, 'Fixture 阅读验收'); assert.equal(doc.favorite, 1); assert.equal(doc.status, 'reading'); assert.equal(doc.category, '测试分类'); assert.equal(doc.page, 2); assert.ok(doc.offset > 0.2); assert.equal(doc.zoom, '1.5'); });
  await openCard();
  await check('reading page, zoom and within-page scroll restore', async () => { assert.equal(await page.getByLabel('页码', { exact: true }).inputValue(), '2'); assert.equal(await page.getByLabel('PDF 缩放', { exact: true }).inputValue(), '1.5'); const scrollTop = await page.locator('.rp-pdf-scroll').evaluate(el => el.scrollTop); assert.ok(Math.abs(scrollTop - 320) < 3, `restored scroll ${scrollTop}`); });
  await back();
  await check('Finder-style dropped native file enters import pipeline', async () => {
    await page.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'test-drop'; document.body.append(input); });
    await page.locator('#test-drop').setInputFiles(noText);
    await page.locator('#test-drop').evaluate(el => { const transfer = new DataTransfer(); transfer.items.add(el.files[0]); document.querySelector('.rp-library').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })); el.remove(); });
    await page.waitForFunction(() => document.querySelectorAll('.rp-card').length === 2);
  });
  await openCard(0);
  await check('no text/outline state is explicit', async () => { await page.getByText('此页没有可提取文字，可能是扫描页；可查看原页，OCR 尚未接入。', { exact: true }).waitFor(); await page.getByText('此 PDF 没有内嵌目录，可通过页码或全文搜索导航。', { exact: true }).waitFor(); });
  await back(); await chooseFiles([long]); await openCard(0);
  await check('180-page document renders only one page at a time', async () => { assert.equal(await page.locator('.rp-page > canvas').count(), 1); await page.getByLabel('页码', { exact: true }).fill('180'); await page.getByLabel('页码', { exact: true }).press('Enter'); await waitRendered(180); assert.match(await page.locator('.textLayer').innerText(), /page 180/); });
  await back();
  for (const name of ['attention', 'bert']) {
    const file = path.join(root, 'samples', `${name}.pdf`);
    try { await fs.access(file); } catch { console.log(`SKIP ${name}: sample not downloaded`); continue; }
    await chooseFiles([file]); await openCard(0);
    await check(`real paper ${name}: rendering, text, search, final page`, async () => {
      assert.ok((await page.locator('.textLayer').innerText()).length > 100);
      await page.getByLabel('搜索 PDF 全文', { exact: true }).fill(name === 'attention' ? 'attention' : 'BERT');
      await page.getByRole('button', { name: '执行全文搜索', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.rp-hint')?.textContent.includes('包含匹配文字'), null, { timeout: 60000 });
      assert.ok(await page.locator('.rp-hit').count() > 2);
      await page.screenshot({ path: path.join(root, `paper-${name}.png`) });
      const docs = await page.evaluate(() => window.reader.list()); const doc = docs.find(d => d.original_name === `${name}.pdf`);
      await page.getByLabel('页码', { exact: true }).fill(String(doc.pages)); await page.getByLabel('页码', { exact: true }).press('Enter'); await waitRendered(doc.pages);
      assert.equal(await page.locator('.rp-page > canvas').count(), 1);
    });
    await back();
  }
  await page.screenshot({ path: path.join(root, 'desktop-library.png') });
  await check('renderer has no Node access', async () => { assert.equal(await page.evaluate(() => typeof window.require), 'undefined'); });
  await check('no unexpected renderer errors', async () => { const unexpected = errors.filter(e => !e.includes('Invalid PDF structure') && !e.includes('broken')); assert.deepEqual(unexpected, []); });
  await app.close(); app = null;
  await fs.writeFile(path.join(root, 'desktop-results.json'), JSON.stringify({ target: process.env.READER_TEST_EXECUTABLE || 'development Electron with production assets', results, errors, warnings, dataDir }, null, 2));
  console.log(`${results.length} desktop checks passed. Test data: ${dataDir}`);
} catch (error) {
  if (page && !page.isClosed()) { await page.screenshot({ path: path.join(root, 'desktop-failure.png') }).catch(() => {}); console.log(await page.locator('body').innerText().catch(() => '')); }
  await fs.writeFile(path.join(root, 'desktop-results.json'), JSON.stringify({ results, errors, warnings, failed: String(error), dataDir }, null, 2));
  throw error;
} finally { if (app) await app.close().catch(() => {}); }
