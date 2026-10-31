import type {AnnotationContext,AnnotationState,SelectionFragment} from './desktop';
import type {Side} from './bilingual/selection';
function nodes(el:Element){return [...el.querySelectorAll('[data-prose-text]')].flatMap(el=>[...el.childNodes].filter((n):n is Text=>n.nodeType===Node.TEXT_NODE));}
export function captureSelection(root:HTMLElement,contexts:AnnotationContext[],side:Side):SelectionFragment[]{
 const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return [];
 const range=selection.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return [];
 if([...root.querySelectorAll('.rp-inline-math,.rp-math-unverified,.rp-equation-line,figure')].some(el=>{if(!range.intersectsNode(el))return false;const r=range.cloneRange(),whole=document.createRange();whole.selectNodeContents(el);if(r.compareBoundaryPoints(Range.START_TO_START,whole)<0)r.setStart(whole.startContainer,whole.startOffset);if(r.compareBoundaryPoints(Range.END_TO_END,whole)>0)r.setEnd(whole.endContainer,whole.endOffset);return !!r.toString().trim();}))throw new Error('本次批注支持正文文字；选区包含公式或图表，请缩小文字选区。');
 const fragments:SelectionFragment[]=[];
 for(const el of root.querySelectorAll<HTMLElement>('[data-kind=text][data-block]')){
  if(!range.intersectsNode(el))continue;
  const ns=nodes(el),full=ns.map(n=>n.data).join(''),context=contexts.find(c=>c.block_id===el.dataset.block&&c.side===side);
  let offset=0,start=-1,end=-1;
  for(const n of ns){const nr=document.createRange();nr.selectNodeContents(n);if(range.compareBoundaryPoints(Range.END_TO_START,nr)<0&&range.compareBoundaryPoints(Range.START_TO_END,nr)>0){const a=range.startContainer===n?range.startOffset:0,b=range.endContainer===n?range.endOffset:n.length;if(b>a){if(start<0)start=offset+a;end=offset+b;}}offset+=n.length;}
  if(start<0||!full.slice(start,end).trim())continue;
  if(!context||context.full!==full)throw new Error('正文正在更新，请稍后重新选文。');
  fragments.push({...context,start,end,quote:full.slice(start,end),segments:[...el.querySelectorAll<HTMLElement>('[data-segment]')].filter(s=>range.intersectsNode(s)).map(s=>Number(s.dataset.segment))});
 }
 return fragments;
}
export function proseRange(el:Element,start:number,end:number){const ns=nodes(el),range=document.createRange();let offset=0,found=false;for(const n of ns){if(!found&&start<=offset+n.length){range.setStart(n,start-offset);found=true;}if(found&&end<=offset+n.length){range.setEnd(n,end-offset);return range;}offset+=n.length;}return null;}
// CSS Highlight paints ranges without modifying React text nodes or the native selection.
export function paintAnnotations(root:HTMLElement,state:AnnotationState,side:Side){
 const registry=(CSS as unknown as {highlights:Map<string,unknown>}).highlights,HighlightCtor=(window as unknown as {Highlight:new(...ranges:Range[])=>unknown}).Highlight;
 const names=['yellow','green','pink'].map(c=>`note-${side}-${c}`);if(!registry||!HighlightCtor)return;
 for(const color of ['yellow','green','pink']){const ranges:Range[]=[];for(const n of state.notes.filter(n=>n.color===color))for(const f of n.fragments){if(f.side!==side||f.status!=='exact')continue;const c=state.contexts.find(c=>c.block_id===f.block_id&&c.side===side);if(c?.version!==f.version)continue;const el=root.querySelector(`[data-block="${f.block_id}"]`),r=el&&proseRange(el,f.start,f.end);if(r)ranges.push(r);}registry.set(`note-${side}-${color}`,new HighlightCtor(...ranges));}
 return()=>names.forEach(n=>registry.delete(n));
}
