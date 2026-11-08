# 依赖与归属

日期：2026-10-28。来源：实际安装包的 package.json 与许可文件；精确依赖树见 package-lock.json。

实际运行：React、React DOM（MIT），Lucide React（ISC），PDF.js / pdfjs-dist（Apache-2.0），Electron（MIT，另保留 Chromium 与运行时第三方声明），SQLite 通过 Electron 内置 node:sqlite 使用。PDF.js 随附字体、CMap、WASM 许可原文一并归档。打包工具 @electron/packager（BSD-2-Clause），验证工具 Playwright（Apache-2.0）。构建依赖包含 Vite、React 插件（MIT）与 TypeScript（Apache-2.0）。主进程使用 Electron、内置 Node 模块及随包保留许可的 KaTeX 校验器；打包时不带开发 node_modules。阶段 3.2 新增 KaTeX 0.19.0（MIT）及其类型声明，0.3.4 起同时用于主进程公式语法校验与正文行内/独立公式渲染（trust=false）；软件与字体声明随构建保留。解析、队列和提供商适配为本项目代码。0.3.1 的图表提取与裁剪继续使用相同版本 PDF.js 与浏览器 canvas，未引入新的运行时库；测试中的 @napi-rs/canvas 已在原依赖清单中，未打入应用。Codex CLI 作为用户已有的外部程序调用，当前本机验证版本为 0.163.0-alpha.11.2；应用包不复制或分发 CLI 二进制与登录凭据，其权限与账户条款由 CLI 提供方管理。阶段 3.2 借鉴 EasyRead 的页面视觉翻译流程，未复制 EasyRead 或 Reader 的项目源码。

自制加密测试夹具生成时使用环境自带 pypdf 6.10.0（BSD-3-Clause），只在可选维护脚本中使用，不是应用或 npm 运行依赖；许可保留在 [tests/PYPDF_LICENSE.txt](../tests/PYPDF_LICENSE.txt)。完整已安装依赖清单如下，许可原文合并保留在 [THIRD_PARTY_LICENSES.txt](../public/THIRD_PARTY_LICENSES.txt)，也随构建输出复制。可运行 npm run licenses 从安装目录重新生成。阶段 4 的批注、来源校验、论文连续对话及 Markdown 导出为项目自有实现，复用既有提供商与 CSS Custom Highlight API，未新增依赖或复制外部代码。此记录不决定本项目的发布许可证。

