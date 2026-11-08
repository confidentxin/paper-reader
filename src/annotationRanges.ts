import type {SelectionFragment} from './desktop';
export type TextUnit={node:Node;text:string;math:boolean};
export function textUnits(el:Element,math=false):TextUnit[]{
 return [...el.querySelectorAll<HTMLElement>(math?'[data-prose-text],[data-annotation-math]':'[data-prose-text]')].flatMap<TextUnit>(el=>el.hasAttribute('data-annotation-math')?[{node:el,text:el.dataset.annotationMath||'',math:true}]:[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>({node:n,text:n.textContent||'',math:false})));
}
export function selectedPart(selection:Range,node:Node){
 if(!selection.intersectsNode(node))return null;
 const whole=document.createRange();whole.selectNodeContents(node);const r=selection.cloneRange();
 if(r.compareBoundaryPoints(Range.START_TO_START,whole)<0)r.setStart(whole.startContainer,whole.startOffset);
 if(r.compareBoundaryPoints(Range.END_TO_END,whole)>0)r.setEnd(whole.endContainer,whole.endOffset);
 return r.toString().trim()?r:null;
}
export function unitRange(el:Element,start:number,end:number,math=false){
 const range=document.createRange();let offset=0,found=false;
 for(const u of textUnits(el,math)){
  const last=offset+u.text.length;
  if(!found&&start<last){if(u.math)range.setStartBefore(u.node);else range.setStart(u.node,Math.max(0,start-offset));found=true;}
  if(found&&end<=last){if(u.math)range.setEndAfter(u.node);else range.setEnd(u.node,Math.max(0,end-offset));return range;}
  offset=last;
 }
 return null;
}
export function fragmentRange(el:Element,f:SelectionFragment){return unitRange(el,f.start,f.end,f.text_format==='math-1');}
