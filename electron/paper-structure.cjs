// Semantic metadata is separate from immutable text identity and geometry.
const PAPER_ROLES=['title','abstract','keywords','introduction','background','methods','results','discussion','conclusion','references','other'];
function headingRole(text){
 const t=String(text||'').normalize('NFKC').trim().replace(/^(?:(?:\d+(?:\.\d+)*|[IVX]+)[.)]?\s+|第[一二三四五六七八九十\d]+[章节]\s*)/i,'').replace(/[：:。.]$/,'').trim();
 const rules=[['abstract',/^(abstract|摘要)$/i],['keywords',/^(key\s*words?|关键词|关键字)$/i],['introduction',/^(introduction|引言|绪论|介绍)$/i],['background',/^(background|related work|背景|相关工作)$/i],['methods',/^(methods?|methodology|approach|model architecture|proposed (?:method|approach)|方法|研究方法|模型架构)$/i],['results',/^(results?(?: and discussion)?|experiments?(?: and results)?|evaluation|实验(?:结果)?|结果(?:与讨论)?|评估)$/i],['discussion',/^(discussion|limitations?|讨论|局限性?)$/i],['conclusion',/^(conclusions?(?: and future work)?|结论(?:与展望)?)$/i],['references',/^(references|bibliography|参考文献)$/i]];
 return rules.find(([,re])=>re.test(t))?.[0]||null;
}
function structureBlocks(blocks){
 let section='other',titleSeen=false,abstractPage=null;return blocks.map(b=>{
  if(section==='abstract'&&b.page!==abstractPage)section='other';
  const heading=b.kind==='heading'||b.semanticType==='heading',recognized=headingRole(b.text),explicit=PAPER_ROLES.includes(b.paper_role)?b.paper_role:null;
  let paper_role=explicit||'other',role_origin=explicit?(b.role_origin||'model'):'unclassified';
  if(recognized&&(heading||recognized==='abstract'||recognized==='keywords')){section=recognized;if(recognized==='abstract')abstractPage=b.page;paper_role=explicit||recognized;role_origin=explicit?role_origin:'heading';}
  else if(heading){
   if(!titleSeen&&b.page===1&&section==='other'){paper_role=explicit||'title';role_origin=explicit?role_origin:'heading';titleSeen=true;}
   if(section==='abstract'||section==='keywords')section='other';
  }else if(!explicit&&b.display!=='visual'){
   // Do not absorb footnotes, affiliations or the next page into an inferred abstract.
   if(section==='abstract'&&(/^[*∗†‡]/.test(b.text.trim())||/\S+@\S+/.test(b.text)))section='other';
   paper_role=section;role_origin=section==='other'?'unclassified':'heading';
  }
  return {...b,paper_role,role_origin};
 });
}
function glossaryForChat(snapshot){
 const out=[],seen=new Set();let used=0;
 for(const t of snapshot.reading?.glossary||[]){
  if(typeof t?.source!=='string'||typeof t.translation!=='string')continue;
  const source=t.source.trim(),translation=t.translation.trim(),key=source.toLowerCase();
  if(!source||!translation||source.length>160||translation.length>200||seen.has(key))continue;
  if(out.length>=80||used+source.length+translation.length>6000)break;
  seen.add(key);used+=source.length+translation.length;out.push({source,translation});
 }
 return out;
}
module.exports={PAPER_ROLES,headingRole,structureBlocks,glossaryForChat};
