// Geometry-only parser. Coordinates are normalized in the displayed (rotated) page.
export const PARSER_VERSION = 'geometry-1';
export type Region = { page: number; x: number; y: number; width: number; height: number };
export type ParsedBlock = { page: number; order: number; text: string; kind: 'heading' | 'paragraph' | 'source'; confidence: 'geometry' | 'page'; regions: Region[] };
export type ParsedPage = { page: number; layout: string; warning: string; blocks: ParsedBlock[] };
export type PositionedText = { str: string; x: number; y: number; width: number; height: number; font: string; rotated?: boolean };
type Line = { text: string; x: number; y: number; right: number; bottom: number; size: number; bold: boolean; sparse: boolean; rotated: boolean };
const median = (v: number[]) => [...v].sort((a,b) => a-b)[Math.floor(v.length/2)] || 0.015;
export function parsePage(page: number, input: PositionedText[]): ParsedPage {
  const valid = input.filter(i => i.str.trim() && [i.x,i.y,i.width,i.height].every(Number.isFinite));
  const rotated = valid.filter(i=>i.rotated);
  const items = valid.filter(i=>!i.rotated);
  if (!items.length && rotated.length) return { page, layout: 'single-column', warning: '旋转文字仅保留原页核对。', blocks: rotated.map((i,order)=>({page,order,text:i.str,kind:'source',confidence:'page',regions:[{page,x:Math.max(0,i.x),y:Math.max(0,i.y),width:Math.max(0,Math.min(i.width,1-Math.max(0,i.x))),height:Math.max(0,Math.min(i.height,1-Math.max(0,i.y)))}]})) }; 
  if (!items.length) return { page, layout: 'no-text', warning: '没有可提取文字；保留原页，OCR 尚未接入。', blocks: [] };
  const size = median(items.map(i => i.height).filter(h => h > 0.005));
  // Find a persistent gutter from text boxes, rather than accepting PDF stream order.
  let split = 0, score = 0;
  for (let x = 0.40; x <= 0.60; x += 0.01) {
    const left = items.filter(i => i.x + i.width < x && i.x + i.width > x - 0.15);
    const right = items.filter(i => i.x > x && i.x < x + 0.15);
    const crossing = items.filter(i => i.x < x - 0.01 && i.x + i.width > x + 0.01);
    const candidate = Math.min(left.length, right.length) - crossing.length * 3;
    if (candidate > score && left.length >= 8 && right.length >= 8) { score = candidate; split = x; }
  }
  const makeLines = (values: PositionedText[]) => {
    const rows: PositionedText[][] = [];
    for (const item of [...values].sort((a,b) => a.y-b.y || a.x-b.x)) {
      const row = rows.find(r => Math.abs((r[0].y + r[0].height) - (item.y + item.height)) < size * 0.4);
      if (row) row.push(item); else rows.push([item]);
    }
    return rows.map(row => {
      row.sort((a,b) => a.x-b.x);
      let text = '', sparse = false;
      row.forEach((i,n) => { const gap = n ? i.x - row[n-1].x - row[n-1].width : 0; if (gap > size * 2.5) sparse = true; text += (gap > size * 0.15 && !text.endsWith(' ') ? ' ' : '') + i.str; });
      return { text: text.replace(/\s+/g,' ').trim(), x: Math.min(...row.map(i=>i.x)), y: Math.min(...row.map(i=>i.y)), right: Math.max(...row.map(i=>i.x+i.width)), bottom: Math.max(...row.map(i=>i.y+i.height)), size: median(row.map(i=>i.height)), bold: row.some(i=>/bold|black/i.test(i.font)), sparse, rotated: row.some(i=>i.rotated) };
    }).sort((a,b)=>a.y-b.y);
  };
  let groups: Line[][];
  if (split) {
    const wide = makeLines(items.filter(i => i.x < split && i.x+i.width > split + 0.015));
    const rest = items.filter(i => !(i.x < split && i.x+i.width > split + 0.015));
    groups = [];
    let top = -1;
    // Full-width title/abstract/figure captions divide the page into reading bands.
    for (const line of [...wide, { y: 2, bottom: 2 } as Line]) {
      const band = rest.filter(i=>i.y >= top && i.y < line.y - size * 0.3);
      groups.push(makeLines(band.filter(i=>i.x < split)), makeLines(band.filter(i=>i.x >= split)));
      if (line.y < 2) groups.push([line]);
      top = line.y + size * 0.3;
    }
  } else groups = [makeLines(items)];
  const blocks: ParsedBlock[] = [];
  for (const lines of groups) {
    let paragraph: Line[] = [];
    const flush = () => {
      if (!paragraph.length) return;
      const first = paragraph[0];
      let text = paragraph.map(l=>l.text).join('\n').replace(/-\n/g,'-').replace(/\n/g,' ');
      text = text.normalize('NFKC').replace(/\s+/g,' ').trim();
      const heading = paragraph.length <= 2 && text.length < 160 && (first.size > size * 1.18 || first.bold || /^(\d+(\.\d+)*\s+[A-Z]|Abstract$|References$|Acknowledg)/.test(text));
      const source = paragraph.some(l=>l.rotated || l.sparse || /[�∑∏∫√]|\b(?:Table|Figure)\s+\d|[=<>±]/.test(l.text)) || (text.replace(/[\p{L}\s]/gu,'').length > text.length * 0.32);
      blocks.push({ page, order: blocks.length, text, kind: source ? 'source' : heading ? 'heading' : 'paragraph', confidence: source ? 'page' : 'geometry', regions: paragraph.map(l=>({ page, x: +Math.max(0,l.x).toFixed(5), y: +Math.max(0,l.y).toFixed(5), width: +Math.max(0,Math.min(1,l.right)-Math.max(0,l.x)).toFixed(5), height: +Math.max(0,Math.min(1,l.bottom)-Math.max(0,l.y)).toFixed(5) })) });
      paragraph = [];
    };
    for (const line of lines) {
      const last = paragraph.at(-1);
      const heading = line.text.length < 140 && (line.size > size * 1.18 || line.bold || /^(\d+(\.\d+)*\s+[A-Z]|Abstract$|References$)/.test(line.text));
      if (last && (line.y-last.bottom > size * 0.55 || Math.abs(line.size-last.size) > size * 0.2 || heading || line.x-last.x > size * 0.65 || last.right < line.right - size * 2.5 || paragraph.map(l=>l.text).join('').length > 4500)) flush();
      paragraph.push(line);
      if (heading || line.sparse || line.rotated) flush();
    }
    flush();
  }
  for (const i of rotated) {const x=Math.max(0,Math.min(1,i.x)), y=Math.max(0,Math.min(1,i.y));blocks.push({page,order:blocks.length,text:i.str,kind:'source',confidence:'page',regions:[{page,x,y,width:Math.max(0,Math.min(i.width,1-x)),height:Math.max(0,Math.min(i.height,1-y))}]});}
  // Diagram labels are not paragraphs: keep dense short labels preceding an early figure caption on the source page.
  const caption=blocks.find(b=>/^Figure\s+\d/.test(b.text) && b.regions[0].y<.55);
  if(caption){const before=blocks.filter(b=>b.regions[0].y<caption.regions[0].y);if(before.length>5&&before.filter(b=>b.text.length<85).length/before.length>.65)for(const b of before){b.kind='source';b.confidence='page';}}
  return { page, layout: split ? 'two-column' : 'single-column', warning: '启发式段落与阅读顺序；跨页段落分开保存。公式、表格、图片及复杂布局请核对原页，不保证语义重建。', blocks };
}
