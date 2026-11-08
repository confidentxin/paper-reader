import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bookmark, FileText, FolderOpen, LayoutGrid, Library, List, Search, Upload } from 'lucide-react';
import type { DataInfo, DocumentChange, DocumentRecord } from './desktop';
import { loadPDF, pdfError } from './pdf';
import PdfReader from './PdfReader';
import ModelSettings from './ModelSettings';
import AssistantSettings from './AssistantSettings';
const labels = { unread: '未读', reading: '阅读中', done: '已读完' };
export default function DesktopApp({ onDemo }: { onDemo(): void }) {
  const [showModel,setShowModel]=useState(false),[showAssistant,setShowAssistant]=useState(false);
  const [docs, setDocs] = useState<DocumentRecord[]>([]), [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('全部论文');
  const [view, setView] = useState<'grid' | 'list'>('grid'), [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [drag, setDrag] = useState(false);
  const [messages, setMessages] = useState<string[]>([]), [info, setInfo] = useState<DataInfo | null>(null), [showInfo, setShowInfo] = useState(false);
  const [editing, setEditing] = useState<DocumentRecord | null>(null), [title, setTitle] = useState(''), [category, setCategory] = useState('');
  const busyRef = useRef(false), flush = useRef<() => Promise<void>>(() => Promise.resolve());
  async function refresh() { setDocs(await window.reader!.list()); }
  useEffect(() => {
    if (!window.reader) { setLoading(false); return; }
    Promise.all([window.reader.list(), window.reader.info()]).then(([items, data]) => { setDocs(items); setInfo(data); }).catch(e => setMessages([`文献库读取失败：${pdfError(e)}`])).finally(() => setLoading(false));
    return window.reader.onClosing(async () => {
      try { if (busyRef.current) throw new Error('导入尚未完成，请等待后重试退出。'); await flush.current(); await window.reader!.finishClose(true); }
      catch (e) { setMessages([`尚未退出：${pdfError(e)} 请检查数据目录权限与磁盘空间后重试。`]); await window.reader!.finishClose(false); }
    });
  }, []);
  async function save(id: string, change: DocumentChange) {
    const updated = await window.reader!.update(id, change);
    setDocs(items => items.map(item => item.id === id ? updated : item));
  }
  async function change(id: string, value: DocumentChange) {
    try { await save(id, value); } catch (e) { setMessages([`保存失败：${pdfError(e)}`]); }
  }
  async function open(doc: DocumentRecord) {
    try { await save(doc.id, { last_opened: true }); setActive(doc.id); }
    catch (e) { setMessages([`打开失败：${pdfError(e)}`]); }
  }
  async function importPaths(paths: string[]) {
    if (!window.reader || busyRef.current || !paths.length) return;
    busyRef.current = true;
    setMessages([]);
    const results: string[] = [];
    try {
      for (let i = 0; i < paths.length; i++) {
        setBusy(`正在验证与导入 ${i + 1}/${paths.length}…`);
        let token: string | undefined, task: ReturnType<typeof loadPDF> | undefined;
        try {
          const staged = await window.reader.stage(paths[i]); token = staged.token;
          if (staged.duplicate) { results.push(`已在文献库中：${staged.duplicate.title}（已核对并修复文件副本）`); continue; }
          task = loadPDF(staged.data!);
          // Passwords are intentionally out of this phase; reject without opening a credential prompt.
          const pdf = await task.promise;
          await pdf.getPage(1);
          const metadata = await pdf.getMetadata();
          const metaTitle = (metadata.info as { Title?: string }).Title;
          const doc = await window.reader.commit(token!, { pages: pdf.numPages, title: (typeof metaTitle === 'string' && metaTitle.trim()) || staged.name!.replace(/\.pdf$/i, '') });
          results.push(`已导入：${doc.title} · ${doc.pages} 页`);
        } catch (e) { results.push(`导入失败：${paths[i].split(/[\\/]/).pop()} · ${pdfError(e)}`); }
        finally { if (token) await window.reader.discard(token).catch(() => {}); await task?.destroy().catch(() => {}); }
      }
      await refresh();
    } catch (e) { results.push(`文献库刷新失败：${pdfError(e)}`); }
    finally { setMessages(results); setBusy(''); busyRef.current = false; }
  }
  async function choose() {
    if (!window.reader) { setMessages(['请运行 Mac 桌面应用导入真实 PDF；浏览器入口可查看示例。']); return; }
    try { const paths = await window.reader.choose(); await importPaths(paths); }
    catch (e) { setMessages([pdfError(e)]); }
  }
  const categories = [...new Set(docs.map(d => d.category))].sort();
  const visible = useMemo(() => docs.filter(d => (!query || `${d.title} ${d.original_name}`.toLowerCase().includes(query.toLowerCase())) && (filter === '全部论文' || (filter === '收藏' ? d.favorite : d.category === filter))).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'import' ? b.imported_at.localeCompare(a.imported_at) : (b.last_opened || b.imported_at).localeCompare(a.last_opened || a.imported_at)), [docs, query, filter, sort]);
  const current = docs.find(d => d.id === active);
  if (current) return <PdfReader key={current.id} doc={current} save={save} onBack={() => setActive(null)} registerFlush={fn => { flush.current = fn; }} />;
  return <div className={`rp-library ${drag ? 'rp-dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); if (!window.reader) return; const paths = Array.from(e.dataTransfer.files).map(file => window.reader!.pathForFile(file)).filter(Boolean); if (paths.length) void importPaths(paths); else setMessages(['请从 Finder 拖入本地 PDF 文件。']); }}>
    {drag && <div className="rp-drop-overlay"><Upload size={42} /><h2>放入本地 PDF</h2><p>保留原文件 · 复制到文献库</p></div>}
    <aside className="rp-sidebar"><div className="brand"><span className="brand-symbol"><BookOpen size={23} /></span><span>阅纸<span className="brand-en">PAPER READER</span></span></div><div className="workspace-label">我的工作区 <span>本地</span></div>{['全部论文', '收藏'].map(f => <button className={`nav-item ${filter === f ? 'selected' : ''}`} key={f} onClick={() => setFilter(f)}>{f === '收藏' ? <Bookmark size={16} /> : <Library size={16} />}<span>{f}</span><small>{f === '收藏' ? docs.filter(d => d.favorite).length : docs.length}</small></button>)}<div className="nav-section-label">分类</div>{categories.map((c, i) => <button className={`nav-item ${filter === c ? 'selected' : ''}`} key={c} onClick={() => setFilter(c)}><span className={`category-dot dot-${i % 3}`} /><span>{c}</span><small>{docs.filter(d => d.category === c).length}</small></button>)}<div className="rp-sidebar-bottom"><div className="demo-note"><FileText size={17} /><div><b>真实本地阅读</b><p>文件与进度保存在此 Mac。<br />解析与中文翻译 · 可配置模型。</p></div></div><button className="nav-item" onClick={()=>setShowModel(true)}><BookOpen size={16}/><span>翻译模型设置</span></button><button className="nav-item" onClick={()=>setShowAssistant(true)}><BookOpen size={16}/><span>AI 助读设置</span></button><button className="nav-item" onClick={() => setShowInfo(true)}><FolderOpen size={16} /><span>数据与版本</span></button><button className="nav-item" onClick={onDemo}><BookOpen size={16} /><span>独立示例体验</span></button><small>名称与视觉仍为暂定</small></div></aside>
    <main className="rp-library-main"><header className="rp-library-top"><span>个人文献库 / 本地 PDF</span><button className="secondary" disabled={!!busy} onClick={() => void choose()}><Upload size={15} />导入 PDF</button></header><div className="library-content"><div className="page-heading"><div><div className="eyebrow">YOUR READING SPACE</div><h1>{filter}<span>{visible.length}</span></h1><p>从一篇论文开始，留住每一次阅读的位置。</p></div></div>
      {!window.reader && <div className="rp-page-notice">这是浏览器预览。真实导入与保存请使用 Mac 应用（npm run desktop）。<button onClick={onDemo}>查看交互示例 →</button></div>}
      {busy && <div className="rp-page-notice" role="status">{busy} · 请等待完成后退出应用</div>}
      {messages.length > 0 && <div className="rp-import-results" role="status"><button className="rp-dismiss" aria-label="关闭导入结果" onClick={() => setMessages([])}>×</button>{messages.map((m, i) => <p key={i}>{m}</p>)}</div>}
      <div className="library-toolbar"><label className="search-box"><Search size={16} /><input aria-label="搜索文献标题" placeholder="搜索标题或文件名…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="toolbar-right"><select aria-label="文献排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近阅读</option><option value="import">最近导入</option><option value="title">标题排序</option></select><div className="view-switch"><button className={`icon-btn ${view === 'grid' ? 'active' : ''}`} aria-label="卡片视图" onClick={() => setView('grid')}><LayoutGrid size={17} /></button><button className={`icon-btn ${view === 'list' ? 'active' : ''}`} aria-label="列表视图" onClick={() => setView('list')}><List size={17} /></button></div></div></div>
      {loading ? <div className="empty-state"><h2>正在读取文献库…</h2></div> : !visible.length ? <div className="empty-state"><FileText size={42} strokeWidth={1.1} /><h2>{docs.length ? '没有匹配的论文' : '把第一篇论文放进书架'}</h2><p>{docs.length ? '调整搜索或分类后重试。' : '选择或从 Finder 拖入 PDF。原始文件会保留。'}</p><button className="primary" disabled={!!busy} onClick={() => void choose()}>选择 PDF 文件</button></div> : <div className={`rp-cards rp-${view}`}>{visible.map(d => <article className="rp-card" key={d.id} data-document={d.id}><button className="rp-card-cover" aria-label={`阅读 ${d.title}`} onClick={() => void open(d)}><FileText size={42} strokeWidth={1} /><span>PDF · {d.pages} 页</span></button><div className="rp-card-body"><div className="rp-card-meta"><span>{d.category}</span><button className={`icon-btn ${d.favorite ? 'active' : ''}`} aria-label={`${d.favorite ? '取消收藏' : '收藏'} ${d.title}`} onClick={() => void change(d.id, { favorite: d.favorite ? 0 : 1 })}><Bookmark size={17} fill={d.favorite ? 'currentColor' : 'none'} /></button></div><button className="rp-card-title" onClick={() => void open(d)}>{d.title}</button><p className="rp-file-name" title={d.original_name}>{d.original_name}</p><div className="rp-card-status"><select aria-label={`${d.title} 阅读状态`} value={d.status} onChange={e => void change(d.id, { status: e.target.value as DocumentRecord['status'] })}>{Object.entries(labels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><span>第 {d.page}/{d.pages} 页</span><button onClick={() => { setEditing(d); setTitle(d.title); setCategory(d.category); }}>编辑资料</button></div></div></article>)}</div>}
      <footer className="library-footer"><span>原文件保留 · SQLite 保存文献与位置</span><span>真实文献 · 与示例隔离</span></footer>
    </div></main>
    {showAssistant&&<AssistantSettings onClose={()=>setShowAssistant(false)}/>} {showModel&&<ModelSettings onClose={()=>setShowModel(false)}/>}
    {(showInfo || editing) && <div className="modal-backdrop" onClick={() => { setShowInfo(false); setEditing(null); }}><section className="modal" role="dialog" aria-modal="true" aria-label={editing ? '编辑文献资料' : '数据与版本'} onClick={e => e.stopPropagation()}><button className="rp-dismiss" aria-label="关闭弹窗" onClick={() => { setShowInfo(false); setEditing(null); }}>×</button>{editing ? <form className="rp-edit" onSubmit={async e => { e.preventDefault(); try { await save(editing.id, { title, category }); setEditing(null); } catch (error) { setMessages([`保存失败：${pdfError(error)}`]); } }}><h2>编辑文献资料</h2><label>标题<input aria-label="文献标题" value={title} onChange={e => setTitle(e.target.value)} required maxLength={1000} /></label><label>分类<input aria-label="文献分类" value={category} onChange={e => setCategory(e.target.value)} required maxLength={1000} list="categories" /><datalist id="categories">{categories.map(c => <option key={c}>{c}</option>)}</datalist></label><button className="primary" disabled={!title.trim() || !category.trim()}>保存资料</button></form> : <><h2>数据与版本</h2><p>所有论文副本和文献记录均在本机保存。备份时请先退出应用，再复制整个数据目录。</p><div className="boundary-box"><b>实际数据目录</b><p className="rp-data-path">{info?.directory || '浏览器不保存真实文献'}</p><p>library.sqlite：文献、译文、位置、批注与选段问答<br />documents/：PDF 原始副本<br />incoming/：导入临时文件</p></div>{info && <><p>版本 {info.version} · Electron {info.electron}<br />Node {info.node} · SQLite 数据版本 4</p><button className="secondary" onClick={async () => { const error = await window.reader!.showData(); if (error) setMessages([error]); }}>在 Finder 显示数据目录</button></>}<p>真实正文支持持久高亮、笔记与 Markdown 导出。翻译和选段问答需要配置模型并主动开始。未提供云同步或 OCR；独立示例笔记仍只保留在会话内。</p></>}</section></div>}
  </div>;
}
