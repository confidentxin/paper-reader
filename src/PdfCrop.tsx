import { memo, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { Region } from './bilingual/parser';
function PdfCrop({pdf,region,label}:{pdf:PDFDocumentProxy|null;region:Region;label:string}){
  const canvas=useRef<HTMLCanvasElement>(null),holder=useRef<HTMLDivElement>(null),[width,setWidth]=useState(620),[error,setError]=useState(''),[ready,setReady]=useState(false),[visible,setVisible]=useState(false),[aspect,setAspect]=useState(1.3);
  useEffect(()=>{let alive=true;pdf?.getPage(region.page).then(p=>{const v=p.getViewport({scale:1});if(alive)setAspect(v.height/v.width);}).catch(()=>{});return()=>{alive=false;};},[pdf,region.page]);
  useEffect(()=>{if(!holder.current)return;const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{rootMargin:'700px'});observer.observe(holder.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!holder.current)return;const ro=new ResizeObserver(entries=>setWidth(Math.max(150,Math.floor(entries[0].contentRect.width))));ro.observe(holder.current);return()=>ro.disconnect();},[]);
  useEffect(()=>{
    if(!visible){if(canvas.current)canvas.current.width=canvas.current.height=0;setReady(false);return;}
    if(!pdf||!canvas.current)return;let stopped=false,task:RenderTask|undefined;setReady(false);setError('');
    pdf.getPage(region.page).then(async page=>{
      if(stopped||!canvas.current)return;
      const base=page.getViewport({scale:1}),scale=Math.min(2.5,Math.max(1,width/(region.width*base.width))),viewport=page.getViewport({scale});
      const ratio=Math.min(window.devicePixelRatio||1,2,8192/Math.max(viewport.width*region.width,viewport.height*region.height),Math.sqrt(6_000_000/(viewport.width*region.width*viewport.height*region.height)));
      const target=canvas.current;target.width=Math.ceil(viewport.width*region.width*ratio);target.height=Math.ceil(viewport.height*region.height*ratio);
      task=page.render({canvas:target,viewport,transform:[ratio,0,0,ratio,-region.x*viewport.width*ratio,-region.y*viewport.height*ratio]});
      await task.promise;if(!stopped)setReady(true);
    }).catch(e=>{if(!stopped&&e.name!=='RenderingCancelledException')setError('原始区域暂时无法显示，请右键定位原文查看。');});
    return()=>{stopped=true;task?.cancel();};
  },[visible,pdf,region.page,region.x,region.y,region.width,region.height,width]);
  return <div ref={holder} className="rp-crop" style={{aspectRatio:region.width/(region.height*aspect)}} data-ready={ready} data-source-page={region.page} data-region={JSON.stringify(region)}><canvas ref={canvas} aria-label={label}/>{!ready&&!error&&<span>正在载入原始图表…</span>}{error&&<p role="alert">{error}</p>}</div>;
}
export default memo(PdfCrop,(a,b)=>a.pdf===b.pdf&&a.label===b.label&&a.region.page===b.region.page&&a.region.x===b.region.x&&a.region.y===b.region.y&&a.region.width===b.region.width&&a.region.height===b.region.height);
