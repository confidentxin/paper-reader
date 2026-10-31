import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parsePage} from '../src/bilingual/parser.ts';
const item=(str,x,y,width=.35,height=.015)=>({str,x,y,width,height,font:'Times'});
test('layout reconstruction ignores interleaved stream, reads left column before right, splits title',()=>{
 const data=[item('Paper title',.1,.07,.8,.03)];for(let i=0;i<12;i++){data.push(item(`Right ${i}`, .53,.2+i*.025),item(`Left ${i}`, .1,.2+i*.025));}
 const p=parsePage(1,data);assert.equal(p.layout,'two-column');const text=p.blocks.map(b=>b.text).join('|');assert.ok(text.indexOf('Left 11')<text.indexOf('Right 0'));assert.equal(p.blocks[0].kind,'heading');
 for(const b of p.blocks)for(const r of b.regions)assert.ok(r.x>=0&&r.x+r.width<=1);
});
test('no-text, equation, rotated text explicitly fall back to original page',()=>{
 assert.equal(parsePage(1,[]).layout,'no-text');assert.equal(parsePage(1,[item('x = y + z',.2,.3)]).blocks[0].kind,'source');assert.equal(parsePage(1,[{...item('Rotated',.2,.3),rotated:true}]).blocks[0].confidence,'page');
});
test('real single/double-column samples: extract all pages with reproducible geometry',async t=>{
 const {getDocument,Util}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const results={};
 for(const name of ['attention','bert']){
  let data;try{data=await fs.readFile(`artifacts/samples/${name}.pdf`);}catch{t.skip('sample unavailable');return;}
  const task=getDocument({data:new Uint8Array(data),useSystemFonts:true}), pdf=await task.promise, pages=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),v=page.getViewport({scale:1}),content=await page.getTextContent();
   const items=content.items.filter(i=>'str'in i).map(i=>{const tr=Util.transform(v.transform,i.transform),h=Math.hypot(tr[2],tr[3]);return {str:i.str,x:tr[4]/v.width,y:(tr[5]-h)/v.height,width:i.width/v.width,height:h/v.height,font:content.styles[i.fontName]?.fontFamily||i.fontName,rotated:Math.abs(tr[1])>Math.abs(tr[0])*.2};});
   const parsed=parsePage(p,items);assert.ok(parsed.blocks.length>0);pages.push(parsed);
  }
  results[name]=pages;
  assert.ok(pages.flatMap(p=>p.blocks).some(b=>b.kind==='heading'));
  if(name==='bert')assert.ok(pages.filter(p=>p.layout==='two-column').length>=10);
  await task.destroy();
 }
 await fs.writeFile('artifacts/parsed-samples.json',JSON.stringify(results,null,2));
 console.log(Object.fromEntries(Object.entries(results).map(([n,ps])=>[n,{pages:ps.length,blocks:ps.flatMap(p=>p.blocks).length,twoColumn:ps.filter(p=>p.layout==='two-column').length}])));
});