| 包 | 实际版本 | 声明许可 | 包内许可/声明文件 |
| --- | --- | --- | --- |
| @babel/code-frame | 7.29.7 | MIT | LICENSE |
| @babel/compat-data | 7.29.7 | MIT | LICENSE |
| @babel/core | 7.29.7 | MIT | LICENSE |
| @babel/generator | 7.29.8 | MIT | LICENSE |
| @babel/helper-compilation-targets | 7.29.7 | MIT | LICENSE |
| @babel/helper-globals | 7.29.7 | MIT | LICENSE |
| @babel/helper-module-imports | 7.29.7 | MIT | LICENSE |
| @babel/helper-module-transforms | 7.29.7 | MIT | LICENSE |
| @babel/helper-plugin-utils | 7.29.7 | MIT | LICENSE |
| @babel/helper-string-parser | 7.29.7 | MIT | LICENSE |
| @babel/helper-validator-identifier | 7.29.7 | MIT | LICENSE |
| @babel/helper-validator-option | 7.29.7 | MIT | LICENSE |
| @babel/helpers | 7.29.10 | MIT | LICENSE |
| @babel/parser | 7.29.9 | MIT | LICENSE |
| @babel/plugin-transform-react-jsx-self | 7.29.7 | MIT | LICENSE |
| @babel/plugin-transform-react-jsx-source | 7.29.7 | MIT | LICENSE |
| @babel/template | 7.29.7 | MIT | LICENSE |
| @babel/traverse | 7.29.10 | MIT | LICENSE |
| @babel/types | 7.29.8 | MIT | LICENSE |
| @electron-internal/extract-zip | 1.0.5 | BSD-2-Clause | 包内未附文本，参见相应主包声明 |
| @electron/asar | 4.3.1 | MIT | LICENSE.md |
| @electron/get | 5.1.0 | MIT | LICENSE |
| @electron/notarize | 3.1.2 | MIT | LICENSE |
| @electron/osx-sign | 2.7.1 | BSD-2-Clause | LICENSE |
| @electron/packager | 20.3.0 | BSD-2-Clause | LICENSE |
| @electron/universal | 3.0.6 | MIT | LICENSE |
| @electron/windows-sign | 2.1.0 | BSD-2-Clause | LICENSE |
| @esbuild/darwin-arm64 | 0.28.2 | MIT | 包内未附文本，参见相应主包声明 |
| @jridgewell/gen-mapping | 0.3.13 | MIT | LICENSE |
| @jridgewell/remapping | 2.3.5 | MIT | LICENSE |
| @jridgewell/resolve-uri | 3.1.2 | MIT | LICENSE |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT | LICENSE |
| @jridgewell/trace-mapping | 0.3.31 | MIT | LICENSE |
| @malept/cross-spawn-promise | 2.0.0 | Apache-2.0 | LICENSE |
| @napi-rs/canvas | 1.0.11 | MIT | LICENSE |
| @napi-rs/canvas-darwin-arm64 | 1.0.11 | MIT | 包内未附文本，参见相应主包声明 |
| @rolldown/pluginutils | 1.0.0-rc.3 | MIT | LICENSE |
| @rollup/rollup-darwin-arm64 | 4.64.7 | MIT | 包内未附文本，参见相应主包声明 |
| @types/babel__core | 7.20.5 | MIT | LICENSE |
| @types/babel__generator | 7.27.0 | MIT | LICENSE |
| @types/babel__template | 7.4.4 | MIT | LICENSE |
| @types/babel__traverse | 7.28.0 | MIT | LICENSE |
| @types/estree | 1.0.9 | MIT | LICENSE |
| @types/katex | 0.16.8 | MIT | LICENSE |
| @types/node | 24.19.2 | MIT | LICENSE |
| @types/react | 19.3.0 | MIT | LICENSE |
| @types/react-dom | 19.3.0 | MIT | LICENSE |
| @vitejs/plugin-react | 5.2.0 | MIT | LICENSE |
| @xmldom/xmldom | 0.9.12 | MIT | LICENSE |
| balanced-match | 4.0.4 | MIT | LICENSE.md |
| base64-js | 1.5.1 | MIT | LICENSE |
| baseline-browser-mapping | 2.11.29 | Apache-2.0 | LICENSE.txt |
| brace-expansion | 5.0.12 | MIT | LICENSE |
| browserslist | 4.29.3 | MIT | LICENSE |
| caniuse-lite | 1.0.30001816 | CC-BY-4.0 | LICENSE |
| commander | 9.5.0 | MIT | LICENSE |
| commander | 15.0.0 | MIT | LICENSE |
| convert-source-map | 2.0.0 | MIT | LICENSE |
| cross-spawn | 7.0.6 | MIT | LICENSE |
| csstype | 3.2.3 | MIT | LICENSE |
| debug | 4.4.3 | MIT | LICENSE |
| electron | 44.8.0 | MIT | LICENSE |
| electron-to-chromium | 1.5.458 | ISC | LICENSE |
| env-paths | 3.0.0 | MIT | license |
| err-code | 2.0.3 | MIT | 包内未附文本，参见相应主包声明 |
| esbuild | 0.28.2 | MIT | LICENSE.md |
| escalade | 3.2.0 | MIT | license |
| fdir | 6.5.0 | MIT | LICENSE |
| filename-reserved-regex | 3.0.0 | MIT | license |
| filenamify | 6.0.0 | MIT | license |
| flora-colossus | 3.0.2 | MIT | LICENSE |
| fsevents | 2.3.3 | MIT | LICENSE |
| galactus | 2.0.2 | MIT | LICENSE |
| gensync | 1.0.0-beta.2 | MIT | LICENSE |
| glob | 13.0.6 | BlueOak-1.0.0 | LICENSE.md |
| graceful-fs | 4.2.11 | ISC | LICENSE |
| isbinaryfile | 4.0.10 | MIT | LICENSE.txt |
| isexe | 2.0.0 | ISC | LICENSE |
| js-tokens | 4.0.0 | MIT | LICENSE |
| jsesc | 3.1.0 | MIT | LICENSE-MIT.txt |
| json5 | 2.2.3 | MIT | LICENSE.md |
| junk | 4.0.1 | MIT | license |
| katex | 0.19.0 | MIT | LICENSE |
| lru-cache | 5.1.1 | ISC | LICENSE |
| lru-cache | 11.5.3 | BlueOak-1.0.0 | LICENSE.md |
| lucide-react | 0.468.0 | ISC | LICENSE |
| minimatch | 10.2.6 | BlueOak-1.0.0 | LICENSE.md |
| minipass | 7.1.3 | BlueOak-1.0.0 | LICENSE.md |
| ms | 2.1.3 | MIT | license.md |
| nanoid | 3.3.20 | MIT | LICENSE |
| node-releases | 2.0.59 | MIT | LICENSE |
| path-key | 3.1.1 | MIT | license |
| path-scurry | 2.0.2 | BlueOak-1.0.0 | LICENSE.md |
| pdfjs-dist | 6.4.299 | Apache-2.0 | LICENSE |
| pe-library | 1.0.1 | MIT | LICENSE |
| picocolors | 1.1.1 | ISC | LICENSE |
| picomatch | 4.0.7 | MIT | LICENSE |
| playwright | 1.64.1 | Apache-2.0 | LICENSE, NOTICE, ThirdPartyNotices.txt |
| playwright-core | 1.64.1 | Apache-2.0 | LICENSE, NOTICE, ThirdPartyNotices.txt |
| plist | 3.1.1 | MIT | LICENSE |
| postcss | 8.5.30 | MIT | LICENSE |
| postject | 1.0.0-alpha.6 | MIT | LICENSE |
| progress | 2.0.3 | MIT | LICENSE |
| promise-retry | 2.0.1 | MIT | LICENSE |
| react | 19.3.1 | MIT | LICENSE |
| react-dom | 19.3.1 | MIT | LICENSE |
| react-refresh | 0.18.0 | MIT | LICENSE |
| resedit | 2.0.3 | MIT | LICENSE |
| retry | 0.12.0 | MIT | License |
| rollup | 4.64.7 | MIT | LICENSE.md |
| scheduler | 0.28.0 | MIT | LICENSE |
| semver | 7.8.5 | ISC | LICENSE |
| semver | 7.8.5 | ISC | LICENSE |
| semver | 7.8.5 | ISC | LICENSE |
| semver | 6.3.1 | ISC | LICENSE |
| shebang-command | 2.0.0 | MIT | license |
| shebang-regex | 3.0.0 | MIT | license |
| source-map-js | 1.2.2 | BSD-3-Clause | LICENSE |
| sumchecker | 3.0.1 | Apache-2.0 | LICENSE |
| tinyglobby | 0.2.17 | MIT | LICENSE |
| typescript | 5.9.3 | Apache-2.0 | LICENSE.txt, ThirdPartyNoticeText.txt |
| undici | 7.30.1 | MIT | LICENSE |
| undici-types | 7.24.6 | MIT | LICENSE |
| update-browserslist-db | 1.3.4 | MIT | LICENSE |
| vite | 7.3.7 | MIT | LICENSE.md |
| which | 2.0.2 | ISC | LICENSE |
| xmlbuilder | 15.1.1 | MIT | LICENSE |
| yallist | 3.1.1 | ISC | LICENSE |
| yargs-parser | 22.0.0 | ISC | LICENSE.txt |

2026-11-07 Windows 包复用同版本 Electron/Packager/KaTeX 及现有依赖，未引入第三方代码；Windows 运行时的 LICENSE、LICENSES.chromium.html 与应用许可清单一并保留。

## Windows EXE 安装器

2026-11-08 新增 NSIS 3.13，仅用于外部构建工具，无新 npm 依赖或应用运行时模块。使用 zlib 压缩；NSIS 及其组件许可原文保存在 [NSIS-COPYING.txt](../scripts/windows/NSIS-COPYING.txt)，并随安装包解压。主工具与 zlib 为 zlib/libpng 许可，原文件同时保留其他可选压缩器声明，本安装器未采用 bzip2/LZMA。参考 [官方脚本手册](https://nsis.sourceforge.io/Docs/Chapter4.html)。
