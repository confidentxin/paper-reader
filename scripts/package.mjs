import fs from 'node:fs/promises';
import path from 'node:path';
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
const root = path.resolve('.packaging');
await fs.rm(root, { recursive: true, force: true });
await fs.mkdir(root, { recursive: true });
await fs.cp('dist', path.join(root, 'dist'), { recursive: true });
await fs.cp('electron', path.join(root, 'electron'), { recursive: true });
await fs.mkdir(path.join(root,'electron/vendor'),{recursive:true});
await fs.copyFile('node_modules/katex/dist/katex.js',path.join(root,'electron/vendor/katex.cjs'));
await fs.copyFile('node_modules/katex/LICENSE',path.join(root,'electron/vendor/KATEX_LICENSE')); 
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
// Reuse a locally cached official runtime only after verifying its package-pinned checksum.
let electronZipDir;
const zipName = `electron-v${pkg.devDependencies.electron}-darwin-${process.arch}.zip`;
try {
  const zip = await fs.readFile(path.join('artifacts', zipName));
  const checksums = JSON.parse(await fs.readFile('node_modules/electron/checksums.json', 'utf8'));
  if (createHash('sha256').update(zip).digest('hex') !== checksums[zipName]) throw new Error('Electron runtime checksum mismatch');
  electronZipDir = path.resolve('artifacts');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'paper-reader', productName: 'Paper Reader', version: pkg.version, main: 'electron/main.cjs', description: 'Local PDF paper reader' }));
const targets = await packager({ dir: root, name: 'Paper Reader', executableName: 'Paper Reader', platform: 'darwin', arch: process.arch,
  electronVersion: pkg.devDependencies.electron, appBundleId: 'local.paper-reader.desktop', out: process.env.PAPER_READER_BUILD_ROOT || path.join(os.homedir(), 'Applications', 'Paper Reader Builds'), overwrite: true, asar: true,
  appCategoryType: 'public.app-category.productivity', prune: false, electronZipDir });
for (const target of targets) {
  const bundle = path.join(target, 'Paper Reader.app');
  // iCloud/Finder metadata is not code and can invalidate an otherwise valid local signature.
  execFileSync('xattr', ['-cr', bundle]);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
  await fs.mkdir('release', { recursive: true });
  const archive = path.resolve('release', `Paper Reader-${pkg.version}-darwin-${process.arch}.zip`);
  await fs.rm(archive, { force: true });
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', bundle, archive]);
  console.log(`Mac app: ${bundle}`);
  console.log(`Archive: ${archive}`);
}
