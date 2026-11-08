// Original deterministic PDF fixture: no external document content.
function makePDF({ pages = 3, text = true, outline = true, extraLines = 0, semantic = false } = {}) {
  const objects = [];
  const add = value => { objects.push(value); return objects.length; };
  add(''); add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIDs = [];
  for (let i = 1; i <= pages; i++) {
    const extra = Array.from({length:extraLines},(_,line)=>`0 -40 Td (${semantic&&i===1&&line<3?['Abstract','This abstract discusses transformer evidence.','1 Introduction'][line]:`Additional reading paragraph ${i}.${line+1} with local evidence.`}) Tj`).join(' ');
    const content = text ? `BT /F1 18 Tf 55 735 Td (Reader fixture page ${i}) Tj 0 -40 Td (Searchable transformer evidence ${i}) Tj ${extra} ET` : '0.8 0.9 0.7 rg 50 100 400 600 re f';
    const stream = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    pageIDs.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${i % 2 ? 600 : 640} 800] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  let outlines;
  if (outline) {
    outlines = add('');
    const first = add(`<< /Title (Chapter one) /Parent ${outlines} 0 R /Next ${objects.length + 2} 0 R /Dest [${pageIDs[0]} 0 R /Fit] >>`);
    const last = add(`<< /Title (Chapter final) /Parent ${outlines} 0 R /Prev ${first} 0 R /Dest [${pageIDs.at(-1)} 0 R /Fit] >>`);
    objects[outlines - 1] = `<< /Type /Outlines /First ${first} 0 R /Last ${last} 0 R /Count 2 >>`;
  }
  const info = add('<< /Title (Reader fixture) /Author (Local test) >>');
  objects[0] = `<< /Type /Catalog /Pages 2 0 R ${outlines ? `/Outlines ${outlines} 0 R` : ''} >>`;
  objects[1] = `<< /Type /Pages /Count ${pages} /Kids [${pageIDs.map(id => `${id} 0 R`).join(' ')}] >>`;
  let body = '%PDF-1.7\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
module.exports = { makePDF };
