import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {arrangePage,flowBlocks} from '../src/bilingual/presentation.ts';
const block=(text,x,y,width=.7,height=.015)=>({text,page:1,order:0,kind:'paragraph',confidence:'geometry',regions:[{page:1,x,y,width,height}]});
test('native graphic bounds embed vector figures and tables while captions stay translatable',()=>{
 const blocks=[block('Table 1: Results from experiments',.1,.1),block('Model Accuracy',.12,.18),block('English body after the table',.1,.4)];blocks.forEach((b,i)=>b.order=i);
 const p=arrangePage({page:1,layout:'single-column',warning:'',blocks},[.16,.20,.30].map(y=>({page:1,x:.1,y,width:.7,height:.004,type:'path'})));
 const table=p.blocks.find(b=>b.visualType==='table');assert.ok(table);assert.ok(table.regions[0].height>.13);assert.equal(p.blocks[0].display,'text');assert.equal(p.blocks[1].display,'skip');assert.equal(p.blocks[2].display,'text');
 assert.equal(flowBlocks(p).filter(b=>b.display==='visual').length,1);assert.ok(flowBlocks(p).indexOf(table)<flowBlocks(p).indexOf(p.blocks[2]));
});
test('equation pixels replace broken formula fragments; prose with inline math still translates',()=>{
 const blocks=[block('Attention(Q, K, V) = softmax( )V',.25,.4,.5),block('QKT',.5,.39,.05),block('We use N = 6 identical layers in the encoder for the proposed model.',.1,.6)];blocks[0].kind='source';blocks[2].kind='source';blocks.forEach((b,i)=>b.order=i);
 const p=arrangePage({page:1,layout:'single-column',warning:'',blocks},[]);assert.ok(p.blocks.some(b=>b.visualType==='equation'));assert.equal(p.blocks[1].display,'skip');assert.equal(p.blocks[2].display,'text');
});
test('real raster/vector figures and ruled tables retain their true PDF regions',async()=>{
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs'),{createCanvas}=await import('@napi-rs/canvas');
 const parsed=JSON.parse(await fs.readFile('artifacts/parsed-samples.json','utf8')),results={};
 for(const [name,pages]of [['attention',[3,4,6,8]],['bert',[3,5,7]]]){
  const task=getDocument({data:new Uint8Array(await fs.readFile(`artifacts/samples/${name}.pdf`)),useSystemFonts:true}),pdf=await task.promise;
  for(const n of pages){
   const page=await pdf.getPage(n),v=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvas,viewport:v,recordOperations:true}).promise;
   const ops=await page.getOperatorList(),bb=page.recordedBBoxes,marks=[];
   for(let i=0;i<ops.fnArray.length;i++)if(!bb.isEmpty(i)&&[OPS.paintImageXObject,OPS.constructPath,OPS.paintInlineImageXObject,OPS.shadingFill].includes(ops.fnArray[i]))marks.push({page:n,x:bb.minX(i),y:bb.minY(i),width:bb.maxX(i)-bb.minX(i),height:bb.maxY(i)-bb.minY(i),type:ops.fnArray[i]===OPS.constructPath?'path':'image'});
   const result=arrangePage(parsed[name][n-1],marks),visuals=result.blocks.filter(b=>b.display==='visual');assert.ok(visuals.length,`${name}:${n} must have media`);
   for(const b of visuals)for(const r of b.regions)assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=1.00001&&r.y+r.height<=1.00001);
   if(name==='attention'&&n===6){const table=visuals.find(b=>b.visualType==='table');assert.ok(table);assert.ok(table.regions[0].y<.145&&table.regions[0].y+table.regions[0].height>.235);}
   if(name==='bert'&&n===7){assert.ok(visuals.filter(b=>b.visualType==='table').length>=3);assert.ok(visuals.find(b=>b.text==='表 3').regions[0].height<.3);}
   if(name==='bert'&&n===3){const figure=visuals.find(b=>b.visualType==='figure');assert.ok(figure);assert.ok(figure.regions[0].width>.7);}
   results[`${name}-${n}`]=result;canvas.width=canvas.height=0;
  }
  await task.destroy();
 }
 await fs.writeFile('artifacts/presentation-samples.json',JSON.stringify(results,null,2));
});
