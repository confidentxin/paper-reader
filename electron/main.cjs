const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Menu, safeStorage } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { LibraryStore } = require('./storage.cjs');
const { BilingualService } = require('./bilingual.cjs');

app.setName('Paper Reader');
app.setPath('userData', process.env.PAPER_READER_DATA_DIR || path.join(app.getPath('appData'), app.isPackaged ? 'Paper Reader' : 'Paper Reader Dev'));
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let annotations, bilingual, store, win, closing = false, closeAllowed = false, quitting = false;
const devURL = !app.isPackaged ? process.env.READER_DEV_URL : undefined;
if (devURL && !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(devURL)) throw new Error('Invalid development URL');
const allowedURL = devURL || 'app://reader/index.html';
function register(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame ||
      (devURL ? new URL(event.senderFrame.url).origin !== new URL(devURL).origin : event.senderFrame.url !== allowedURL)) throw new Error('不允许的调用来源。');
    return action(...args);
  });
}
function createWindow() {
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 900, minHeight: 640, title: '阅纸 · 论文阅读器', backgroundColor: '#f7f7f3',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== allowedURL && url !== `${allowedURL}/`) event.preventDefault(); });
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  closeAllowed = false; closing = false; if (bilingual) bilingual.closed = false;
  win.on('close', event => {
    if (closeAllowed) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    win.webContents.send('reader:closing');
    const timer = setTimeout(() => { if (closing) { closing = false; dialog.showErrorBox('尚未完成退出', '阅读位置保存未响应，请保留窗口并重试。'); } }, 10000);
    timer.unref();
  });
  win.on('closed', () => { win = null; if (quitting) app.quit(); });
  win.loadURL(allowedURL);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    const dist = path.resolve(__dirname, '../dist');
    protocol.handle('app', (request) => {
      const url = new URL(request.url);
      const target = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
      if (url.hostname !== 'reader' || !target.startsWith(dist + path.sep)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(target).toString());
    });
    store = await new LibraryStore(app.getPath('userData')).open();
    bilingual = new BilingualService(store, safeStorage);
    bilingual.apiFetch=net.fetch.bind(net);
    const assistant=new (require('./assistant-api.cjs').AssistantAPI)(store,bilingual,net.fetch.bind(net));
    annotations = new (require('./annotations.cjs').AnnotationService)(store,bilingual,{assistant,onChange:documentID=>{if(win&&!win.isDestroyed())win.webContents.send('annotations:changed',{documentID});}});
    register('assistant:config',()=>assistant.config());
    register('assistant:presets',()=>assistant.presets());
    register('assistant:save-config',input=>{if(annotations.pending.size)throw new Error('请先停止当前回答再修改助读设置。');return assistant.save(input);});
    register('assistant:models',input=>assistant.models(input));
    register('assistant:test',input=>assistant.test(input));
    register('annotations:pdf-source', (id,input) => annotations.pdfSources.register(id,input));
    register('annotations:list', id => annotations.list(id));
    register('annotations:save', (id,input) => annotations.save(id,input));
    register('annotations:delete', (id,note) => annotations.remove(id,note));
    register('annotations:ask', (id,input) => annotations.ask(id,input));
    register('annotations:cancel', (id,turn) => annotations.cancel(id,turn));
    register('annotations:export', async id => {
      const content=annotations.export(id), doc=store.get(id);
      const result=await dialog.showSaveDialog(win,{title:'导出论文笔记',defaultPath:doc.title.replace(/[\\/:*?"<>|]/g,'_')+'.md',filters:[{name:'Markdown',extensions:['md']}]});
      if(result.canceled||!result.filePath)return false;
      await require('node:fs/promises').writeFile(result.filePath,content,'utf8');return true;
    });
    register('bilingual:config', () => bilingual.config());
    register('bilingual:save-config', input => bilingual.saveConfig(input));
    register('bilingual:detect-cli', provider => bilingual.detectCLI(provider));
    register('bilingual:models', input => assistant.models(input,'translation'));
    register('bilingual:test', input => assistant.test(input,'translation'));
    register('bilingual:snapshot', id => bilingual.snapshot(id));
    register('bilingual:parse', (id, payload) => bilingual.saveParse(id, payload));
    register('bilingual:page-image', (id, page, image) => bilingual.pages.saveAsset(id,page,image));
    register('bilingual:position', (id, block, mode, offset) => bilingual.position(id, block, mode, offset));
    register('bilingual:start', (id, range) => bilingual.start(id, range));
    register('bilingual:resume', job => bilingual.resume(job));
    register('bilingual:stop', (job, cancel) => bilingual.stop(job, cancel));
    register('library:list', () => store.list());
    register('library:choose', async () => (await dialog.showOpenDialog(win, { title: '导入 PDF 论文', properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF 文档', extensions: ['pdf'] }] })).filePaths);
    register('library:stage', (source) => store.stage(source));
    register('library:commit', (token, metadata) => store.commit(token, metadata));
    register('library:discard', (token) => store.discard(token));
    register('library:read', (id) => store.read(id));
    register('library:update', (id, change) => store.update(id, change));
    register('library:info', () => ({ directory: app.getPath('userData'), version: app.getVersion(), electron: process.versions.electron, node: process.versions.node }));
    register('library:show-data', () => shell.openPath(app.getPath('userData')));
    register('library:finish-close', async success => {
      closing = false;
      if (success === true) { await annotations.close(); await bilingual.close(); closeAllowed = true; setImmediate(() => win?.close()); }
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '阅纸', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] },
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '视图', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'togglefullscreen' }] },
      { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    ]));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => { dialog.showErrorBox('无法打开文献库', `${error.message}\n数据目录：${app.getPath('userData')}\n请保留此目录并检查权限与剩余空间。`); app.quit(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', event => { if (win && !closeAllowed) { event.preventDefault(); quitting = true; win.close(); } });
  app.on('will-quit', () => store?.close());
}
