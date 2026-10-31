import type { ContentBlock } from '../desktop';
export type Side='en'|'zh';
export type PairSelection={origin:Side;items:{id:string;segments:number[]|null;scope:'sentence'|'paragraph'|'untranslated'|'content'}[]};
export function readableEnglish(text:string){return text.replace(/\u00ad\s*\n?\s*/g,'').replace(/-\s*\n\s*/g,'-').replace(/[ \t]*\n[ \t]*/g,' ').replace(/[ \t]{2,}/g,' ').trim();}
export function hasAlignment(b:ContentBlock){
  const a=b.alignment;
  return !!a?.length&&a.every(s=>s.source.trim()&&s.translation.trim())&&a.map(s=>s.source).join('').replace(/\s/g,'')===b.text.replace(/\s/g,'')&&a.map(s=>s.translation).join('').replace(/\s/g,'')===(b.translation||'').replace(/\s/g,'');
}
function selectedText(range:Range,el:Element){
  if(!range.intersectsNode(el))return false;
  const local=range.cloneRange(),whole=document.createRange();whole.selectNodeContents(el);
  if(local.compareBoundaryPoints(Range.START_TO_START,whole)<0)local.setStart(whole.startContainer,whole.startOffset);
  if(local.compareBoundaryPoints(Range.END_TO_END,whole)>0)local.setEnd(whole.endContainer,whole.endOffset);
  return !!local.toString().trim();
}
export function selectedPairs(root:HTMLElement,blocks:ContentBlock[],origin:Side):PairSelection|null{
  const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount||!selection.toString().trim())return null;
  const range=selection.getRangeAt(0);
  if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return null;
  const items:PairSelection['items']=[];
  for(const el of root.querySelectorAll<HTMLElement>('[data-block]')){
    if(!selectedText(range,el))continue;
    const b=blocks.find(b=>b.id===el.dataset.block);if(!b)continue;
    const segments=hasAlignment(b)?[...el.querySelectorAll<HTMLElement>('[data-segment]')].filter(s=>selectedText(range,s)).map(s=>Number(s.dataset.segment)):null;
    if(segments&&!segments.length)continue;
    items.push({id:b.id,segments,scope:b.semanticType==='equation'||b.visualType==='equation'||b.display==='visual'?'content':segments?'sentence':!b.translation?'untranslated':'paragraph'});
  }
  return items.length?{origin,items}:null;
}
