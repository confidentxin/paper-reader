import fs from 'node:fs';
import path from 'node:path';

// Inventory actual installed packages; keep license and notice texts with the preview.
const rows = [];
const notices = ['Third-party notices for Paper Reader', 'Generated from installed packages. See package-lock.json for the exact dependency graph.'];
function visit(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const folder = path.join(directory, entry.name);
    if (entry.name.startsWith('@')) { visit(folder); continue; }
    const manifest = path.join(folder, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const texts = fs.readdirSync(folder).filter(file => /^(licen[sc]e|copying|notice|thirdpartynotice)/i.test(file) && fs.statSync(path.join(folder, file)).isFile());
    rows.push({ name: pkg.name, version: pkg.version, license: pkg.license || 'UNSPECIFIED', texts });
    notices.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version} — ${pkg.license || 'UNSPECIFIED'}\n`);
    for (const file of texts) notices.push(`${file}\n${fs.readFileSync(path.join(folder, file), 'utf8')}`);
    visit(path.join(folder, 'node_modules'));
  }
}
visit('node_modules');
rows.sort((a, b) => a.name.localeCompare(b.name));
for (const directory of ['node_modules/pdfjs-dist/standard_fonts', 'node_modules/pdfjs-dist/wasm', 'node_modules/pdfjs-dist/cmaps', 'node_modules/electron/dist']) {
  if (!fs.existsSync(directory)) continue;
  for (const file of fs.readdirSync(directory)) {
    if (/^(licen[sc]e|notice)/i.test(file) && fs.statSync(path.join(directory, file)).isFile()) notices.push('\n' + directory + '/' + file + '\n' + fs.readFileSync(path.join(directory, file), 'utf8'));
  }
}
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/THIRD_PARTY_LICENSES.txt', notices.join('\n'));
fs.writeFileSync('docs/dependencies.md', `# 依赖与归属\n\n日期：2026-10-28。来源：实际安装包的 package.json 与许可文件；精确依赖树见 package-lock.json。\n\n实际运行：React、React DOM（MIT），Lucide React（ISC），PDF.js / pdfjs-dist（Apache-2.0），Electron（MIT，另保留 Chromium 与运行时第三方声明），SQLite 通过 Electron 内置 node:sqlite 使用。PDF.js 随附字体、CMap、WASM 许可原文一并归档。打包工具 @electron/packager（BSD-2-Clause），验证工具 Playwright（Apache-2.0）。构建依赖包含 Vite、React 插件（MIT）与 TypeScript（Apache-2.0）。主进程使用 Electron、内置 Node 模块及随包保留许可的 KaTeX 校验器；打包时不带开发 node_modules。阶段 3.2 新增 KaTeX 0.19.0（MIT）及其类型声明，0.3.4 起同时用于主进程公式语法校验与正文行内/独立公式渲染（trust=false）；软件与字体声明随构建保留。解析、队列和提供商适配为本项目代码。0.3.1 的图表提取与裁剪继续使用相同版本 PDF.js 与浏览器 canvas，未引入新的运行时库；测试中的 @napi-rs/canvas 已在原依赖清单中，未打入应用。Codex CLI 作为用户已有的外部程序调用，当前本机验证版本为 0.163.0-alpha.11.2；应用包不复制或分发 CLI 二进制与登录凭据，其权限与账户条款由 CLI 提供方管理。阶段 3.2 借鉴 EasyRead 的页面视觉翻译流程，未复制 EasyRead 或 Reader 的项目源码。\n\n自制加密测试夹具生成时使用环境自带 pypdf 6.10.0（BSD-3-Clause），只在可选维护脚本中使用，不是应用或 npm 运行依赖；许可保留在 [tests/PYPDF_LICENSE.txt](../tests/PYPDF_LICENSE.txt)。完整已安装依赖清单如下，许可原文合并保留在 [THIRD_PARTY_LICENSES.txt](../public/THIRD_PARTY_LICENSES.txt)，也随构建输出复制。可运行 npm run licenses 从安装目录重新生成。阶段 4 的批注、来源校验、论文连续对话及 Markdown 导出为项目自有实现，复用既有提供商与 CSS Custom Highlight API，未新增依赖或复制外部代码。此记录不决定本项目的发布许可证。\n\n| 包 | 实际版本 | 声明许可 | 包内许可/声明文件 |\n| --- | --- | --- | --- |\n${rows.map(r => `| ${r.name} | ${r.version} | ${r.license} | ${r.texts.join(', ') || '包内未附文本，参见相应主包声明'} |`).join('\n')}\n`);
console.log(`Recorded ${rows.length} installed packages; preserved ${rows.reduce((n, r) => n + r.texts.length, 0)} license/notice files.`);
