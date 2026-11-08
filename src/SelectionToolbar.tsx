import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Annotation,SelectionFragment} from './desktop';
export type HighlightColor=Annotation['color'];
type Position={left:number;top:number;bottom:number};
export type SelectionActionTarget=Position&{fragments:SelectionFragment[]};
export type HighlightActionTarget=Position&{ids:string[]};
const colors=[['yellow','黄色'],['green','绿色'],['pink','粉色']] as const;
function ToolbarFrame({target,label,children}:{target:Position;label:string;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),[position,setPosition]=useState({left:target.left,top:target.top});
 useLayoutEffect(()=>{
  const el=root.current;if(!el)return;
  const place=()=>{const box=el.getBoundingClientRect(),left=Math.max(8,Math.min(target.left-box.width/2,innerWidth-box.width-8)),top=target.top-box.height-8>=8?target.top-box.height-8:Math.max(8,Math.min(target.bottom+8,innerHeight-box.height-8));setPosition(p=>p.left===left&&p.top===top?p:{left,top});};
  place();const observer=new ResizeObserver(place);observer.observe(el);return()=>observer.disconnect();
 },[target]);
 return createPortal(<div ref={root} className="rp-selection-toolbar" role="toolbar" aria-label={label} style={position} onPointerDown={e=>{if(!(e.target instanceof HTMLSelectElement))e.preventDefault();}}>{children}</div>,document.body);
}
function ColorButtons({busy,current,onChoose}:{busy:boolean;current?:HighlightColor;onChoose(c:HighlightColor):void}){
 return <div className="rp-highlight-colors" role="group" aria-label="标注颜色">{colors.map(([color,label])=><button key={color} disabled={busy} title={label} aria-label={`${label}标注`} aria-pressed={current===color} onClick={()=>onChoose(color)}><span className={`rp-highlight-swatch rp-swatch-${color}`} aria-hidden="true"/>{label}</button>)}</div>;
}
type Props={target:SelectionActionTarget;onHighlight(f:SelectionFragment[],color:HighlightColor):Promise<void>;onNote(f:SelectionFragment[]):void;onAsk(f:SelectionFragment[]):void;onDismiss():void};
export default function SelectionToolbar({target,onHighlight,onNote,onAsk,onDismiss}:Props){
 const pending=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[palette,setPalette]=useState(false);
 async function highlight(color:HighlightColor){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await onHighlight(target.fragments,color);onDismiss();}catch(e){setError((e as Error).message||'标注未保存，请重试。');}finally{pending.current=false;setBusy(false);}}
 return <ToolbarFrame target={target} label="选文操作"><div className="rp-selection-actions"><button disabled={busy} onClick={()=>setPalette(p=>!p)} aria-expanded={palette}>标注</button><button disabled={busy} onClick={()=>{onNote(target.fragments);onDismiss();}}>笔记</button><button disabled={busy} onClick={()=>{onAsk(target.fragments);onDismiss();}}>问 AI</button></div>{target.fragments.some(f=>f.text_format==='math-1')&&<small className="rp-highlight-hint">公式按整体标注</small>}{palette&&<ColorButtons busy={busy} onChoose={c=>void highlight(c)}/>} {error&&<p role="alert">{error}</p>}</ToolbarFrame>;
}
export function SavedHighlightToolbar({target,notes,onChange,onRemove,onDismiss}:{target:HighlightActionTarget;notes:Annotation[];onChange(id:string,color:HighlightColor):Promise<void>;onRemove(id:string):Promise<void>;onDismiss():void}){
 const [selected,setSelected]=useState(notes[0]?.id),[busy,setBusy]=useState(false),[error,setError]=useState(''),pending=useRef(false),note=notes.find(n=>n.id===selected)||notes[0];
 async function action(fn:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await fn();onDismiss();}catch(e){setError((e as Error).message||'标注未更改，请重试。');}finally{pending.current=false;setBusy(false);}}
 if(!note)return null;
 return <ToolbarFrame target={target} label="已存标注操作">{notes.length>1&&<label className="rp-overlap-label">重叠标注 <select aria-label="选择标注" disabled={busy} value={note.id} onChange={e=>setSelected(e.target.value)}>{notes.map((n,i)=><option key={n.id} value={n.id}>{i+1}. {colors.find(c=>c[0]===n.color)?.[1]} · {n.note||n.fragments[0].quote}</option>)}</select></label>}<ColorButtons busy={busy} current={note.color} onChoose={c=>void action(()=>onChange(note.id,c))}/><div className="rp-selection-actions"><button disabled={busy} onClick={()=>void action(()=>onRemove(note.id))}>取消标注</button></div>{(note.note.trim()||note.kind==='ai')&&<small className="rp-highlight-hint">取消仅移除高亮，笔记保留</small>}{error&&<p role="alert">{error}</p>}</ToolbarFrame>;
}

export function SelectionNotice({target,message,onDismiss}:{target:Position;message:string;onDismiss():void}){return <ToolbarFrame target={target} label="选区提示"><p role="status">{message}</p><div className="rp-selection-actions"><button onClick={onDismiss}>关闭</button></div></ToolbarFrame>;}
