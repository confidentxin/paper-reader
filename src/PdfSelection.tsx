import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {Annotation,AnnotationContext,AnnotationState,SelectionFragment} from './desktop';
import {selectedPart} from './annotationRanges';
import SelectionToolbar,{SavedHighlightToolbar,SelectionNotice,type SelectionActionTarget,type HighlightActionTarget} from './SelectionToolbar';
export function pdfRange(root:HTMLElement,start:number,end:number){
 const r=document.createRange();let found=false;
 for(const el of root.querySelectorAll<HTMLElement>('[data-pdf-start]')){const n=el.firstChild,a=Number(el.dataset.pdfStart),b=a+(n?.textContent?.length||0);if(!n||n.nodeType!==3)continue;
  if(!found&&start<b){r.setStart(n,Math.max(0,start-a));found=true;}
  if(found&&end<=b){r.setEnd(n,Math.max(0,end-a));return r;}
 }
 return null;
}
function capturePDF(root:HTMLElement,pageBox:HTMLElement,c:AnnotationContext){
 const s=getSelection();if(!s?.rangeCount||s.isCollapsed)return [];const r=s.getRangeAt(0);if(!root.contains(r.startContainer)||!root.contains(r.endContainer))return [];
 let start=-1,end=-1;
 for(const el of root.querySelectorAll<HTMLElement>('[data-pdf-start]')){const n=el.firstChild;if(!n||n.nodeType!==3)continue;const part=selectedPart(r,n);if(!part)continue;const base=Number(el.dataset.pdfStart);if(start<0)start=base+part.startOffset;end=base+part.endOffset;}
 if(start<0||end<=start||!c.full.slice(start,end).trim())return [];
 const box=pageBox.getBoundingClientRect(),regions=[...r.getClientRects()].filter(r=>r.width>0&&r.height>0&&r.right>box.left&&r.left<box.right&&r.bottom>box.top&&r.top<box.bottom).map(r=>{const x=Math.max(0,(r.left-box.left)/box.width),y=Math.max(0,(r.top-box.top)/box.height);return {page:c.page,x,y,width:Math.max(0,Math.min(1-x,r.width/box.width)),height:Math.max(0,Math.min(1-y,r.height/box.height))};});
 if(!regions.length)throw new Error('未能定位选区，请重新选中文字。');
 return [{...c,start,end,quote:c.full.slice(start,end),regions}];
}
type Props={root:RefObject<HTMLDivElement|null>;pageBox:RefObject<HTMLDivElement|null>;context:AnnotationContext;state:AnnotationState;onSelection(f:SelectionFragment[],error?:string):void;onHighlight(f:SelectionFragment[],c:Annotation['color']):Promise<void>;onNote(f:SelectionFragment[]):void;onAsk(f:SelectionFragment[]):void;onChangeHighlight(id:string,c:Annotation['color']):Promise<void>;onRemoveHighlight(id:string):Promise<void>};
export default function PdfSelection(props:Props){
 const [actions,setActions]=useState<SelectionActionTarget|null>(null),[saved,setSaved]=useState<HighlightActionTarget|null>(null),[notice,setNotice]=useState<{left:number;top:number;bottom:number;message:string}|null>(null),latest=useRef(props);latest.current=props;
 const close=()=>{setActions(null);setSaved(null);setNotice(null);};
 useLayoutEffect(()=>{const root=props.root.current;if(!root)return;const registry=CSS.highlights;
  for(const color of ['yellow','green','pink']){const ranges:Range[]=[];for(const n of props.state.notes.filter(n=>n.highlighted!==false&&n.color===color))for(const f of n.fragments){if(f.source_mode!=='pdf'||f.page!==props.context.page||f.version!==props.context.version||f.status!=='exact')continue;const r=pdfRange(root,f.start,f.end);if(r)ranges.push(r);}registry.set('note-pdf-'+color,new Highlight(...ranges));}
  return()=>{for(const color of ['yellow','green','pink'])registry.delete('note-pdf-'+color);};
 },[props.state,props.context]);
 useEffect(()=>{
  close();const root=props.root.current;if(!root)return;
  const finish=(e?:PointerEvent)=>{if(e&&(e.button!==0||(e.target as Element)?.closest?.('.rp-selection-toolbar')))return;const p=latest.current,s=getSelection();if(!s?.rangeCount)return;const r=s.getRangeAt(0);if(!root.contains(r.startContainer)||!root.contains(r.endContainer))return;
   if(s.isCollapsed){close();p.onSelection([]);if(!e)return;const notes=p.state.notes.filter(n=>n.highlighted!==false&&n.fragments.some(f=>{if(f.source_mode!=='pdf'||f.page!==p.context.page||f.version!==p.context.version||f.status!=='exact')return false;const r=pdfRange(root,f.start,f.end);return r&&[...r.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom);}));if(notes.length)setSaved({ids:notes.map(n=>n.id),left:e.clientX,top:e.clientY-5,bottom:e.clientY+5});return;}
   const rect=[...r.getClientRects()].find(r=>r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight);if(!rect)return;const position={left:rect.left+rect.width/2,top:rect.top,bottom:rect.bottom};setSaved(null);setNotice(null);
   try{const fragments=capturePDF(root,p.pageBox.current!,p.context);p.onSelection(fragments);setActions(fragments.length?{...position,fragments}:null);}catch(error){setActions(null);const message=(error as Error).message;setNotice({...position,message});p.onSelection([],message);}
  };
  const down=(e:Event)=>{if(!(e.target as Element)?.closest?.('.rp-selection-toolbar'))close();},changed=()=>{if(document.activeElement?.closest('.rp-selection-toolbar'))return;const s=getSelection();if(!s?.rangeCount||s.isCollapsed||!root.contains(s.getRangeAt(0).startContainer)){setActions(null);setNotice(null);}else setSaved(null);},key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();},up=(e:KeyboardEvent)=>{if(e.key!=='Escape'&&root.contains(e.target as Node))finish();};
  document.addEventListener('pointerup',finish);document.addEventListener('pointerdown',down);document.addEventListener('selectionchange',changed);document.addEventListener('keydown',key);document.addEventListener('keyup',up);window.addEventListener('resize',close);window.addEventListener('blur',close);const scroll=root.closest('.rp-pdf-scroll');scroll?.addEventListener('scroll',close);
  return()=>{document.removeEventListener('pointerup',finish);document.removeEventListener('pointerdown',down);document.removeEventListener('selectionchange',changed);document.removeEventListener('keydown',key);document.removeEventListener('keyup',up);window.removeEventListener('resize',close);window.removeEventListener('blur',close);scroll?.removeEventListener('scroll',close);};
 },[props.context]);
 return <>{actions&&<SelectionToolbar target={actions} onHighlight={props.onHighlight} onNote={props.onNote} onAsk={props.onAsk} onDismiss={close}/>} {saved&&<SavedHighlightToolbar target={saved} notes={props.state.notes.filter(n=>saved.ids.includes(n.id)&&n.highlighted!==false)} onChange={props.onChangeHighlight} onRemove={props.onRemoveHighlight} onDismiss={close}/>} {notice&&<SelectionNotice target={notice} message={notice.message} onDismiss={close}/>}</>;
}
