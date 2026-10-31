import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { Analysis, AnnotationContext, AnnotationState, SelectionFragment, ContentBlock, ReadingMode, DocumentChange, DocumentRecord } from './desktop';
import { loadPDF, pdfError } from './pdf';
import { readingBlocks } from './bilingual/reading';
import AnnotationPanel from './AnnotationPanel';
import ParallelReader from './ParallelReader';
import ModelSettings from './ModelSettings';
import { pageImage, parsePDFPage, PARSER_VERSION } from './bilingual/parsePDF';
import type { Region } from './bilingual/parser';
import type { ReadingPage } from './bilingual/presentation';
import { PRESENTATION_VERSION } from './bilingual/presentation';
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, List, Search } from 'lucide-react';
type Outline = { title: string; dest: unknown; items: Outline[] };
type Hit = { page: number; excerpt: string };
export default function PdfReader({ doc, onBack, save, registerFlush }: { doc: DocumentRecord; onBack(): void; save(id: string, change: DocumentChange): Promise<void>; registerFlush(fn: () => Promise<void>): void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(doc.page), [zoom, setZoom] = useState(doc.zoom), [offset, setOffset] = useState(doc.offset);
  const [mode, setMode] = useState<ReadingMode>('original');
  const [navigation,setNavigation]=useState(0);
  const [analysis,setAnalysis]=useState<Analysis|null>(null), [anchor,setAnchor]=useState<string|null>(null), [showModel,setShowModel]=useState(false);
  const [annotationState,setAnnotationState]=useState<AnnotationState>({contexts:[],notes:[],turns:[]}),[selection,setSelection]=useState<SelectionFragment[]>([]),[selectionError,setSelectionError]=useState(''),[showAnnotations,setShowAnnotations]=useState(true);
  const [chatAttachments,setChatAttachments]=useState<SelectionFragment[]>([]),[chatFocus,setChatFocus]=useState(0);
  function addSelectionToChat(){if(!selection.length)return;setChatAttachments(old=>{const next=[...old];for(const f of selection)if(!next.some(x=>x.block_id===f.block_id&&x.side===f.side&&x.version===f.version&&x.start===f.start&&x.end===f.end))next.push(f);return next;});setShowAnnotations(true);setChatFocus(n=>n+1);}
  const [chatSide,setChatSide]=useState<'en'|'zh'>('en');
  const contextAtAnchor=annotationState.contexts.find(c=>c.block_id===anchor&&c.side===(mode==='focus'?'zh':chatSide))||(!anchor?annotationState.contexts.find(c=>c.page===page&&c.side===(mode==='focus'?'zh':chatSide)):undefined);
  const automaticChatFocus={page:mode==='original'?page:contextAtAnchor?.page||page,parse_id:analysis?.parse?.id,side:mode==='focus'?'zh' as const:chatSide,...(mode!=='original'&&contextAtAnchor?{block_id:contextAtAnchor.block_id}:{})};
  const annotationRevision=analysis?.parse?.id+'|'+analysis?.reading?.blocks.map(b=>b.id+':'+b.translation).join('|')+'|'+analysis?.translations.map(t=>t.cache_key).join('|');
  useEffect(()=>{let alive=true;window.reader!.annotationList(doc.id).then(s=>{if(alive)setAnnotationState(s);}).catch(e=>setTaskError(pdfError(e)));return()=>{alive=false;};},[doc.id,annotationRevision]);
  const qaRunning=annotationState.turns.some(t=>t.state==='running');
  useEffect(()=>{if(!qaRunning)return;let alive=true;const timer=setInterval(()=>{window.reader!.annotationList(doc.id).then(s=>{if(alive)setAnnotationState(s);}).catch(e=>{if(alive)setTaskError(pdfError(e));});},900);return()=>{alive=false;clearInterval(timer);};},[doc.id,qaRunning]);
  function locateAnnotation(c:AnnotationContext){
    if(c.source_mode==='paper'&&analysis?.parse?.id===c.parse_id){const b=analysis.parse.pages.flatMap(p=>p.blocks).find(b=>b.id===c.block_id);if(b){selectBlock(b,true);setTaskError('');return;}}

    const current=annotationState.contexts.find(x=>x.block_id===c.block_id&&x.side===c.side),b=readingBlocks(analysis).find(b=>b.id===c.block_id);
    if(current?.version===c.version&&b){const next=c.side==='en'?'dual':mode==='original'?'focus':mode;contentPosition.current.mode=next;setMode(next);selectBlock(b);setNavigation(n=>n+1);setTaskError('');}
    else {changeMode('original');go(c.page);setTaskError('内容版本已变化，批注保留待核对；仅打开保存的 PDF 来源页。');}
  }
  const sourceBlocks=readingBlocks(analysis);
  const [parsing,setParsing]=useState(false), [parseProgress,setParseProgress]=useState(0), [taskError,setTaskError]=useState('');
  const shouldPoll=useRef(false);shouldPoll.current=!!analysis?.jobs.some(j=>j.state==='running');
  const parseCancel=useRef(false), parseBusy=useRef(false), contentPosition=useRef<{block:string|null;mode:ReadingMode;offset:number}>({block:null,mode:'original',offset:0});
  useEffect(()=>{
    let alive=true;
    window.reader!.snapshot(doc.id).then(data=>{if(!alive)return;setAnalysis(data);const b=readingBlocks(data).find(b=>b.id===data.position.block_id);const block=b?.regions.some(r=>r.page===doc.page)?b.id:null;contentPosition.current={block,mode:data.position.mode,offset:data.position.offset};setAnchor(block);setMode(data.position.mode);}).catch(e=>setTaskError(pdfError(e)));
    const timer=setInterval(()=>{if(!shouldPoll.current)return;window.reader!.snapshot(doc.id).then(data=>{if(alive)setAnalysis(data);}).catch(e=>{if(alive)setTaskError(pdfError(e));});},800);
    return ()=>{alive=false;clearInterval(timer);parseCancel.current=true;};
  },[doc.id]);
  const [startingFull,setStartingFull]=useState(false),[imageProgress,setImageProgress]=useState(0);const startBusy=useRef(false);
  async function parseDocument(preserveMode=false) {
    if(!pdf || parseBusy.current)return;
    parseCancel.current=false;parseBusy.current=true;setParsing(true);setTaskError('');
    const pages:ReadingPage[]=[];
    try {
      for(let p=1;p<=pdf.numPages;p++) {
        if(parseCancel.current)return;
        try {pages.push(await parsePDFPage(pdf,p));} catch(e){pages.push({presentation_version:PRESENTATION_VERSION,page:p,layout:'error',warning:`此页解析失败，请查看原页：${pdfError(e)}`,blocks:[]});}
        setParseProgress(p);await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(parseCancel.current)return;
      const data=await window.reader!.saveParse(doc.id,{version:PARSER_VERSION,pages});setAnalysis(data);
      const candidates=readingBlocks(data).filter(b=>b.regions.some(r=>r.page===page));const b=candidates.find(b=>b.id===contentPosition.current.block&&b.display!=='skip')||candidates.find(b=>b.display!=='skip');contentPosition.current.block=b?.id||null;setAnchor(b?.id||null);if(mode==='original'&&!preserveMode){setMode('dual');contentPosition.current.mode='dual';}
      setReady(true);return data;
    }catch(e){setTaskError(pdfError(e));throw e;}finally{parseBusy.current=false;setParsing(false);}
  }
  const autoParseAttempt=useRef(false);
  useEffect(()=>{
    if(pdf&&analysis&&!analysis.parse&&!parseBusy.current&&!autoParseAttempt.current){
      autoParseAttempt.current=true;void parseDocument(true).catch(()=>{});
    }
  },[pdf,analysis,mode]);
  const previousBlocks=useRef<ContentBlock[]>([]);
  useLayoutEffect(()=>{
    if(mode==='original'&&analysis?.parse?.pages.some(p=>p.blocks.some(b=>b.id===anchor)))return;
    if(anchor&&!sourceBlocks.some(b=>b.id===anchor)){
      const old=previousBlocks.current.find(b=>b.id===anchor),region=old?.regions[0];
      const replacement=region&&sourceBlocks.filter(b=>b.regions.some(r=>r.page===region.page)).sort((a,b)=>{
        const distance=(block:ContentBlock)=>Math.min(...block.regions.filter(r=>r.page===region.page).map(r=>Math.abs(r.y-region.y)+Math.abs(r.x-region.x)));
        return distance(a)-distance(b);
      })[0];
      contentPosition.current.block=replacement?.id||null;contentPosition.current.offset=0;setAnchor(replacement?.id||null);
    }
    previousBlocks.current=sourceBlocks;
  },[analysis,anchor]);
  async function startFullTranslation(refine=false){
    if(startBusy.current||parseBusy.current||!pdf)return;startBusy.current=true;setStartingFull(true);setTaskError('');
    try{
      const config=await window.reader!.modelConfig();
      if(!config.model||(config.provider==='codex'?!config.executable:!config.baseURL)){setShowModel(true);setTaskError('请先保存模型设置，再开始全文翻译。');return;}
      let current=analysis;
      if(!current?.parse||current.parse.pages.some(p=>p.presentation_version!==PRESENTATION_VERSION))current=await parseDocument()||null;
      if(!current?.parse||parseCancel.current)return;
      for(let p=1;p<=pdf.numPages;p++){
        if(parseCancel.current)return;
        if(!current.assets.includes(p)){setImageProgress(p);await window.reader!.savePageImage(doc.id,p,await pageImage(pdf,p));}
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      await window.reader!.startTranslation(doc.id,{type:'all',page,pipeline:'pages-3',refine});
      if(!current.reading){contentPosition.current.block=null;setAnchor(null);}
      setAnalysis(await window.reader!.snapshot(doc.id));if(mode==='original')changeMode('dual');
    }catch(e){setTaskError(pdfError(e));}finally{startBusy.current=false;setStartingFull(false);setImageProgress(0);}
  }
  function changeMode(next:ReadingMode){contentPosition.current.mode=next;setMode(next);setNavigation(n=>n+1);void persist();}
  function selectBlock(b:ContentBlock, source=false, region?:Region){
    contentPosition.current.block=b.id;if(!region)contentPosition.current.offset=0;setAnchor(b.id);
    if(source)changeMode('original');
    const target=region||b.regions[0];
    if(b.confidence==='geometry' && target) {
      const value=Math.max(0,target.y-0.025);latest.current={page:target.page,offset:value,zoom};setOffset(value);setPage(target.page);
      if(scroll.current&&pageBox.current){scroll.current.scrollTop=value*pageBox.current.clientHeight;}
    } else { latest.current={page:b.page,offset:0,zoom};setOffset(0);setPage(b.page);if(scroll.current)scroll.current.scrollTop=0; }
    setReady(true);void persist();
  }
  async function translationAction(action:()=>Promise<unknown>){setTaskError('');try{await action();setAnalysis(await window.reader!.snapshot(doc.id));}catch(e){setTaskError(pdfError(e));}}
  const [outline, setOutline] = useState<Outline[]>([]), [showNav, setShowNav] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''), [hits, setHits] = useState<Hit[]>([]), [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0), [searched, setSearched] = useState(false), [searchError, setSearchError] = useState('');
  const searchVersion = useRef(0), latest = useRef({ page: doc.page, offset: doc.offset, zoom: doc.zoom });
  const saveChain = useRef(Promise.resolve());
  const readingSave=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(readingSave.current),[]);
  const [saveState, setSaveState] = useState('位置已保存'), [ready, setReady] = useState(false);
  const [width, setWidth] = useState(800), [rendered, setRendered] = useState(false), [retry, setRetry] = useState(0);
  const [renderedKey, setRenderedKey] = useState('');
  const renderKey = `${page}|${zoom}|${width}|${mode}|${retry}`;
  const isRendered = rendered && renderedKey === renderKey;
  const scroll = useRef<HTMLDivElement>(null), pageBox = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), layerBox = useRef<HTMLDivElement>(null);
  const [pageInput, setPageInput] = useState(String(page));
  function persist() {
    const position = { ...latest.current };
    setSaveState('正在保存位置…');
    const content={...contentPosition.current};
    const task = saveChain.current.catch(() => {}).then(async () => { await save(doc.id, position); await window.reader!.saveContentPosition(doc.id,content.block,content.mode,content.offset); });
    saveChain.current = task;
    task.then(() => setSaveState('位置已保存')).catch(() => setSaveState('保存失败，请重试'));
    return task;
  }
  useEffect(() => { registerFlush(persist); return () => registerFlush(() => Promise.resolve()); }, []);
  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof loadPDF> | undefined;
    window.reader!.read(doc.id).then(data => {
      if (disposed) return;
      task = loadPDF(data);
      return task.promise.then(async instance => {
        if (disposed) return;
        setPdf(instance);
        const entries = await instance.getOutline();
        if (!disposed) setOutline(entries || []);
      });
    }).catch(e => { if (!disposed) setError(pdfError(e)); });
    return () => { disposed = true; searchVersion.current++; void task?.destroy(); };
  }, [doc.id]);
  useEffect(() => { latest.current = { page, offset, zoom }; }, [page, offset, zoom]);
  useEffect(() => {
    const timer = setTimeout(() => { if (ready) void persist(); }, 200);
    return () => clearTimeout(timer);
  }, [page, offset, zoom, ready]);
  useEffect(() => {
    const onHide = () => { void persist(); };
    window.addEventListener('pagehide', onHide);
    const onVisibility = () => { if (document.visibilityState === 'hidden') onHide(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(250, Math.floor(entries[0].contentRect.width - 48))));
    observer.observe(el); return () => observer.disconnect();
  }, [mode, pdf]);
  useEffect(() => {
    if (!pdf || mode !== 'original') return;
    let cancelled = false, renderTask: RenderTask | undefined, textLayer: TextLayer | undefined, loadedPage: PDFPageProxy | undefined;
    setRendered(false); setError(''); setNotice('');
    pdf.getPage(page).then(async pdfPage => {
      loadedPage = pdfPage;
      if (cancelled || !canvas.current || !pageBox.current || !layerBox.current) return;
      const original = pdfPage.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? Math.min(3, width / original.width) : Number(zoom);
      const viewport = pdfPage.getViewport({ scale });
      // Bound bitmap allocation while keeping logical text coordinates intact.
      const ratio = Math.min(window.devicePixelRatio || 1, 2, 8192 / Math.max(viewport.width, viewport.height), Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
      const target = canvas.current;
      target.width = Math.floor(viewport.width * ratio); target.height = Math.floor(viewport.height * ratio);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      pageBox.current.style.width = `${viewport.width}px`; pageBox.current.style.height = `${viewport.height}px`;
      pageBox.current.style.setProperty('--scale-factor', String(scale));
      pageBox.current.style.setProperty('--total-scale-factor', String(scale));
      layerBox.current.replaceChildren();
      renderTask = pdfPage.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      const text = await pdfPage.getTextContent();
      if (cancelled) return;
      if (!text.items.some(item => 'str' in item && item.str.trim())) setNotice('此页没有可提取文字，可能是扫描页；可查看原页，OCR 尚未接入。');
      textLayer = new TextLayer({ textContentSource: text, container: layerBox.current!, viewport });
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (cancelled) return;
      if (scroll.current) scroll.current.scrollTop = latest.current.offset * viewport.height;
      setRenderedKey(renderKey); setRendered(true); setReady(true);
    }).catch(e => { if (!cancelled && e.name !== 'RenderingCancelledException' && e.name !== 'AbortException') setError(`第 ${page} 页无法渲染：${pdfError(e)}`); });
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); void renderTask?.promise.catch(() => {}).then(() => { if(loadedPage && loadedPage.pageNumber!==latest.current.page)loadedPage.cleanup(); }); };
  }, [pdf, page, zoom, width, mode, retry]);
  useEffect(() => { setPageInput(String(page)); }, [page]);
  function go(next: number) {
    if (!Number.isInteger(next) || next < 1 || next > doc.pages) { setPageInput(String(page)); return; }
    if (next === page){setNavigation(n=>n+1);return;}
    const b=sourceBlocks.find(b=>b.display!=='skip'&&b.regions.some(r=>r.page===next)),r=b?.regions.find(r=>r.page===next),offset=r?Math.max(0,r.y-.025):0;
    latest.current = { page: next, offset, zoom }; contentPosition.current.block=b?.id||null;contentPosition.current.offset=b?Math.max(0,b.regions.findIndex(r=>r.page===next))/b.regions.length:0;setAnchor(b?.id||null); setOffset(offset); setPage(next);setReady(true);setNavigation(n=>n+1);
  }
  async function jump(dest: unknown) {
    if (!pdf || !dest) return;
    try {
      const target = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
      if (!Array.isArray(target)) throw new Error('此目录项没有内部页面位置。');
      const index = typeof target[0] === 'number' ? target[0] : await pdf.getPageIndex(target[0]);
      go(index + 1);
    } catch (e) { setSearchError(pdfError(e)); }
  }
  function outlineItems(items: Outline[], depth = 0) {
    return items.map((item, i) => <div key={`${depth}-${i}`}><button className="rp-outline-item" style={{ paddingLeft: 14 + depth * 12 }} onClick={() => void jump(item.dest)} disabled={!item.dest}>{item.title || '未命名章节'}</button>{outlineItems(item.items || [], depth + 1)}</div>);
  }
  async function findText() {
    if (!pdf || !search.trim()) return;
    const version = ++searchVersion.current, query = search.trim().toLocaleLowerCase();
    setHits([]); setSearched(false); setSearching(true); setSearchError('');
    const found: Hit[] = [];
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        if (version !== searchVersion.current) return;
        const pdfPage = await pdf.getPage(p), content = await pdfPage.getTextContent();
        const text = content.items.flatMap(item => 'str' in item ? [item.str + (item.hasEOL ? '\n' : '')] : []).join(' ');
        const index = text.toLocaleLowerCase().indexOf(query);
        if (index >= 0) found.push({ page: p, excerpt: text.slice(Math.max(0, index - 45), index + query.length + 100) });
        if (version !== searchVersion.current) return;
        setHits([...found]); setSearchProgress(p);
        if (p !== latest.current.page) pdfPage.cleanup();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (version === searchVersion.current) setSearched(true);
    } catch (e) { if (version === searchVersion.current) setSearchError(`搜索未完成：${pdfError(e)}`); }
    finally { if (version === searchVersion.current) setSearching(false); }
  }
  const translation=<ParallelReader onContextRead={(_b,side)=>setChatSide(side)} canAddSelection={!!selection.length} onAddSelection={addSelectionToChat} annotationState={annotationState} onSelection={(f,error)=>{setSelection(f);setSelectionError(error||'');}} analysis={analysis} pdf={pdf} page={page} anchor={anchor} fraction={contentPosition.current.offset} navigation={navigation} mode={mode} onRead={(b,f)=>{const r=b.regions[Math.min(b.regions.length-1,Math.floor(f*b.regions.length))];contentPosition.current.block=b.id;contentPosition.current.offset=f;latest.current={page:r.page,offset:r.y,zoom};setPage(r.page);setAnchor(b.id);clearTimeout(readingSave.current);readingSave.current=setTimeout(()=>void persist(),300);}} onSource={b=>selectBlock(b,true)} onSettings={()=>setShowModel(true)} onResume={id=>void translationAction(()=>window.reader!.resumeTranslation(id))} onStop={(id,cancel)=>void translationAction(()=>window.reader!.stopTranslation(id,cancel))} onRefine={()=>void startFullTranslation(true)}/>;
  return <div className="rp-reader">
    <header className="rp-header"><button className="icon-btn" aria-label="返回文献库" onClick={async () => { try { parseCancel.current=true;await persist(); onBack(); } catch { setSaveState('保存失败，请重试'); } }}><ArrowLeft size={20} /></button><div className="rp-reader-title"><b>{doc.title}</b><small>本地 PDF · {doc.pages} 页 · 原始文件副本</small></div><div className="mode-switch">{([['original', 'PDF 原稿'], ['dual', '双语对照'], ['focus', '中文精读']] as const).map(([m, name]) => <button key={m} className={mode === m ? 'selected' : ''} onClick={() => changeMode(m)}>{name}</button>)}</div></header>
    <div className="rp-tools"><button className="primary" disabled={!pdf||startingFull||parsing||!!analysis?.jobs.some(j=>j.state==='running')} onClick={()=>void startFullTranslation()}>{parsing?`解析全文 ${parseProgress}/${doc.pages}`:imageProgress?`准备原页图 ${imageProgress}/${doc.pages}`:startingFull?'正在准备全文…':'全文翻译'}</button>{analysis?.jobs.find(j=>j.state==='running')&&<button className="secondary" onClick={()=>void translationAction(()=>window.reader!.stopTranslation(analysis.jobs.find(j=>j.state==='running')!.id))}>暂停全文翻译</button>}{(parsing||startingFull)&&<button className="secondary" onClick={()=>{parseCancel.current=true;}}>取消准备</button>}{analysis?.parse&&!parsing&&!startingFull&&!analysis.jobs.some(j=>j.state==='running')&&<button className="secondary" onClick={()=>void parseDocument().catch(()=>{})}>重新解析</button>}<button className="secondary" onClick={() => setShowNav(!showNav)}><List size={15} />目录与搜索</button><button className="secondary" onClick={()=>setShowAnnotations(!showAnnotations)}>批注与 AI{annotationState.notes.length?` · ${annotationState.notes.length}`:''}</button><div className="rp-paging"><button className="icon-btn" aria-label="上一页" disabled={page <= 1} onClick={() => go(page - 1)}><ChevronLeft size={19} /></button><form onSubmit={e => { e.preventDefault(); go(Number(pageInput)); }}><input aria-label="页码" value={pageInput} onChange={e => setPageInput(e.target.value)} onBlur={() => go(Number(pageInput))} inputMode="numeric" /><span> / {doc.pages} 页</span></form><button className="icon-btn" aria-label="下一页" disabled={page >= doc.pages} onClick={() => go(page + 1)}><ChevronRight size={19} /></button></div>{mode==='original'&&<label>缩放 <select aria-label="PDF 缩放" value={zoom} onChange={e => { latest.current.zoom = e.target.value; setZoom(e.target.value); }}>{['fit', '0.5', '0.75', '1', '1.25', '1.5', '2', '3'].map(v => <option key={v} value={v}>{v === 'fit' ? '适合宽度' : `${Number(v) * 100}%`}</option>)}</select></label>}</div>
    {taskError&&<div className="rp-page-notice rp-error-text" role="alert">{taskError}</div>}
    <div className="rp-reading-layout">{showNav && <aside className="rp-nav"><form className="rp-search" onSubmit={e => { e.preventDefault(); void findText(); }}><input aria-label="搜索 PDF 全文" placeholder="搜索 PDF 全文" value={search} onChange={e => { setSearch(e.target.value); searchVersion.current++; setSearching(false); setSearched(false); setHits([]); }} /><button className="icon-btn" aria-label="执行全文搜索" disabled={!pdf || !search.trim()}><Search size={17} /></button></form>{searching && <p className="rp-hint">搜索中 · {searchProgress}/{doc.pages} 页 <button onClick={() => { searchVersion.current++; setSearching(false); }}>取消</button></p>}{searched && <p className="rp-hint">{hits.length ? `${hits.length} 页包含匹配文字（每页显示首处）` : '未找到匹配文字；扫描页需 OCR。'}</p>}{searchError && <p role="alert" className="rp-error">{searchError}</p>}{hits.map(h => <button className="rp-hit" key={h.page} onClick={() => go(h.page)}><b>第 {h.page} 页</b><span>{h.excerpt}</span></button>)}<h3>文档目录</h3>{!pdf ? <p className="rp-hint">正在读取…</p> : outline.length ? outlineItems(outline) : <p className="rp-hint">此 PDF 没有内嵌目录，可通过页码或全文搜索导航。</p>}</aside>}
      <main className={`rp-panes rp-${mode}`}>{mode === 'original' && <section className="rp-pdf-pane"><div className="rp-pane-heading" data-render-key={renderKey} data-completed-key={renderedKey}><FileText size={14} />真实 PDF · 第 {page} 页<span>{!pdf ? '正在打开…' : !isRendered && !error ? '正在渲染…' : error ? '页面不可用' : '可选择与复制文字'}</span></div>{notice && <div className="rp-page-notice">{notice}</div>}{error && <div role="alert" className="rp-error">{error}<button className="secondary" onClick={() => { setError(''); setRetry(v => v + 1); }}>重试此页</button></div>}
        <div className="rp-pdf-scroll" ref={scroll} onScroll={e => { if (!isRendered || !pageBox.current) return; const value = Math.max(0, Math.min(1, e.currentTarget.scrollTop / pageBox.current.clientHeight)); latest.current = { page, offset: value, zoom }; setOffset(value);
        }}><div className="rp-page" ref={pageBox} data-page={page}><canvas ref={canvas} aria-label={`PDF 第 ${page} 页`} /><div className="textLayer" ref={layerBox} />{[...sourceBlocks,...(analysis?.parse?.pages.flatMap(p=>p.blocks)||[])].find(b=>b.id===anchor && b.confidence==='geometry')?.regions.filter(r=>r.page===page).map((r,i)=><div key={i} className="rp-region" style={{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`}}/>)}</div></div>
      </section>}{mode !== 'original' && translation}</main><AnnotationPanel automaticFocus={automaticChatFocus} collapsed={!showAnnotations} documentTitle={doc.title} attachments={chatAttachments} onAttachments={setChatAttachments} chatFocus={chatFocus} onAddSelection={addSelectionToChat} onSettings={()=>setShowModel(true)} documentID={doc.id} state={annotationState} selection={selection} selectionError={selectionError} onState={setAnnotationState} onClose={()=>setShowAnnotations(false)} onLocate={locateAnnotation}/>
    </div>{showModel&&<ModelSettings onClose={()=>setShowModel(false)}/>}<footer className="rp-reader-footer"><span>来源可核对 · 译文与原始 PDF 分开保存</span><button onClick={() => void persist()} className={saveState.includes('失败') ? 'rp-error-text' : ''}>{saveState}{saveState.includes('失败') ? ' · 点击重试' : ''}</button><span>第 {page} / {doc.pages} 页</span></footer>
  </div>;
}
