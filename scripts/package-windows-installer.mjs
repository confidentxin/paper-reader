import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const payload = path.resolve('release/windows/Paper Reader-win32-x64');
const app = path.join(payload, 'resources/app.asar');
assert.equal(JSON.parse(asar.extractFile(app, 'package.json')).version, pkg.version);
// Refuse to wrap a stale runtime bundle after a source change.
for (const file of await fs.readdir('electron')) {
  if (file.endsWith('.cjs')) assert.deepEqual(asar.extractFile(app, `electron/${file}`), await fs.readFile(`electron/${file}`));
}
const files = [], dirs = [];
async function walk(dir, prefix = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    assert.ok(!/[\r\n"$]/.test(relative), `Unsupported installer path: ${relative}`);
    if (entry.isDirectory()) { dirs.push(relative); await walk(path.join(dir, entry.name), relative); }
    else { assert.ok(entry.isFile(), `Unsupported payload entry: ${relative}`); files.push(relative); }
  }
}
await walk(payload);
const staging = path.resolve('.packaging-windows-installer');
await fs.mkdir(staging, { recursive: true });
const uninstall = path.join(staging, 'uninstall-files.nsh');
await fs.writeFile(uninstall, [
  ...files.sort().map(f => `Delete "$INSTDIR\\${f.replaceAll('/', '\\')}"`),
  ...dirs.sort((a,b) => b.split('/').length - a.split('/').length).map(d => `RMDir "$INSTDIR\\${d.replaceAll('/', '\\')}"`),
].join('\n') + '\n');
// Installer revision is independent of the unchanged application version.
const revision = 2;
const output = path.resolve(`release/Paper-Reader-${pkg.version}-Setup-r${revision}-x64.exe`);
const compiler = process.env.MAKENSIS || 'makensis';
const flag = process.platform === 'win32' ? '/' : '-';
execFileSync(compiler, [`${flag}V3`, `${flag}DVERSION=${pkg.version}`, `${flag}DINSTALLER_REVISION=${revision}`, `${flag}DPAYLOAD=${payload}`, `${flag}DOUTPUT=${output}`,
  `${flag}DUNINSTALL_FILES=${uninstall}`, `${flag}DNSIS_LICENSE=${path.resolve('scripts/windows/NSIS-COPYING.txt')}`,
  path.resolve('scripts/windows/installer.nsi')], { stdio: 'inherit' });
console.log(`Installer: ${output} (${files.length} payload files)`);
