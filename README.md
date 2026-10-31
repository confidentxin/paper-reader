# Paper Reader · 论文阅读器

**[下载 Mac 版 0.5.0（Apple Silicon）](https://github.com/confidentxin/paper-reader/releases/download/v0.5.0/Paper-Reader-0.5.0-macOS-arm64.zip)** · [所有版本](https://github.com/confidentxin/paper-reader/releases)

面向个人论文阅读的本地桌面应用，支持英文／中文重排双栏、中文精读和独立 PDF 原稿核对。

## 安装

1. 下载上方 ZIP，解压，将 `Paper Reader.app` 移至“应用程序”后打开。
2. 当前仅提供 Apple Silicon（M 系列芯片）Mac 包；Intel Mac 和 Windows 尚未验证。
3. 本版本未经过 Apple Developer ID 签名与公证。首次打开可能被 macOS 拦截；确认下载来源后，可按系统提示在“系统设置 → 隐私与安全性”允许打开。无需关闭系统安全保护。

## 功能

- 导入本地 PDF，管理文献库并保存阅读位置，保留原始 PDF。
- 双栏中英文重排，两栏独立滚动；选中文字查看对侧句组对应。中文精读模式保留可识别图表，随时返回 PDF 原稿核对。
- 全文翻译任务支持暂停、恢复与缓存；未完成翻译和不可靠定位会显示相应状态。
- 持久批注、论文对话、来源跳转和 Markdown 笔记导出。用户笔记、译文与 AI 回答分别保存。
- 本地数据备份与恢复。升级或恢复前请先备份文献库。

## 翻译与 AI 设置

应用不内置模型服务或账户。请在设置中配置已安装并登录的 Codex CLI，或配置兼容 OpenAI Chat Completions 的服务地址、模型与 API Key。CLI 不随应用分发。

主动开始翻译或问答时，相关论文文本会发送给所选服务，可能消耗服务额度。普通本地阅读无需模型服务。响应速度取决于服务与网络环境。

## 从源码运行

技术栈：Electron、React、TypeScript、PDF.js、SQLite。建议 Node.js 24.13+ 和 npm 11；构建需联网下载依赖和 Electron。

```sh
npm ci
npm run desktop
```

```sh
npm test              # 自动检查
npm run build        # 构建
npm run test:desktop # 桌面流程检查
npm run package:mac  # 按当前 Mac 架构打包
```

开发预览：先运行 `npm run dev -- --port 5173 --strictPort`，再在另一个终端运行 `npm run desktop:dev`。浏览器预览不具备完整桌面文件功能。

打包结果默认在 `~/Applications/Paper Reader Builds/`，ZIP 在 `release/`。用户数据默认保存在 `~/Library/Application Support/Paper Reader/`；源码开发使用独立数据目录。个人文献、凭据与内部验收材料不随源码发布。

## 当前验证与边界

0.5.0 的本机工程验收包含 76 项自动检查与 68 项最终候选包桌面检查，以及备份恢复、解压启动、退出重开和少量真实翻译／问答样本。完整论文翻译质量、真实兼容 API 和长时间内存压力尚未完成验收。

复杂 PDF 的重排、图表识别和句组对应可能不准确，请通过原稿核对。扫描件 OCR、跨论文检索、云同步和 Windows 安装包尚未提供。AI 译文与回答需人工核对。

## 许可证与归属

依赖许可证与归属见 [依赖清单](docs/dependencies.md) 和 [第三方许可原文](public/THIRD_PARTY_LICENSES.txt)。本项目自身许可证尚未确定，不能将其视为 MIT 授权项目。

本地开发交接资料见 `docs/development-readme.md`（不随公开仓库分发）。
