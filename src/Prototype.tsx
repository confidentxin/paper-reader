import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, UIEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownUp, ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Columns2, FileText, Highlighter, LayoutGrid, Library, List, LoaderCircle, MessageSquare, Minus, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Search, Settings2, Sparkles, StickyNote, Upload, X, AlertCircle, FlaskConical, Link2 } from 'lucide-react';
import { blocksFor, papers, statusLabels } from './data';
import type { Paper } from './data';

type Scene = 'normal' | 'empty' | 'parsing' | 'translating' | 'partial' | 'paused' | 'unreadable' | 'notesFail';
type Note = { id: string; paperId: string; blockId: string; text: string; sample?: boolean };
const sceneNames: Record<Scene, string> = { normal: '正常阅读', empty: '空文献库', parsing: '解析中', translating: '翻译进行中', partial: '部分翻译失败', paused: '任务暂停', unreadable: '文件不可读', notesFail: '笔记保存失败' };

function IconButton({ label, children, onClick, active = false, disabled = false }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={`icon-btn ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-symbol"><BookOpen size={23} strokeWidth={1.65} /></span>{!compact && <><span>阅纸<span className="brand-en">PAPER READER</span></span><span className="prototype-tag">原型</span></>}</div>;
}
function Formula() {
  return <div className="formula" aria-label="Attention(Q,K,V) = softmax(QK 转置除以根号 d k) V"><span>Attention(Q, K, V) = softmax</span><span className="fraction"><span>QK<sup>T</sup></span><span>√d<sub>k</sub></span></span><span>V</span><small>(1)</small></div>;
}
function Diagram() {
  return <figure className="diagram"><svg viewBox="0 0 460 150" role="img" aria-label="示例结构图：输入表示到注意力计算再到输出层">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#819386" /></marker></defs>
    <path d="M127 73 H178 M296 73 H347" stroke="#819386" strokeWidth="1.5" markerEnd="url(#arrow)" />
    <rect x="12" y="42" width="115" height="62" rx="7" fill="#eeeee7" stroke="#d9ddd4" /><rect x="179" y="31" width="118" height="84" rx="7" fill="#e3eee4" stroke="#a8bfaa" /><rect x="348" y="42" width="100" height="62" rx="7" fill="#eeeee7" stroke="#d9ddd4" />
    <g fill="#43574b" textAnchor="middle" fontFamily="sans-serif" fontSize="13"><text x="69" y="69">输入表示</text><text x="69" y="89" fontSize="10">Input embedding</text><text x="238" y="69">注意力计算</text><text x="238" y="89" fontSize="10">Attention</text><text x="398" y="69">输出层</text><text x="398" y="89" fontSize="10">Output</text></g>
  </svg><figcaption>图 1 · 简化信息流示意（通用排版样例，非论文原图）</figcaption></figure>;
}

export default function App() {
  const [paperId, setPaperId] = useState<string | null>(null);
  const [category, setCategory] = useState('全部论文');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('recent');
  const [scene, setScene] = useState<Scene>('normal');
  const [modal, setModal] = useState<'import' | 'about' | 'settings' | null>(null);
  const [toast, setToast] = useState('');
  const [favorites, setFavorites] = useState(['attention', 'vit']);
  const [statuses, setStatuses] = useState<Record<string, Paper['status']>>({});
  const [positions, setPositions] = useState<Record<string, string>>({ attention: 'attention-background' });
  const [mode, setMode] = useState<'dual' | 'focus'>('dual');
  const [outline, setOutline] = useState(window.innerWidth > 1100);
  const [aside, setAside] = useState(window.innerWidth > 1250);
  const [tab, setTab] = useState<'notes' | 'ai'>('notes');
  const [split, setSplit] = useState(50);
  const [fontSize, setFontSize] = useState(17);
  const [highlights, setHighlights] = useState<string[]>(['attention-intro']);
  const [notes, setNotes] = useState<Note[]>([{ id: 'sample-note', paperId: 'attention', blockId: 'attention-intro', sample: true, text: '值得继续追问：注意力机制如何在不依赖循环结构的情况下捕捉顺序信息？阅读后文的位置编码部分时，回到这里核对。也要区分架构的并行优势和具体实验设置带来的收益。' }]);
  const [draft, setDraft] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [peek, setPeek] = useState(false);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const syncUntil = useRef(0);
  const paper = papers.find(p => p.id === paperId);
  const blocks = useMemo(() => paper ? blocksFor(paper) : [], [paper]);
  const currentId = paper ? (positions[paper.id] || `${paper.id}-abstract`) : '';
  const currentBlock = blocks.find(b => b.id === currentId) || blocks[0];
  const paperNotes = notes.filter(n => n.paperId === paperId);
  const currentIndex = Math.max(0, blocks.findIndex(b => b.id === currentId));
  const [libraryNav, setLibraryNav] = useState(window.innerWidth > 850);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setModal(null); setPeek(false); } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!modal && !peek) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [modal, peek]);
  function scrollToBlock(id: string, behavior: ScrollBehavior = 'smooth') {
    syncUntil.current = Date.now() + 700;
    for (const ref of [leftRef, rightRef]) {
      const pane = ref.current;
      const target = pane?.querySelector<HTMLElement>(`[data-block="${id}"]`);
      if (pane && target) pane.scrollTo({ top: pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24, behavior });
    }
  }
  function navigate(id: string) {
    if (!paper) return;
    setPositions(p => ({ ...p, [paper.id]: id })); scrollToBlock(id);
  }
  useLayoutEffect(() => { if (paper) scrollToBlock(positions[paper.id] || `${paper.id}-abstract`, 'instant'); }, [mode, paperId]); // Keep the shared block across render modes.
  function onReadScroll(e: UIEvent<HTMLDivElement>, source: 'left' | 'right') {
    if (!paper || Date.now() < syncUntil.current) return;
    const pane = e.currentTarget;
    const paneTop = pane.getBoundingClientRect().top;
    const items = Array.from(pane.querySelectorAll<HTMLElement>('[data-block]'));
    const closest = items.reduce<HTMLElement | undefined>((best, el) => Math.abs(el.getBoundingClientRect().top - paneTop - 55) < Math.abs((best?.getBoundingClientRect().top ?? Infinity) - paneTop - 55) ? el : best, undefined);
    const id = closest?.dataset.block;
    if (!id || id === currentId) return;
    setPositions(p => ({ ...p, [paper.id]: id }));
    const other = source === 'left' ? rightRef.current : leftRef.current;
    const target = other?.querySelector<HTMLElement>(`[data-block="${id}"]`);
    if (other && target) { syncUntil.current = Date.now() + 160; other.scrollTo({ top: other.scrollTop + target.getBoundingClientRect().top - other.getBoundingClientRect().top - 24, behavior: 'instant' }); }
  }
  function resizeStart(e: ReactPointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
    function move(event: PointerEvent) { const rect = readingRef.current?.getBoundingClientRect(); if (rect) setSplit(Math.max(32, Math.min(68, ((event.clientX - rect.left) / rect.width) * 100))); }
    function up() { document.body.classList.remove('resizing'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function changeScene(value: Scene) { setScene(value); setSaveError(false); }
  function toggleFavorite(id: string) { setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]); }
  function saveNote() {
    if (!paper || !draft.trim()) return;
    if (scene === 'notesFail') { setSaveError(true); return; }
    setNotes(n => editingNote ? n.map(item => item.id === editingNote ? { ...item, text: draft.trim(), sample: false } : item) : [...n, { id: crypto.randomUUID(), paperId: paper.id, blockId: currentId, text: draft.trim() }]);
    setDraft(''); setEditingNote(null); setSaveError(false); setToast('笔记已保留在当前会话，刷新页面后清除。');
  }
  function openPaper(id: string) { setPaperId(id); setDraft(''); setEditingNote(null); setSaveError(false); setPeek(false); }
  const displayPapers = papers.filter(p => {
    const status = statuses[p.id] || p.status;
    const matchCategory = category === '全部论文' || category === p.category || (category === '最近阅读' && status !== 'unread') || (category === '我的收藏' && favorites.includes(p.id));
    return matchCategory && `${p.title} ${p.subtitle}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => sort === 'year' ? b.year - a.year : sort === 'title' ? a.title.localeCompare(b.title) : 0);
  function progressFor(p: Paper) {
    const status = statuses[p.id] || p.status;
    if (status === 'done') return 100;
    if (status === 'unread') return 0;
    return positions[p.id] ? Math.round((blocksFor(p).findIndex(b => b.id === positions[p.id]) + 1) / 8 * 100) : p.progress || 13;
  }
  const sceneSelect = <label className="scene-select"><FlaskConical size={14} /><span>演示场景</span><select aria-label="演示场景" value={scene} onChange={e => changeScene(e.target.value as Scene)}>{Object.entries(sceneNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><ChevronDown size={12} /></label>;
  const statusBanner = scene !== 'normal' && scene !== 'empty' ? <div className={`task-banner ${['partial', 'unreadable', 'notesFail'].includes(scene) ? 'warning' : ''}`} role="status">
    {['parsing', 'translating'].includes(scene) ? <LoaderCircle size={16} className="spin" /> : <AlertCircle size={16} />}
    <span><b>{sceneNames[scene]} · 模拟状态</b>　{({ parsing: '正在识别页面结构，示例正文仍可查看。', translating: '已完成 4 / 6 页 · 67%，不会发起真实翻译。', partial: '第 5 页译文失败，其他段落仍可阅读。', paused: '任务已暂停，已完成的示例内容保留。', unreadable: '示例文件无法打开。未读取任何本地 PDF。', notesFail: '保存笔记将演示失败反馈，输入内容会保留。' } as Record<string, string>)[scene]}</span>
    <button onClick={() => { changeScene('normal'); setToast('已恢复正常演示场景，未执行后台任务。'); }}>{scene === 'partial' ? '模拟重试' : scene === 'paused' ? '模拟继续' : '恢复正常'}</button>
  </div> : null;

  return <div className={`app ${paper ? 'reader-app' : 'library-app'}`}>
    {!paper ? <>
      {libraryNav && <button className="library-nav-scrim" aria-label="关闭文献库导航遮罩" onClick={() => setLibraryNav(false)} />}
      <aside className={`library-sidebar ${libraryNav ? '' : 'is-hidden'}`}>
        <button className="icon-btn mobile-nav-close" aria-label="关闭文献库导航" onClick={() => setLibraryNav(false)}><X size={17} /></button>
        <Logo />
        <div className="workspace-label">个人工作空间 <span>LOCAL</span></div>
        <nav aria-label="文献库导航">
          {[{ name: '全部论文', icon: Library, count: 6 }, { name: '最近阅读', icon: Clock3, count: papers.filter(p => (statuses[p.id] || p.status) !== 'unread').length }, { name: '我的收藏', icon: Bookmark, count: favorites.length }].map(item => <button className={`nav-item ${category === item.name ? 'selected' : ''}`} key={item.name} onClick={() => setCategory(item.name)}><item.icon size={18} /><span>{item.name}</span><small>{scene === 'empty' ? 0 : item.count}</small></button>)}
          <div className="nav-section-label">研究分类 <span>3</span></div>
          {['自然语言处理', '计算机视觉', '生成式模型'].map((name, i) => <button key={name} className={`nav-item category-item ${category === name ? 'selected' : ''}`} onClick={() => setCategory(name)}><span className={`category-dot dot-${i}`} /><span>{name}</span><small>{scene === 'empty' ? 0 : 2}</small></button>)}
        </nav>
        <div className="sidebar-bottom"><div className="demo-note"><FlaskConical size={17} /><div><b>把注意力，留给论文</b><p>当前为界面原型<br />所有文献均为示例数据</p></div></div><button className="nav-item" onClick={() => setModal('settings')}><Settings2 size={17} /><span>阅读偏好</span></button><button className="nav-item" onClick={() => setModal('about')}><CircleHelp size={17} /><span>关于这个原型</span><span className="version">v0.1</span></button><div className="profile"><span className="avatar">我</span><div>我的文献库<small>仅当前会话 · 未持久化</small></div><span className="online-dot" /></div></div>
      </aside>
      <main className="library-main">
        <header className="library-topbar"><div className="breadcrumb"><IconButton label={libraryNav ? '收起导航' : '展开导航'} onClick={() => setLibraryNav(!libraryNav)}>{libraryNav ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</IconButton><span>工作空间</span><ChevronRight size={13} /><b>文献库</b></div>{sceneSelect}</header>
        <div className="library-content">
          <div className="page-heading"><div><div className="eyebrow">YOUR RESEARCH, A LITTLE CLEARER.</div><h1>{category}<span>{scene === 'empty' ? 0 : displayPapers.length}</span></h1><p>读懂一篇论文，从容一点。</p></div><button className="primary" onClick={() => setModal('import')}><Plus size={17} />导入论文</button></div>
          {statusBanner}
          {scene !== 'empty' && <section className="continue-card" aria-label="继续阅读"><div className="continue-icon"><BookOpen size={29} strokeWidth={1.2} /></div><div className="continue-main"><span className="eyebrow">接着上次的思考</span><h2>Attention Is All You Need</h2><p>{positions.attention ? blocksFor(papers[0]).find(b => b.id === positions.attention)?.heading : '1  引言'}<span>·</span>阅读进度 {Math.round(((blocksFor(papers[0]).findIndex(b => b.id === positions.attention) + 1) / 8) * 100) || 38}%<span>·</span>示例文献</p></div><button className="continue-button" onClick={() => openPaper('attention')}>继续阅读<ArrowRight size={17} /></button><div className="continue-decoration" aria-hidden="true">Aa<span>知</span></div></section>}
          <div className="library-toolbar"><label className="search-box"><Search size={17} /><input aria-label="搜索论文标题" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索论文标题或中文名称…" />{query ? <IconButton label="清除搜索" onClick={() => setQuery('')}><X size={14} /></IconButton> : <span className="search-hint">标题</span>}</label><div className="toolbar-right"><label className="sort-control"><ArrowDownUp size={14} /><select aria-label="论文排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近添加</option><option value="year">发表年份</option><option value="title">标题 A–Z</option></select><ChevronDown size={12} /></label><div className="view-switch"><IconButton label="卡片视图" active={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} /></IconButton><IconButton label="列表视图" active={view === 'list'} onClick={() => setView('list')}><List size={17} /></IconButton></div></div></div>
          <div className="collection-label"><span>{query ? '搜索结果' : category === '全部论文' ? '所有文献' : category}</span><small>{scene === 'empty' ? 0 : displayPapers.length} 篇论文</small><span className="sample-label"><span />示例文献库</span></div>
          {scene === 'empty' || !displayPapers.length ? <div className="empty-state"><div className="empty-icon"><Library size={34} strokeWidth={1.2} /></div><h2>{scene === 'empty' ? '第一篇论文，从这里开始' : '没有找到匹配的论文'}</h2><p>{scene === 'empty' ? '将你的研究收在一处，慢慢读，认真想。' : '试试其他标题，或切换到全部论文。'}</p><button className="primary" onClick={() => scene === 'empty' ? setModal('import') : (setQuery(''), setCategory('全部论文'))}>{scene === 'empty' ? <><Plus size={16} />导入论文</> : '清除筛选'}</button>{scene === 'empty' && <button className="text-button" onClick={() => changeScene('normal')}>查看示例文献库 <ArrowRight size={14} /></button>}</div> : <div className={`paper-collection ${view}`}>
            {displayPapers.map(p => <article className="paper-card" key={p.id}>
              <button className={`paper-cover ${p.color}`} onClick={() => openPaper(p.id)} aria-label={`阅读 ${p.title}`}><div className="cover-top"><span>{p.venue} {p.year}</span><span>示例</span></div><div className="mini-paper"><div className="mini-title">{p.title}</div><div className="mini-authors">{p.authors}</div><div className="mini-rule" /><div className="mini-columns">{[0, 1].map(col => <div key={col}><b>{col === 0 ? 'Abstract' : '1  Introduction'}</b>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ width: `${[100, 94, 100, 83, 98, 100, 68, 100, 90][i]}%` }} />)}</div>)}</div>{p.id === 'attention' || p.id === 'diffusion' ? <div className="mini-model"><span /><span /><span /></div> : <div className="mini-formula">y = F(x) + x</div>}</div></button>
              <div className="paper-details"><div className="paper-meta"><span>{p.venue} · {p.year}</span><IconButton label={`${favorites.includes(p.id) ? '取消收藏' : '收藏'} ${p.title}`} active={favorites.includes(p.id)} onClick={() => toggleFavorite(p.id)}><Bookmark size={16} fill={favorites.includes(p.id) ? 'currentColor' : 'none'} /></IconButton></div><button className="paper-title" onClick={() => openPaper(p.id)}>{p.title}</button><p className="paper-subtitle">{p.subtitle}</p><p className="paper-authors">{p.authors}</p><div className="tags">{p.keywords.map(k => <span key={k}>{k}</span>)}</div><div className="paper-footer"><label className={`status-pill ${statuses[p.id] || p.status}`}><span /><select aria-label={`${p.title} 阅读状态`} value={statuses[p.id] || p.status} onChange={e => setStatuses(s => ({ ...s, [p.id]: e.target.value as Paper['status'] }))}>{Object.entries(statusLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><ChevronDown size={10} /></label>{(statuses[p.id] || p.status) === 'reading' ? <span className="tiny-progress"><span className="progress-track"><i style={{ width: `${progressFor(p)}%` }} /></span><small>{progressFor(p)}%</small></span> : <span className="pdf-label"><FileText size={12} />PDF 示例</span>}</div></div>
            </article>)}
          </div>}
          <footer className="library-footer"><span>为深入阅读，留一方安静的空间。</span><span>示例数据 · 刷新后重置</span></footer>
        </div>
      </main>
    </> : <>
      <header className="reader-topbar"><div className="reader-title-group"><IconButton label="返回文献库" onClick={() => setPaperId(null)}><ArrowLeft size={19} /></IconButton><div className="reader-top-divider" /><Logo compact /><div className="reader-title"><b title={paper.title}>{paper.title}</b><span>{paper.venue} {paper.year}<i>·</i>示例文献</span></div></div><div className="reader-header-actions">{sceneSelect}<IconButton label="阅读偏好" onClick={() => setModal('settings')}><Settings2 size={18} /></IconButton></div></header>
      <div className="reader-controls"><div className="controls-left"><IconButton label={outline ? '收起目录' : '展开目录'} active={outline} onClick={() => setOutline(!outline)}>{outline ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</IconButton><span className="controls-caption">阅读视图</span></div><div className="mode-switch" aria-label="阅读模式"><button className={mode === 'dual' ? 'selected' : ''} onClick={() => setMode('dual')}><Columns2 size={15} />双栏对照</button><button className={mode === 'focus' ? 'selected' : ''} onClick={() => setMode('focus')}><BookOpen size={15} />中文精读</button></div><div className="controls-right"><IconButton label="缩小正文字号" disabled={fontSize <= 14} onClick={() => setFontSize(s => s - 1)}><Minus size={15} /></IconButton><span className="font-size">{fontSize}</span><IconButton label="增大正文字号" disabled={fontSize >= 23} onClick={() => setFontSize(s => s + 1)}><Plus size={15} /></IconButton><span className="toolbar-divider" /><IconButton label={aside ? '收起辅助面板' : '展开辅助面板'} active={aside} onClick={() => setAside(!aside)}>{aside ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</IconButton></div></div>
      {statusBanner}
      <div className="reader-layout">
        {outline && <aside className="outline-panel"><div className="panel-heading"><b>论文目录</b><List size={15} /></div><div className="outline-meta"><span className="file-square"><FileText size={20} /></span><div>6 页 · 8 个示例段落<small>手工关联 · 非 PDF 解析</small></div></div><nav aria-label="论文目录">{blocks.map((b, i) => <button key={b.id} className={`${b.id === currentId ? 'selected' : ''} ${b.heading.includes('3.') ? 'subsection' : ''}`} onClick={() => navigate(b.id)}><span>{b.heading}</span><small>{b.page}</small>{i === 1 && <span className="note-dot" />}</button>)}</nav><div className="outline-bottom"><Link2 size={14} /><span>段落位置已关联<small>仅示例 ID 映射，非真实坐标</small></span></div></aside>}
        <main className={`reading-area ${mode}`} ref={readingRef} style={{ '--split': `${split}%`, '--reading-font': `${fontSize}px` } as React.CSSProperties}>
          {scene === 'unreadable' ? <div className="empty-state reading-error"><AlertCircle size={34} /><h2>暂时无法打开这份文件</h2><p>这是文件不可读的演示状态，未操作本地文件。</p><button className="primary" onClick={() => changeScene('normal')}>返回示例正文</button></div> : <>
            {mode === 'dual' && <section className="original-section"><div className="pane-header"><span><FileText size={14} />原页排版示例</span><span className="muted">非真实 PDF</span></div><div className="document-scroll original-scroll" ref={leftRef} onScroll={e => onReadScroll(e, 'left')}><div className="original-paper"><div className="original-paper-head"><div className="paper-journal">{paper.venue} {paper.year} · ILLUSTRATIVE CONTENT</div><h1>{paper.title}</h1><p>{paper.authors}</p><div className="source-notice">手工英文摘要与示意排版 · 非论文原页</div></div>{blocks.map(b => <section data-block={b.id} key={b.id} className={`original-block ${b.id === currentId ? 'located' : ''}`} onClick={() => navigate(b.id)}><div className="block-page">PAGE {b.page}</div><h2>{b.enHeading}</h2><p>{b.en}</p>{b.kind === 'formula' && <Formula />}{b.kind === 'figure' && <Diagram />}</section>)}<div className="document-end">END OF DEMO DOCUMENT</div></div></div></section>}
            {mode === 'dual' && <div className="split-handle" role="separator" aria-label="调整原文与译文宽度" aria-orientation="vertical" aria-valuemin={32} aria-valuemax={68} aria-valuenow={Math.round(split)} tabIndex={0} onPointerDown={resizeStart} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setSplit(s => Math.max(32, Math.min(68, s + (e.key === 'ArrowRight' ? 2 : -2)))); } }}><span /></div>}
            <section className="translation-section"><div className="pane-header"><span><BookOpen size={14} />{mode === 'dual' ? '中文译文' : '中文精读'}</span><span className="translation-badge">手工示例</span><span className="linked-label"><Link2 size={12} />段落联动</span></div><div className="document-scroll translation-scroll" ref={rightRef} onScroll={e => onReadScroll(e, 'right')}><div className="chinese-document"><div className="chinese-head"><div className="eyebrow">{paper.venue} {paper.year}<span> / </span>{paper.category}</div><h1>{paper.subtitle}</h1><p>{paper.title}</p><div className="reading-notice"><FlaskConical size={14} /><span>以下为手工编写的阅读示例，未接入解析或翻译。</span></div></div>{blocks.map(b => <section data-block={b.id} key={b.id} className={`translation-block ${b.id === currentId ? 'located' : ''} ${highlights.includes(b.id) ? 'highlighted' : ''}`} onClick={() => { if (b.id !== currentId) navigate(b.id); }}><div className="translation-block-heading"><h2>{b.heading}</h2><button className="source-link" onClick={e => { e.stopPropagation(); navigate(b.id); if (mode === 'focus') setPeek(true); }} title="查看对应英文示例">P.{b.page}<Link2 size={11} /></button></div>{scene === 'partial' && b.id.endsWith('experiments') ? <div className="block-failure"><AlertCircle size={17} /><b>此段译文暂不可用 · 模拟失败</b><p>原文示例仍可查看，已有笔记不会被覆盖。</p><button className="secondary" onClick={() => { changeScene('normal'); setToast('已恢复示例段落，未调用翻译服务。'); }}>模拟重试此段</button></div> : <><p>{b.zh}</p>{b.kind === 'formula' && <Formula />}{b.kind === 'figure' && <Diagram />}</>}<div className="block-actions"><button onClick={e => { e.stopPropagation(); setHighlights(h => h.includes(b.id) ? h.filter(id => id !== b.id) : [...h, b.id]); }} className={highlights.includes(b.id) ? 'is-highlighted' : ''}><Highlighter size={13} />{highlights.includes(b.id) ? '取消高亮' : '高亮'}</button><button onClick={e => { e.stopPropagation(); navigate(b.id); setAside(true); setTab('notes'); }}><StickyNote size={13} />记笔记</button><button onClick={e => { e.stopPropagation(); navigate(b.id); setAside(true); setTab('ai'); }}><Sparkles size={13} />提问</button>{paperNotes.filter(n => n.blockId === b.id).length > 0 && <span className="block-note-count"><MessageSquare size={12} />{paperNotes.filter(n => n.blockId === b.id).length}</span>}</div>{mode === 'focus' && paperNotes.some(n => n.blockId === b.id) && <div className="inline-note"><StickyNote size={14} /><div><b>我的笔记 · 当前会话</b><p>{paperNotes.find(n => n.blockId === b.id)?.text}</p></div></div>}</section>)}<div className="document-end"><span>· · ·</span>本篇示例已读完</div></div></div></section>
          </>}
        </main>
        {aside && <aside className="assistant-panel"><div className="assistant-tabs"><button className={tab === 'notes' ? 'selected' : ''} onClick={() => setTab('notes')}><StickyNote size={15} />笔记<span>{paperNotes.length}</span></button><button className={tab === 'ai' ? 'selected' : ''} onClick={() => setTab('ai')}><Sparkles size={15} />AI 助读</button></div>{tab === 'notes' ? <div className="notes-content"><div className="notes-intro"><h2>让思考留下来</h2><p>摘下线索，也记下你的疑问。</p></div><div className="current-source"><span><Link2 size={12} />当前段落 · 第 {currentBlock.page} 页</span><b>{currentBlock.heading}</b><p>{currentBlock.zh.slice(0, 66)}…</p></div><label className="note-label" htmlFor="note-draft">{editingNote ? '编辑笔记' : '添加段落笔记'}</label><textarea id="note-draft" value={draft} onChange={e => setDraft(e.target.value)} placeholder="此刻的想法、疑问或灵感…" />{saveError && <div className="save-error" role="alert">模拟保存失败。输入已保留，请恢复正常场景后重试。</div>}<div className="note-save-row"><span>仅在本次会话中保留</span><button className="primary small" onClick={saveNote} disabled={!draft.trim()}>{saveError ? '重试保存' : '保存笔记'}<Check size={13} /></button></div>{editingNote && <button className="text-button" onClick={() => { setDraft(''); setEditingNote(null); }}>取消编辑</button>}<div className="notes-section-heading">全部笔记 <span>{paperNotes.length}</span></div>{paperNotes.length === 0 ? <div className="notes-empty"><StickyNote size={26} strokeWidth={1.2} /><p>还没有笔记<br /><small>选一段正文，记录第一个想法</small></p></div> : paperNotes.map(n => <article className="note-card" key={n.id}><button className="note-source" onClick={() => navigate(n.blockId)}><span className="note-color" />{blocks.find(b => b.id === n.blockId)?.heading}<ArrowRight size={12} /></button><p>{n.text}</p><footer><span>{n.sample ? '示例笔记' : '我的笔记'} · 当前会话</span><button onClick={() => { setEditingNote(n.id); setDraft(n.text); navigate(n.blockId); }}>编辑</button></footer></article>)}</div> : <div className="ai-content"><div className="ai-spark"><Sparkles size={28} strokeWidth={1.3} /></div><h2>带着问题读论文</h2><p>围绕当前段落，理解概念、<br />梳理方法，或追问一个细节。</p><div className="ai-unconfigured"><AlertCircle size={16} /><div><b>尚未配置 AI</b><p>原型未连接模型，也不会发送论文或生成回答。</p></div></div><button className="secondary" onClick={() => setModal('settings')}><Settings2 size={15} />查看接入说明</button><div className="ai-context"><span>选段上下文 · 示例</span><blockquote>{currentBlock.zh}</blockquote></div><div className="suggestions"><span>之后可以这样提问</span>{['用通俗的话解释这段内容', '这个方法的关键假设是什么？', '与已有方法有什么区别？'].map(t => <button disabled key={t}>{t}<ArrowRight size={13} /></button>)}</div><div className="ai-input-disabled">模型接入后可发送问题<ArrowRight size={15} /></div></div>}</aside>}
      </div>
      <footer className="reader-footer"><div><span className="online-dot" />示例阅读会话<span className="footer-detail">· 位置与笔记刷新后重置</span></div><div className="page-navigation"><IconButton label="上一段" disabled={currentIndex === 0} onClick={() => navigate(blocks[currentIndex - 1].id)}><ChevronLeft size={15} /></IconButton><span>第 {currentBlock.page} / 6 页<span className="muted"> · 段落 {currentIndex + 1} / 8</span></span><IconButton label="下一段" disabled={currentIndex === blocks.length - 1} onClick={() => navigate(blocks[currentIndex + 1].id)}><ChevronRight size={15} /></IconButton></div><span className="footer-detail">{mode === 'dual' ? `双栏比例 ${Math.round(split)} : ${100 - Math.round(split)}` : '中文重排'}<span className="footer-separator">·</span>手工示例定位</span></footer>
    </>}
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><IconButton label="关闭弹窗" onClick={() => setModal(null)}><X size={19} /></IconButton><div className="modal-icon">{modal === 'import' ? <Upload size={25} /> : modal === 'settings' ? <Settings2 size={25} /> : <BookOpen size={25} />}</div><div className="eyebrow">INTERACTIVE PROTOTYPE</div><h2 id="modal-title">{modal === 'import' ? '把下一篇论文，放进书架' : modal === 'settings' ? '阅读偏好与接入边界' : '阅纸 · 让阅读慢下来'}</h2>{modal === 'import' ? <><p>导入入口预览。当前阶段不会读取、上传或解析本地文件。</p><div className="import-drop"><FileText size={32} strokeWidth={1.25} /><b>本地 PDF 导入将在下一阶段接入</b><span>原始文件保留 · 解析与译文单独保存</span><button className="secondary" disabled>选择 PDF 文件 · 尚未接入</button></div><button className="primary full-width" onClick={() => { changeScene('normal'); setCategory('全部论文'); setQuery(''); setModal(null); setToast('已打开 6 篇示例文献。没有导入本地文件。'); }}>先体验示例文献<ArrowRight size={16} /></button></> : modal === 'settings' ? <><p>本阶段用于确认阅读布局。应用名称“阅纸”为原型临时名称。</p><div className="settings-row"><span>默认阅读模式<small>本次会话生效</small></span><select aria-label="默认阅读模式" value={mode} onChange={e => setMode(e.target.value as 'dual' | 'focus')}><option value="dual">双栏对照</option><option value="focus">中文精读</option></select></div><div className="settings-row"><span>正文字号<small>中文与英文同步调整</small></span><input aria-label="正文字号" type="range" min="14" max="23" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /><b>{fontSize}</b></div><div className="boundary-box"><b>尚未接入</b><p>真实 PDF 渲染与解析、翻译任务、AI 模型、持久化及桌面安装包。无需填写 API 密钥。</p></div><button className="primary full-width" onClick={() => setModal(null)}>完成<Check size={16} /></button></> : <><p>为 Mac 个人阅读场景制作的第一阶段交互原型。可体验文献库、双语对照、中文精读、段落高亮与会话笔记。</p><div className="boundary-box"><b>请留意示例边界</b><p>论文元信息用于展示；英文、中文、公式及结构图为手工示例。这里没有真实 PDF、自动翻译、AI 回答或持久化存储。</p></div><p className="modal-fineprint">交互参考 EasyRead 与 Reader；实现未复用两个项目的代码。窗口宽度建议至少 960px。</p><button className="primary full-width" onClick={() => setModal(null)}>开始阅读<ArrowRight size={16} /></button></>}</section></div>}
    {peek && paper && <div className="modal-backdrop" onClick={() => setPeek(false)}><section className="modal source-modal" role="dialog" aria-modal="true" aria-labelledby="source-title" onClick={e => e.stopPropagation()}><IconButton label="关闭原文" onClick={() => setPeek(false)}><X size={18} /></IconButton><div className="eyebrow">SOURCE EXCERPT · 手工英文示例</div><h2 id="source-title">{currentBlock.enHeading}</h2><div className="source-page-label">{paper.title} · 第 {currentBlock.page} 页 · 示例定位</div><p className="source-excerpt">{currentBlock.en}</p>{currentBlock.kind === 'formula' && <Formula />}{currentBlock.kind === 'figure' && <Diagram />}<button className="secondary" onClick={() => { setPeek(false); setMode('dual'); }}>在双栏中查看<Columns2 size={15} /></button></section></div>}
    {toast && <div className="toast" role="status"><CheckCheck size={17} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="关闭提示"><X size={14} /></button></div>}
  </div>;
}
