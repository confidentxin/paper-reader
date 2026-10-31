import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import type {Analysis,ContentBlock,AnnotationState,SelectionFragment} from './desktop';
import {hasAlignment,readableEnglish,selectedPairs,type PairSelection,type Side} from './bilingual/selection';
import {captureSelection,paintAnnotations} from './annotations';
import PdfCrop from './PdfCrop';
import TranslatedText,{MathFormula} from './TranslatedText';
type Props={annotationState:AnnotationState;onSelection(f:SelectionFragment[],error?:string):void;side:Side;blocks:ContentBlock[];analysis:Analysis|null;pdf:PDFDocumentProxy|null;page:number;anchor:string|null;fraction:number;navigation:number;mode:string;font:number;pair:PairSelection|null;onPair(p:PairSelection|null):void;onRead(b:ContentBlock,fraction:number):void;onSource(b:ContentBlock):void};
export default function ReflowPane({annotationState,onSelection,side,blocks,analysis,pdf,page,anchor,fraction,navigation,mode,font,pair,onPair,onRead,onSource}:Props){
  const root=useRef<HTMLDivElement>(null),suppress=useRef(0),point=useRef<{id:string|null;fraction:number;page:number;y:number}>({id:anchor,fraction,page,y:0});
  const [menu,setMenu]=useState<{b:ContentBlock;x:number;y:number}|null>(null),menuRef=useRef<HTMLDivElement>(null);
  const revision=(analysis?.parse?.id||'')+'|'+blocks.map(b=>b.id+':'+(b.translation?.length||0)).join(',');
  function align(id:string|null,f:number){const el=id?root.current?.querySelector<HTMLElement>(`[data-block="${id}"]`):root.current?.querySelector<HTMLElement>(`[data-reading-page="${page}"]`);if(el&&root.current){suppress.current=performance.now()+250;root.current.scrollTop+=el.getBoundingClientRect().top-root.current.getBoundingClientRect().top+f*el.offsetHeight-22;}}
  useLayoutEffect(()=>{if(root.current)return paintAnnotations(root.current,annotationState,side);},[annotationState,revision,mode,font]);
  const lastNavigation=useRef(-1),lastMode=useRef(mode);
  useLayoutEffect(()=>{
    const explicit=lastNavigation.current!==navigation||lastMode.current!==mode;lastNavigation.current=navigation;lastMode.current=mode;
    let p=explicit?{id:anchor,fraction,page,y:0}:point.current;
    if(p.id&&!blocks.some(b=>b.id===p.id)){const nearest=blocks.filter(b=>b.regions.some(r=>r.page===p.page)).sort((a,b)=>Math.abs(a.regions[0].y-p.y)-Math.abs(b.regions[0].y-p.y))[0];p={...p,id:nearest?.id||null,fraction:0};}
    point.current=p;align(p.id,p.fraction);const frame=requestAnimationFrame(()=>align(p.id,p.fraction));return()=>cancelAnimationFrame(frame);
  },[navigation,mode,revision,font]);
  useEffect(()=>{const el=root.current;if(!el)return;let width=el.clientWidth;const observer=new ResizeObserver(()=>{if(el.clientWidth!==width){width=el.clientWidth;align(point.current.id,point.current.fraction);}});observer.observe(el);return()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{
    if(!pair||pair.origin===side)return;
    const first=pair.items[0],el=root.current?.querySelector<HTMLElement>(`[data-block="${first.id}"]${first.segments?.length?` [data-segment="${first.segments[0]}"]`:''}`),scroll=root.current;
    if(el&&scroll){const r=el.getBoundingClientRect(),v=scroll.getBoundingClientRect();if(r.top<v.top+30||r.bottom>v.bottom-30){suppress.current=performance.now()+250;scroll.scrollTop+=r.top-v.top-v.height*.3;}}
  },[pair]);
  useEffect(()=>{if(!menu)return;menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();const dismiss=(e:Event)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(null);},escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(null);root.current?.querySelector<HTMLElement>(`[data-block="${menu.b.id}"]`)?.focus({preventScroll:true});}};window.addEventListener('pointerdown',dismiss);window.addEventListener('blur',dismiss);window.addEventListener('keydown',escape);return()=>{window.removeEventListener('pointerdown',dismiss);window.removeEventListener('blur',dismiss);window.removeEventListener('keydown',escape);};},[menu]);
  function openMenu(b:ContentBlock,x:number,y:number){setMenu({b,x:Math.max(8,Math.min(x,innerWidth-250)),y:Math.max(8,Math.min(y,innerHeight-125))});}
  function finishSelection(){const p=root.current&&selectedPairs(root.current,blocks,side);if(p){onPair(p);try{onSelection(captureSelection(root.current!,annotationState.contexts,side));}catch(e){onSelection([],String((e as Error).message));}}else if(window.getSelection()?.isCollapsed){onPair(null);onSelection([]);}}
  function article(b:ContentBlock){
    const old=analysis?.translations.filter(t=>t.block_id===b.id&&t.source_hash===b.source_hash).at(-1)?.text,translation=b.translation||old,equation=b.semanticType==='equation'||b.visualType==='equation',visual=b.display==='visual'&&!equation;
    const match=pair?.origin!==side?pair?.items.find(i=>i.id===b.id):null,aligned=hasAlignment(b),text=side==='en'?readableEnglish(b.text):translation||readableEnglish(b.text);
    const prose=aligned?b.alignment!.map((s,i)=><span data-segment={i} key={i} className={match?.segments?.includes(i)?'rp-pair-match':''}><TranslatedText text={side==='en'?readableEnglish(s.source)+(i<b.alignment!.length-1?' ':''):s.translation}/></span>):<span className={match?'rp-pair-match':''}><TranslatedText text={text}/></span>;
    return <article key={b.id} data-block={b.id} data-kind={equation?'equation':visual?'visual':'text'} data-language={visual?'original':side==='en'||!translation?'en':'zh'} data-pair-scope={match?.scope} className={`rp-block ${visual?'rp-visual-block':''} ${equation?'rp-equation-block':''}`} tabIndex={0} onContextMenu={e=>{e.preventDefault();openMenu(b,e.clientX,e.clientY);}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();openMenu(b,r.x+20,r.y+20);}}}>
      {equation?<div className={match?'rp-pair-media':''}>{b.latex?<MathFormula latex={b.latex} number={b.equation_number}/>:<div className="rp-equation-pending">公式待转换为数学排版，可查看 PDF 原稿。</div>}</div>:visual?<figure className={match?'rp-pair-media':''}><PdfCrop pdf={pdf} region={b.regions[0]} label={`第 ${b.page} 页原始图表`}/></figure>:b.kind==='heading'?<h2 className={side==='en'?'rp-en':'rp-zh'}>{prose}</h2>:<p className={side==='en'||!translation?'rp-en':'rp-zh'} lang={side==='en'||!translation?'en':'zh-CN'}>{prose}</p>}
    </article>;
  }
  return <section className={`rp-content-pane rp-reflow-pane rp-${side}`} data-side={side}><div className="rp-pane-heading">{side==='en'?'英文原文 · 重排阅读':'中文译文 · 连续阅读'}<span>{side==='en'?'段落、标题与公式':'未译内容显示英文'}</span></div>
    <div className="rp-content-scroll" ref={root} style={{fontSize:font}} tabIndex={0} aria-label={side==='en'?'英文重排阅读区':'中文全文阅读区'} onPointerUp={finishSelection} onKeyUp={finishSelection} onWheel={()=>{suppress.current=0;setMenu(null);}} onPointerDown={()=>{suppress.current=0;}} onTouchStart={()=>{suppress.current=0;setMenu(null);}} onScroll={()=>{
      if(performance.now()<suppress.current||!root.current)return;
      const top=root.current.getBoundingClientRect().top+25,el=[...root.current.querySelectorAll<HTMLElement>('[data-block]')].find(el=>el.getBoundingClientRect().bottom>top),b=blocks.find(b=>b.id===el?.dataset.block);if(!el||!b)return;
      const f=Math.max(0,Math.min(.999,(top-el.getBoundingClientRect().top)/Math.max(1,el.offsetHeight))),r=b.regions[Math.min(b.regions.length-1,Math.floor(f*b.regions.length))];point.current={id:b.id,fraction:f,page:r.page,y:r.y};onRead(b,f);
    }}>
      {!analysis?.parse?<div className="rp-content-empty"><h2>正在整理阅读正文</h2><p>从本地 PDF 提取段落、标题和图表。</p></div>:analysis.parse.pages.map(p=><section className="rp-reading-page" data-reading-page={p.page} key={p.page}>{blocks.filter(b=>b.page===p.page).map(article)}{p.layout==='error'&&<p className="rp-content-warning">此页解析失败，请查看 PDF 原稿。</p>}{!blocks.some(b=>b.regions.some(r=>r.page===p.page))&&p.layout==='no-text'&&<p className="rp-content-warning">此页无可提取正文，请查看 PDF 原稿；OCR 尚未接入。</p>}</section>)}
    </div>
    {menu&&<div className="rp-source-menu" role="menu" aria-label="正文操作" ref={menuRef} style={{left:menu.x,top:menu.y}}><button role="menuitem" onClick={()=>{onSource(menu.b);setMenu(null);}}>查看 PDF 原稿</button><small>第 {menu.b.page} 页{menu.b.confidence==='page'?' · 仅定位到页面':menu.b.location==='model'?' · 模型识别区域，请核对':''}</small></div>}
  </section>;
}
