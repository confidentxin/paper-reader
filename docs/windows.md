# Windows x64 使用说明

[下载 0.5.9 ZIP](https://github.com/confidentxin/paper-reader/releases/download/v0.5.9/Paper-Reader-0.5.9-windows-x64.zip) · [发布页面与校验值](https://github.com/confidentxin/paper-reader/releases/tag/v0.5.9)

## 安装与升级

完整解压 ZIP 到用户可写目录，打开 `Paper Reader-win32-x64` 中的 `Paper Reader.exe`。不要在压缩包内直接运行，也不要只复制 exe；旁边的 resources、locales、DLL 等文件需要保留。此为未签名的免安装预览包，没有安装器或自动更新。

升级前正常退出，并备份整个数据目录，再替换程序目录。Windows 数据默认位于 `%APPDATA%\Paper Reader`，实际路径以“数据与版本”显示为准。

## 翻译与助读

在“翻译模型设置”选择翻译服务；在“AI 助读设置”选择沿用翻译模型，或单独配置 API/CLI。API 可主动获取模型列表或手填模型 ID，连接测试不包含论文。

- Codex CLI：配置已安装并登录的原生 Windows `codex.exe`，需支持 exec、结构化输出与工具限制参数。
- Claude Code / Gemini CLI：使用所选 CLI 的 exe 或其 Node.js 入口文件（`.js`、`.mjs`、`.cjs`）绝对路径。应用不通过 shell 运行 `.cmd`/PowerShell 包装器，不直接调用 WSL 内的 CLI。自动检测失败时手填路径。当前仅传论文文字，不传原页图片。
- API：选择服务并填写本平台密钥和实际模型 ID。远程基础地址需 HTTPS，本机回环服务可用 HTTP；模型是否支持视觉、权限和额度以服务商账户为准。

CLI 不随应用分发，安装和登录需用户自行完成。应用不复制 CLI 登录凭据。首次保存 API 密钥如出现系统授权提示，请自行处理。

## 迁移与备份

备份整个目录，包括原 PDF、SQLite、译文/问答、批注来源缓存和独立助读配置文件。不要覆盖唯一备份，也不要在程序运行时替换 SQLite。

从 Mac 迁移时先保留 Windows 原库副本，再复制完整旧库。Mac 的 CLI 路径需重新配置；系统加密的 API 密钥不能假设跨系统解密，需要重新输入。PDF、译文、问答与用户笔记分别保存；未可靠匹配的来源会提示核对。

## 验证范围

0.5.9 Windows 包在 Mac 上交叉构建，检查了 AMD64 可执行文件、ASAR 版本与源码一致性、离线资源/许可证和 ZIP 完整性。Windows 运行时尚未实机验证，不将 Mac 的桌面检查当作 Windows 验收。

建议在 Windows 上依次验证：启动 → 中文路径 PDF 导入 → 双语/精读和原稿阅读 → 标注/笔记/取消高亮 → 退出重开 → 配置服务、小范围提问并停止 → 核对引用和导出。真实账户连接、系统凭据保存、CLI 取消与长期使用仍待验证。

## 构建

```sh
npm ci
npm run package:windows
```

使用锁定的 Electron/Packager 版本；输出目录 `release/windows/`，ZIP 位于 `release/`。保留 Electron 与应用内第三方许可，无新增依赖。SHA-256 校验值随 Release 的 `SHA256SUMS.txt` 提供。
