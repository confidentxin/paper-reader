import type { ParsedBlock, ParsedPage, Region } from './parser';
export const PRESENTATION_VERSION = 'visual-1';
export type VisualMark = Region & { type: 'image' | 'path' };
export type VisualBlock = ParsedBlock & { display?: 'text' | 'visual' | 'skip'; visualType?: 'figure' | 'table' | 'equation' | 'region' };
export type ReadingPage = Omit<ParsedPage,'blocks'> & { presentation_version?: string; blocks: VisualBlock[] };
const right=(r:Region)=>r.x+r.width, bottom=(r:Region)=>r.y+r.height;
const overlapX=(a:Region,b:Region)=>Math.max(0,Math.min(right(a),right(b))-Math.max(a.x,b.x));
const union=(rs:Region[]):Region=>{const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y));return {page:rs[0].page,x,y,width:Math.max(...rs.map(right))-x,height:Math.max(...rs.map(bottom))-y};};
const padded=(r:Region,n=.008):Region=>{const x=Math.max(0,r.x-n),y=Math.max(0,r.y-n);return {page:r.page,x,y,width:Math.min(1,right(r)+n)-x,height:Math.min(1,bottom(r)+n)-y};};
export function covered(b:ParsedBlock,region:Region) { return b.regions.filter(r=>{const x=r.x+r.width/2,y=r.y+r.height/2;return x>=region.x&&x<=right(region)&&y>=region.y&&y<=bottom(region);}).length/b.regions.length>=.7; }
export function arrangePage(parsed:ParsedPage, marks:VisualMark[]):ReadingPage {
  const blocks:VisualBlock[]=parsed.blocks.map(b=>({...b,display:'text'}));
  // Native PDF operation bounds are geometry, not a generated approximation of a figure.
  const candidates=marks.filter(r=>r.width*r.height<.82 && (r.type==='image'&&r.width*r.height>.001 || r.type==='path'&&(r.width>.035&&r.height>.025 || r.width>.16&&r.height<.018 || r.width<.018&&r.height>.08)));
  const captions=blocks.filter(b=>/^(Figure|Fig\.|Table)\s*\d/i.test(b.text));
  let groups:VisualMark[][]=[];
  for(const mark of candidates){let group=[mark];let changed=true;while(changed){changed=false;groups=groups.filter(g=>{
    const a=union(group),b=union(g),horizontal=overlapX(a,b),gap=Math.max(0,a.y-bottom(b),b.y-bottom(a));
    const touches=horizontal>0&&gap<.014 || Math.max(0,a.x-right(b),b.x-right(a))<.014 && Math.max(a.y,b.y)<Math.min(bottom(a),bottom(b));
    const captionBetween=captions.some(c=>{const r=union(c.regions);return overlapX(r,a)>.02&&overlapX(r,b)>.02&&r.y>=Math.min(bottom(a),bottom(b))-.002&&bottom(r)<=Math.max(a.y,b.y)+.002;});
    const rules=!captionBetween&&group.every(r=>r.type==='path'&&r.height<.018)&&g.every(r=>r.type==='path'&&r.height<.018)&&horizontal/Math.min(a.width,b.width)>.8&&Math.min(a.width,b.width)/Math.max(a.width,b.width)>.65&&gap<.12;
    if(touches||rules){group.push(...g);changed=true;return false;}return true;
  });}groups.push(group);}
  const assets=groups.filter(g=>{const r=union(g);return r.height>.035 && (g.some(m=>m.type==='image') || g.length>1 || r.width*r.height>.005);}).map(g=>{
    const raw=union(g),nearest=captions.map(b=>({b,r:union(b.regions)})).filter(c=>overlapX(raw,c.r)>.02&&Math.max(0,c.r.y-bottom(raw),raw.y-bottom(c.r))<.1).sort((a,b)=>Math.min(Math.abs(a.r.y-bottom(raw)),Math.abs(raw.y-bottom(a.r)))-Math.min(Math.abs(b.r.y-bottom(raw)),Math.abs(raw.y-bottom(b.r))))[0];
    return {region:raw,caption:nearest?.b,kind:nearest?/^Table/i.test(nearest.b.text)?'table':'figure':'region'};
  });
  // Several panels of one figure share a caption and stay together.
  for(let i=0;i<assets.length;i++)for(let j=assets.length-1;j>i;j--)if(assets[i].caption&&assets[i].caption===assets[j].caption){assets[i].region=union([assets[i].region,assets[j].region]);assets.splice(j,1);}
  const visuals:VisualBlock[]=[];
  for(const asset of assets){
    let region=padded(asset.region);
    if(asset.caption){const cr=union(asset.caption.regions);if(cr.y>=bottom(asset.region)-.004)region.height=Math.max(.005,Math.min(bottom(region),cr.y-.002)-region.y);else if(bottom(cr)<=asset.region.y+.004){const y=Math.max(region.y,bottom(cr)+.002);region={...region,y,height:bottom(region)-y};}}
    for(const b of blocks)if(!captions.includes(b)&&covered(b,region))b.display='skip';
    const number=asset.caption?.text.match(/\d+/)?.[0]||'';
    visuals.push({page:parsed.page,order:0,text:asset.kind==='table'?`表 ${number}`:asset.kind==='figure'?`图 ${number}`:'原始图表',kind:'source',confidence:'geometry',regions:[region],display:'visual',visualType:asset.kind as VisualBlock['visualType']});
  }
  for(const b of blocks){
    if(b.display==='skip')continue;
    if(/^arXiv:|^\d{1,4}$/.test(b.text.trim())){b.display='skip';continue;}
    // Preserve display equations as original pixels; ordinary prose with inline math is translated.
    const words=b.text.match(/[A-Za-z]{3,}/g)||[];
    if(b.kind==='source'&&!captions.includes(b)&&(/[=∑∏∫√]/.test(b.text)&&words.length<8 || /�/.test(b.text))){
      const region=padded(union(b.regions),.018);
      visuals.push({...b,text:'原始公式',confidence:'geometry',regions:[region],display:'visual',visualType:'equation'});
      b.display='skip';
      for(const other of blocks)if(other!==b&&other.text.length<100&&covered(other,region))other.display='skip';
    }
  }
  // Append synthetic visual blocks; existing text order/identity remains unchanged for valid caches.
  for(const v of visuals){v.order=blocks.length;blocks.push(v);}
  return {...parsed,presentation_version:PRESENTATION_VERSION,blocks};
}
export function flowBlocks<T extends VisualBlock>(page:{layout:string;blocks:T[]}) {
  const visible=page.blocks.filter(b=>b.display!=='skip');
  // Insert media at its actual reading band, preserving the parser's text order elsewhere.
  const text=visible.filter(b=>b.display!=='visual');
  for(const visual of visible.filter(b=>b.display==='visual').sort((a,b)=>a.regions[0].y-b.regions[0].y)){
    const r=visual.regions[0];
    let index=text.findIndex(b=>{const p=b.regions[0];return p.y>=r.y-.01 && (page.layout!=='two-column'||r.width>.55||(p.x<.5)===(r.x<.5));});
    if(index<0)index=text.length;text.splice(index,0,visual);
  }
  return text;
}
