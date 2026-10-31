import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Analysis, ContentBlock } from './desktop';
import type { Region } from './bilingual/parser';
import { readingBlocks } from './bilingual/reading';
import PdfCrop from './PdfCrop';
import TranslatedText, { MathFormula } from './TranslatedText';
const states:Record<string,string>={running:'全文翻译中',paused:'已暂停',partial:'部分未完成',completed:'翻译完成',cancelled:'已取消'};
export default function BilingualPane({analysis,pdf,page,anchor,readingOffset,viewMode,preparing,onReadPoint,onSelect,onSource,onResume,onStop,onSettings}:{analysis:Analysis|null;pdf:PDFDocumentProxy|null;page:number;anchor:string|null;readingOffset:number;viewMode:string;preparing:boolean;onReadPoint(fraction:number):void;onSelect(b:ContentBlock,region?:Region):void;onSource(b?:ContentBlock):void;onResume(id:string):void;onStop(id:string,cancel?:boolean):void;onSettings():void}){
  const [font,setFont]=useState(18);
  const scroll=useRef<HTMLDivElement>(null),suppress=useRef(0),skipAnchor=useRef(''),localAnchor=useRef(anchor);
  const readingPoint=useRef({id:anchor,fraction:readingOffset||0,page});
  const semantic=analysis?.reading;
  const blocks=readingBlocks(analysis);
  const [menu,setMenu]=useState<{block:ContentBlock;x:number;y:number}|null>(null);
  const menuRef=useRef<HTMLDivElement>(null),menuOrigin=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(!menu)return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss=(e:Event)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(null);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setMenu(null);menuOrigin.current?.focus({preventScroll:true});}};
    window.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',escape);window.addEventListener('resize',dismiss);window.addEventListener('blur',dismiss);
    return()=>{window.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',escape);window.removeEventListener('resize',dismiss);window.removeEventListener('blur',dismiss);};
  },[menu]);
  useEffect(()=>setMenu(null),[viewMode,contentRevisionKey(analysis)]);
  function openMenu(b:ContentBlock,el:HTMLElement,x:number,y:number){menuOrigin.current=el;setMenu({block:b,x:Math.max(8,Math.min(x,window.innerWidth-252)),y:Math.max(8,Math.min(y,window.innerHeight-140))});}
  const fullCount=analysis?.parse?.pages.flatMap(p=>p.blocks).filter(b=>b.display?b.display==='text':b.kind!=='source').length||0;
  const jobs=(analysis?.jobs||[]).filter(j=>j.parse_id===analysis?.parse?.id&&(j.provider.workflow?.startsWith('pages-')||j.items.length===fullCount));
  const job=jobs.find(j=>j.state==='running')||jobs[0],pageJob=job?.provider.workflow?.startsWith('pages-');
  const contentRevision=(semantic?.pages.map(p=>p.page).join(',')||'')+'|'+(analysis?.translations.map(t=>`${t.cache_key}:${t.text.length}`).join('|')||'');
  useLayoutEffect(()=>{
    if(!anchor)return;if(skipAnchor.current===anchor){skipAnchor.current='';return;}
    const root=scroll.current,el=root?.querySelector<HTMLElement>(`[data-block="${anchor}"]`);if(!root||!el)return;
    const block=blocks.find(b=>b.id===anchor),index=block?.regions.findIndex(r=>r.page===page)??0;
    const fraction=readingOffset||(index>0?index/block!.regions.length:0);
    readingPoint.current={id:anchor,fraction,page};
    suppress.current=performance.now()+1000;
    const align=()=>{if(localAnchor.current===anchor&&performance.now()<suppress.current)root.scrollTop+=el.getBoundingClientRect().top-root.getBoundingClientRect().top+fraction*el.offsetHeight-18;};
    align();let frame=requestAnimationFrame(()=>{align();frame=requestAnimationFrame(align);});
    const timer=setTimeout(align,100);
    return()=>{cancelAnimationFrame(frame);clearTimeout(timer);};
  },[anchor,page,analysis?.parse?.id,viewMode,contentRevision]);
  useLayoutEffect(()=>{
    if(skipAnchor.current)return;
    const root=scroll.current,el=root?.querySelector<HTMLElement>(`[data-reading-page="${page}"]`);
    if(root&&el&&!anchor){suppress.current=performance.now()+400;root.scrollTop+=el.getBoundingClientRect().top-root.getBoundingClientRect().top-18;}
  },[page,analysis?.parse?.id,semantic?.job_id,anchor]);
  localAnchor.current=anchor;
  function article(b:ContentBlock){
    const legacy=analysis!.translations.filter(t=>t.block_id===b.id&&t.source_hash===b.source_hash).at(-1);
    const translation=b.translation||legacy?.text,equation=b.semanticType==='equation'||b.visualType==='equation',visual=b.display==='visual'&&!equation,text=translation||b.text;
    return <article className={`rp-block ${equation?'rp-equation-block':visual?'rp-visual-block':''} ${anchor===b.id?'rp-block-active':''}`} data-block={b.id} data-kind={equation?'equation':visual?'visual':'text'} data-language={visual?'original':translation?'zh':'en'} key={b.id} tabIndex={0}
      onContextMenu={e=>{e.preventDefault();openMenu(b,e.currentTarget,e.clientX,e.clientY);}}
      onKeyDown={e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();openMenu(b,e.currentTarget,r.left+20,r.top+20);}}}>
      {equation?b.latex?<MathFormula latex={b.latex} number={b.equation_number}/>:<div className="rp-equation-pending" role="status">公式尚未转换，点击“全文翻译”更新数学排版。</div>:visual?<figure><PdfCrop pdf={pdf} region={b.regions[0]} label={`${text} · 第 ${b.page} 页`}/></figure>:b.kind==='heading'?<h2 className={translation?'rp-zh':'rp-en'} lang={translation?'zh-CN':'en'}><TranslatedText text={text}/></h2>:<p className={`${translation?'rp-zh':'rp-en'} ${b.semanticType==='list'?'rp-translated-list':''}`} lang={translation?'zh-CN':'en'}><TranslatedText text={text}/></p>}
    </article>;
  }
  return <section className="rp-content-pane"><div className="rp-pane-heading">中文全文 · 连续阅读<span>未译内容显示英文 · 右键定位原文</span></div>
    <div className="rp-translate-controls"><span className="rp-chinese-note">中文阅读{semantic?` · ${semantic.glossary.length} 个统一术语`:''}</span><button className="secondary" onClick={onSettings}>模型设置</button><label>字号 <select aria-label="译文字号" value={font} onChange={e=>setFont(Number(e.target.value))}>{[16,18,20,22].map(v=><option key={v}>{v}</option>)}</select></label></div>
    {jobs.length>1&&<details className="rp-job-select"><summary>历史任务（{jobs.length-1}）</summary>{jobs.slice(1).map(j=><p key={j.id}>{states[j.state]} · {j.items.length} {j.provider.workflow?'页':'段'}</p>)}</details>}
    {job&&<div className="rp-job" role="status"><b>{states[job.state]} · {job.items.filter(i=>i.state==='done').length}/{job.items.length} {pageJob?'页':'段'}</b><small>{job.items.filter(i=>i.state==='failed').length} {pageJob?'页':'段'}待重试</small>{job.state==='running'?<button onClick={()=>onStop(job.id)}>暂停</button>:['paused','partial'].includes(job.state)?<button onClick={()=>onResume(job.id)}>继续全文翻译</button>:null}{['running','paused','partial'].includes(job.state)&&<button onClick={()=>onStop(job.id,true)}>取消任务</button>}</div>}
    {job?.items.find(i=>i.error)&&<p className="rp-content-warning" role="alert">{job.items.find(i=>i.error)!.error}</p>}
    <div className="rp-content-scroll" ref={scroll} style={{fontSize:font}} tabIndex={0} aria-label="中文全文阅读区" onWheel={()=>{setMenu(null);suppress.current=0;}} onPointerDown={()=>{suppress.current=0;}} onTouchStart={()=>{setMenu(null);suppress.current=0;}} onKeyDown={()=>{suppress.current=0;}} onScroll={()=>{
      if(performance.now()<suppress.current||!scroll.current)return;
      const top=scroll.current.getBoundingClientRect().top+30,visible=[...scroll.current.querySelectorAll<HTMLElement>('[data-block]')].find(el=>el.getBoundingClientRect().bottom>top),b=blocks.find(b=>b.id===visible?.dataset.block);
      if(!b||!visible)return;
      const fraction=Math.max(0,Math.min(.999,(top-visible.getBoundingClientRect().top)/Math.max(1,visible.offsetHeight))),region=b.regions[Math.floor(fraction*b.regions.length)];
      readingPoint.current={id:b.id,fraction,page:region.page};onReadPoint(fraction);
      if(b.id!==localAnchor.current||region.page!==page){skipAnchor.current=b.id;localAnchor.current=b.id;onSelect(b,region);}
    }}>
      {!analysis?.parse?<div className="rp-content-empty"><h2>{preparing?'正在整理正文':'正文尚未准备好'}</h2><p>从本地 PDF 提取英文与图表。点击“全文翻译”后，译文会逐步替换英文。</p></div>:analysis.parse.pages.map(p=>{
        const contents=blocks.filter(b=>b.page===p.page);
        return <section className="rp-reading-page" data-reading-page={p.page} key={p.page}>
          {contents.map(article)}
          {!contents.length&&!semantic?.pages.some(q=>q.page===p.page)&&pdf&&<PdfCrop pdf={pdf} region={{page:p.page,x:0,y:0,width:1,height:1}} label={`第 ${p.page} 页原稿（未提取到正文）`}/>}
          {p.layout==='error'&&<p className="rp-content-warning">此页解析失败，请核对原页。</p>}
        </section>;
      })}
    </div>
    {menu&&<div className="rp-source-menu" ref={menuRef} role="menu" aria-label="正文操作" style={{left:menu.x,top:menu.y}} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();}if(e.key==='Tab')setMenu(null);}}>
      <button role="menuitem" onClick={()=>{onSource(menu.block);setMenu(null);}}>定位原文</button>
      <small>第 {menu.block.page}{menu.block.regions.at(-1)?.page!==menu.block.page?`–${menu.block.regions.at(-1)?.page}`:''} 页{menu.block.confidence==='page'?' · 仅定位到页面':menu.block.location==='model'?' · 模型识别区域，请核对':''}</small>
      {menu.block.display!=='visual'&&menu.block.semanticType!=='equation'&&!menu.block.translation&&!analysis?.translations.some(t=>t.block_id===menu.block.id&&t.source_hash===menu.block.source_hash)&&<small>尚未翻译，当前显示英文原文</small>}
    </div>}
  </section>;
}

function contentRevisionKey(analysis:Analysis|null){return analysis?.reading?.pages.map(p=>p.page).join(',')||analysis?.parse?.id;}
