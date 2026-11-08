# Paper Reader · 论文阅读器

**[下载 Mac 0.5.9（Apple Silicon）](https://github.com/confidentxin/paper-reader/releases/download/v0.5.9/Paper-Reader-0.5.9-macOS-arm64.zip)** · **[下载 Windows 0.5.9（x64 预览版）](https://github.com/confidentxin/paper-reader/releases/download/v0.5.9/Paper-Reader-0.5.9-windows-x64.zip)** · [所有版本](https://github.com/confidentxin/paper-reader/releases)

面向个人论文阅读的本地桌面应用，支持中英文重排双栏、中文精读和独立 PDF 原稿核对。

## 安装

- **Mac**：解压 ZIP，将 `Paper Reader.app` 移到应用程序目录后打开。当前提供 M 系列芯片版本，Intel Mac 尚未提供。应用未经过 Apple Developer ID 签名和公证，首次打开可能需要按系统提示在“系统设置 → 隐私与安全性”允许打开。
- **Windows**：完整解压到可写目录，打开其中的 `Paper Reader.exe`；不要在 ZIP 内运行或只复制 exe。提供 x64 免安装预览包，没有安装器、自动更新或代码签名。[Windows 使用与迁移说明](docs/windows.md)。Windows 已完成交叉构建与包检查，尚未完成 Windows 实机验收。
- **升级**：先正常退出并备份整个文献库，再替换程序。数据目录可在“数据与版本”中查看。旧版本下载保留在“所有版本”。

## 功能

- 导入本地 PDF，管理文献库并保存阅读位置，保留原始 PDF。
- 中英文重排双栏独立滚动，选文查看对侧对应；中文精读保留可识别图表和公式，随时返回 PDF 原稿核对。
- 全文翻译支持暂停、恢复与缓存；未完成翻译和不可靠定位会显示状态。
- 选文后提供“标注、笔记、问 AI”；标注可选黄、绿、粉色，已有高亮可改色或取消。用户笔记、译文和 AI 回答分别保存。
- 重排中的公式按整个数学单元标注；PDF 原稿可选文字也支持标注。图片/扫描公式没有可选文字时不提供 OCR。
- 右侧持续论文对话，选段可主动加入上下文。默认参考论文背景、当前段落、附近正文和近期已完成问答，也可显式切换整篇论文范围；实际范围与引用可展开核对。
- API 回答流式显示；停止或断线保留未完成正文，完成后核对来源。只有主动另存的 AI 回答进入笔记导出。
- 本地文献库备份/恢复及 Markdown 笔记导出。

## 翻译与 AI 设置

应用不内置模型服务、账户或 CLI。翻译和 AI 助读可以分别配置，也可以让助读沿用翻译模型。

- **CLI**：Codex CLI、Claude Code、Gemini CLI。先在本机安装并登录，再选择类型、检测或填写绝对路径、填写实际模型 ID。Claude/Gemini 当前仅传文字，需要支持阅读器使用的无交互及工具限制参数的新版 CLI。
- **API**：提供 DeepSeek、阿里云百炼、Kimi、智谱、硅基流动、魔搭、Anthropic、OpenAI、Google Gemini、OpenRouter、Groq、Cerebras、Ollama、LM Studio、自定义服务，共 15 个入口（含本机与自定义）。支持 Chat Completions、Responses 和原生 Anthropic Messages。
- 在“翻译模型设置”配置翻译，在“AI 助读设置”或右侧“助读设置”配置聊天。模型列表需主动获取，也可手填；“测试连接”只发简短测试，不带论文。保存设置不会自动发问题或开始翻译。
- API 密钥通过系统加密保存；更换基础地址会清除旧地址密钥。首次保存若出现系统凭据授权提示，由用户本人处理。

主动开始翻译或问答时，相关论文内容会发送到所选服务，可能消耗账户额度。发送原页图片前请确认模型支持视觉；CLI/API 的权限、可用模型、费用和速度以实际账户及网络为准。普通本地阅读和批注无需模型。

## 从源码运行

技术栈：Electron、React、TypeScript、PDF.js、SQLite。建议 Node.js 24.13+ 和 npm 11；构建需联网下载依赖和 Electron。

```sh
npm ci
npm run desktop
```

```sh
npm test                 # 自动检查
npm run build            # 构建
npm run test:desktop      # 基础桌面流程检查
npm run package:mac       # 按当前 Mac 架构打包
npm run package:windows   # Windows x64 免安装 ZIP
```

开发预览：运行 `npm run dev -- --port 5173 --strictPort`，再在另一个终端运行 `npm run desktop:dev`（该命令使用 POSIX 环境变量语法）。浏览器预览不具备完整桌面文件功能。

Mac 包默认输出到 `~/Applications/Paper Reader Builds/`，Windows 包目录为 `release/windows/`，ZIP 在 `release/`。Mac 正式数据默认位于 `~/Library/Application Support/Paper Reader/`，Windows 位于 `%APPDATA%\Paper Reader`；源码开发使用独立数据目录。个人文献、凭据与内部验收资料不随源码或安装包发布。

## 当前验证与边界

0.5.9 通过 107 项自动检查，以及最终 Mac 候选包的 52 项桌面检查，覆盖多厂商配置、三个 API 协议、流式问答、停止/断线/重试、CLI 适配和双语阅读。新增厂商的行为验证使用明确的本地模拟服务和 CLI；不等于真实厂商账户或所有 CLI 版本已验证。Mac 已安装核对原数据保留；Windows 通过 x64 包结构、源码一致性和归档检查，实机启动与操作待验收。

复杂 PDF 的重排、图表识别、句组对应和公式提取可能不准确，请通过原稿核对。扫描件 OCR、跨论文检索与云同步尚未提供。真实整篇翻译质量、各服务实际连通性及长时间内存压力仍需验证；AI 译文与回答需要人工核对。

## 许可证与归属

依赖许可证与归属见 [依赖清单](docs/dependencies.md) 和 [第三方许可原文](public/THIRD_PARTY_LICENSES.txt)。本项目自身许可证尚未确定，不能将其视为 MIT 授权项目。
