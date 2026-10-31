import { OPS, Util } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { parsePage, PARSER_VERSION } from './parser';
import { arrangePage } from './presentation';
import type { VisualMark } from './presentation';
export { PARSER_VERSION };
export async function pageImage(pdf:PDFDocumentProxy,p:number){
  const page=await pdf.getPage(p),base=page.getViewport({scale:1}),v=page.getViewport({scale:Math.min(2,1800/Math.max(base.width,base.height))});
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
  try{await page.render({canvas,viewport:v}).promise;return canvas.toDataURL('image/jpeg',.86);}finally{canvas.width=canvas.height=0;}
}
export async function parsePDFPage(pdf: PDFDocumentProxy, p: number) {
  const page = await pdf.getPage(p), viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const parsed=parsePage(p,content.items.flatMap(item=>{
    if(!('str' in item))return [];
    const t=Util.transform(viewport.transform,item.transform),h=Math.hypot(t[2],t[3]);
    return [{str:item.str,x:t[4]/viewport.width,y:(t[5]-h)/viewport.height,width:item.width/viewport.width,height:h/viewport.height,font:content.styles[item.fontName]?.fontFamily||item.fontName,rotated:Math.abs(t[1])>Math.abs(t[0])*.2}];
  }));
  // Render on a separate canvas to record actual raster/vector paint bounds, including vector figures.
  const scale=Math.min(1,1000/Math.max(viewport.width,viewport.height)),v=page.getViewport({scale});
  const target=document.createElement('canvas');target.width=Math.ceil(v.width);target.height=Math.ceil(v.height);
  const marks:VisualMark[]=[];
  try{
    await page.render({canvas:target,viewport:v,recordOperations:true}).promise;
    const ops=await page.getOperatorList(),boxes=page.recordedBBoxes;
    if(boxes)for(let i=0;i<ops.fnArray.length;i++){
      const op=ops.fnArray[i],image=[OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageXObjectRepeat,OPS.paintImageMaskXObject,OPS.paintImageMaskXObjectGroup,OPS.paintImageMaskXObjectRepeat,OPS.paintInlineImageXObjectGroup].includes(op);
      if(!boxes.isEmpty(i)&&(image||op===OPS.constructPath||op===OPS.shadingFill)){
        const x=boxes.minX(i),y=boxes.minY(i),right=boxes.maxX(i),bottom=boxes.maxY(i);
        marks.push({page:p,x,y,width:right-x,height:bottom-y,type:image?'image':'path'});
      }
    }
    return arrangePage(parsed,marks);
  }finally{target.width=target.height=0;}
}
