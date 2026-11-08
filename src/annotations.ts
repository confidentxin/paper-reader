import type {AnnotationContext,AnnotationState,SelectionFragment} from './desktop';
import {fragmentRange,selectedPart,textUnits,unitRange} from './annotationRanges';
import type {Side} from './bilingual/selection';
export function captureSelection(root:HTMLElement,contexts:AnnotationContext[],side:Side):SelectionFragment[]{
 const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return [];
 const range=selection.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return [];
 if([...root.querySelectorAll('figure')].some(el=>{if(!range.intersectsNode(el))return false;const r=range.cloneRange(),whole=document.createRange();whole.selectNodeContents(el);if(r.compareBoundaryPoints(Range.START_TO_START,whole)<0)r.setStart(whole.startContainer,whole.startOffset);if(r.compareBoundaryPoints(Range.END_TO_END,whole)>0)r.setEnd(whole.endContainer,whole.endOffset);return !!r.toString().trim();}))throw new Error('本次批注支持正文文字；选区包含图表，请缩小文字选区。');
 const fragments:SelectionFragment[]=[];
 for(const el of root.querySelectorAll<HTMLElement>('[data-block]:not([data-kind=visual])')){
  if(!range.intersectsNode(el))continue;
  const math=!!el.querySelector('[data-annotation-math]'),ns=textUnits(el,math),full=ns.map(n=>n.text).join(''),context=contexts.find(c=>c.block_id===el.dataset.block&&c.side===side&&(c.text_format==='math-1')===math);
  let offset=0,start=-1,end=-1;
  for(const u of ns){const r=selectedPart(range,u.node);if(r){const a=u.math?0:r.startContainer===u.node?r.startOffset:0,b=u.math?u.text.length:r.endContainer===u.node?r.endOffset:u.text.length;if(b>a){if(start<0)start=offset+a;end=offset+b;}}offset+=u.text.length;}
  if(start<0||!full.slice(start,end).trim())continue;
  if(!context||context.full!==full)throw new Error('正文正在更新，请稍后重新选文。');
  fragments.push({...context,start,end,quote:full.slice(start,end),segments:[...el.querySelectorAll<HTMLElement>('[data-segment]')].filter(s=>range.intersectsNode(s)).map(s=>Number(s.dataset.segment))});
 }
 return fragments;
}
export function proseRange(el:Element,start:number,end:number){return unitRange(el,start,end);}
// CSS Highlight paints ranges without modifying React text nodes or the native selection.
export function paintAnnotations(root:HTMLElement,state:AnnotationState,side:Side){
 const registry=(CSS as unknown as {highlights:Map<string,unknown>}).highlights,HighlightCtor=(window as unknown as {Highlight:new(...ranges:Range[])=>unknown}).Highlight;
 const names=['yellow','green','pink'].map(c=>`note-${side}-${c}`);if(!registry||!HighlightCtor)return;
 for(const color of ['yellow','green','pink']){const ranges:Range[]=[];for(const n of state.notes.filter(n=>n.highlighted!==false&&n.color===color))for(const f of n.fragments){if(f.side!==side||f.status!=='exact')continue;const c=state.contexts.find(c=>c.block_id===f.block_id&&c.side===side&&c.version===f.version);if(c?.version!==f.version)continue;const el=root.querySelector(`[data-block="${f.block_id}"]`),r=el&&fragmentRange(el,f);if(r)ranges.push(r);}registry.set(`note-${side}-${color}`,new HighlightCtor(...ranges));}
 return()=>names.forEach(n=>registry.delete(n));
}

// Hit test the actual validated text ranges, never the whole paragraph or stale geometry.
export function annotationsAtPoint(root:HTMLElement,state:AnnotationState,side:Side,x:number,y:number){
 return state.notes.filter(n=>n.highlighted!==false&&n.fragments.some(f=>{
  if(f.side!==side||f.status!=='exact')return false;
  const c=state.contexts.find(c=>c.block_id===f.block_id&&c.side===side&&c.version===f.version);if(c?.version!==f.version)return false;
  const el=root.querySelector(`[data-block="${f.block_id}"]`),range=el&&fragmentRange(el,f);
  return range&&[...range.getClientRects()].some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);
 }));
}
