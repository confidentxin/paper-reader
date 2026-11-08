const {glossaryForChat}=require('./paper-structure.cjs');
const {createHash}=require('node:crypto');
const PAPER_LIMIT=180000,HISTORY_LIMIT=45000,MAX_HISTORY=12;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function paperSummary(snapshot,document){
 const pages=snapshot.parse?.pages||[],textPages=pages.filter(p=>p.blocks.some(b=>b.display!=='visual'&&b.text.trim())).length;
 return {title:document.title,parse_id:snapshot.parse?.id||null,totalPages:document.pages,textPages,missingPages:pages.filter(p=>!p.blocks.some(b=>b.display!=='visual'&&b.text.trim())).map(p=>p.page),blocks:pages.reduce((n,p)=>n+p.blocks.filter(b=>b.display!=='visual').length,0)};
}
function paperSources(snapshot,id){
 if(!snapshot.parse)throw new Error('正在本地准备论文正文，请稍后发送。');
 return snapshot.parse.pages.flatMap(p=>p.blocks.filter(b=>b.display!=='visual'&&b.text.trim()).map(b=>({
  id:'C'+fingerprint([id,snapshot.parse.id,b.id,b.text]).slice(0,16),document_id:id,block_id:b.id,parse_id:snapshot.parse.id,source_mode:'paper',side:'en',language:'en',version:fingerprint(['paper-text-1',id,snapshot.parse.id,b.id,b.text]),page:b.page,source_order:b.order,regions:b.regions,full:b.text,original:b.text,role:'paper-text',kind:b.kind,content:b.text,
 })));
}
function selectedSources(fragments,id){return fragments.map(f=>({...f,id:'C'+fingerprint([id,f.block_id,f.version,f.start,f.end,f.quote]).slice(0,16),document_id:id,role:'selected',content:f.quote}));}
function terms(s){return String(s).toLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]/g)||[];}
function standardSources(all,contexts,fragments,requested,totalPages){
 const chosen=new Map(),en=contexts.filter(c=>c.source_mode!=='pdf'&&c.side==='en'&&(!c.text_format||!contexts.some(x=>x.block_id===c.block_id&&x.side==='en'&&!x.text_format)));let used=0,focus=null,chapter='';
 const add=(s,role,essential=false)=>{if(chosen.has(s.id))return;if(s.content.length>48000&&essential)throw new Error('当前段落过长，请选取较短文字或切换整篇论文。');if(!essential&&used+s.content.length>24000)return;chosen.set(s.id,{...s,role});used+=s.content.length;};
 const fromContext=(c,role)=>({...c,id:'C'+fingerprint(['reading-focus-1',all[0].document_id,c.parse_id,c.block_id,c.version,role]).slice(0,16),document_id:all[0].document_id,role,content:c.original});
 let target=null;
 if(fragments.length){target=en.find(c=>c.block_id===fragments[0].block_id);if(!target&&fragments[0].source_mode==='pdf')target=en.find(c=>c.page===fragments[0].page);}
 else if(requested!==null){
  if(requested?.parse_id&&requested.parse_id!==all[0].parse_id)throw new Error('阅读来源已更新，请重新确认当前段落。');
  if(requested?.block_id){target=en.find(c=>c.block_id===requested.block_id);if(!target)throw new Error('当前段落已变化，请重新定位后发送。');}
  else {const page=requested?.page??1;if(!Number.isInteger(page)||page<1||page>totalPages)throw new Error('阅读页码无效。');focus={page,kind:'page',origin:'reading'};target=en.find(c=>c.page===page);if(!target){const raw=all.find(s=>s.page===page);if(raw){add(raw,'current-page',true);focus.block_id=raw.block_id;}}}
 }
 if(target){
  add(fromContext(target,'current-paragraph'),'current-paragraph',true);
  const zh=contexts.find(c=>c.block_id===target.block_id&&c.side==='zh'&&c.language==='zh');if(zh)add({...fromContext(zh,'current-translation'),content:zh.full},'current-translation');
  const idx=en.indexOf(target);for(const c of en.slice(Math.max(0,idx-2),idx+3))if(c!==target)add(fromContext(c,'nearby-paragraph'),'nearby-paragraph');
  focus={page:target.page,block_id:target.block_id,kind:requested?.block_id||fragments.length?'paragraph':'page',origin:fragments.length?'selection':'reading'};
  const headings=all.filter(s=>s.kind==='heading'&&(s.page<target.page||s.page===target.page&&(s.source_order||0)<=(target.source_order||0)));chapter=headings.at(-1)?.content||'';
 }
 // Reuse the visible structured original. Abstract bodies exclude their heading and footnotes.
 const abstracts=en.filter(c=>c.paper_role==='abstract'&&c.kind!=='heading'&&c.semanticType!=='heading'&&!/^(abstract|摘要)[:：.]?$/i.test(c.original.trim()));
 const background=abstracts.length?abstracts.map(c=>fromContext(c,'paper-background')):all.filter(s=>s.page===1).slice(0,4);
 const backgroundInfo={kind:abstracts.length?'abstract':'fallback',availableBlocks:background.length,providedBlocks:0,origins:[...new Set(abstracts.map(c=>c.role_origin))]};
 let budget=6000;for(const s of background){if(s.content.length<=budget){const before=chosen.size;add(s,'paper-background');if(chosen.size>before){budget-=s.content.length;backgroundInfo.providedBlocks++;}}}
 const headings=en.filter(c=>c.kind==='heading'||c.semanticType==='heading');
 for(const c of headings.slice(0,40))add(fromContext(c,'section-heading'),'section-heading');
 if(target){const before=headings.filter(c=>c.page<target.page||c.page===target.page&&(c.source_order||0)<=(target.source_order||0));chapter=before.at(-1)?.original||chapter;}

 if(!chosen.size)add(all[0],'paper-background');
 return {sources:[...chosen.values()],focus,chapter,backgroundInfo};
}
function prepareChat(snapshot,document,question,fragments,previous,contexts=[],options={}){
 const all=paperSources(snapshot,document.id);if(!all.length)throw new Error('此论文暂无可提取正文；扫描件需要 OCR，当前尚未接入。');
 const contextMode=options.contextMode||'standard';if(!['standard','whole'].includes(contextMode))throw new Error('问答范围无效。');
 const completed=previous.filter(t=>t.mode==='paper-chat'&&t.state==='completed');
 let chars=0;const history=[];
 for(const t of completed.slice(-MAX_HISTORY).reverse()){
  const entry={turn_id:t.id,question:t.question,answer:t.answer,citations:t.citations,selected_sources:t.sources.filter(s=>s.role==='selected'&&(t.fragments||[]).some(f=>f.block_id===s.block_id&&f.version===s.version&&f.start===s.start&&f.end===s.end)),cited_sources:t.citations.map(c=>t.sources.find(s=>s.id===c.source_id)).filter(Boolean)};
  const size=JSON.stringify(entry).length;if(chars+size>HISTORY_LIMIT)break;chars+=size;history.unshift(entry);
 }
 const attached=selectedSources(fragments,document.id),fullSize=all.reduce((n,s)=>n+s.content.length,0);
 let selected=all,focus=null,chapter='',backgroundInfo=null;
 if(contextMode==='standard'){const standard=standardSources(all,contexts,fragments,options.focus,document.pages);selected=standard.sources;focus=standard.focus;chapter=standard.chapter;backgroundInfo=standard.backgroundInfo;}
 if(contextMode==='whole'&&fullSize>PAPER_LIMIT){
  // Local lexical selection is bounded and reported; it is never advertised as complete coverage.
  const query=new Set(terms(question+' '+history.slice(-2).map(t=>t.question).join(' ')+' '+fragments.map(f=>f.quote).join(' ')));
  const translated=new Map((snapshot.reading?.blocks||[]).map(b=>[b.page,(b.translation||'')]));
  const ranked=all.map((s,index)=>({s,index,score:(s.page===1?3:0)+terms(s.content+' '+(translated.get(s.page)||'')).reduce((n,w)=>n+(query.has(w)?1:0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  let used=0;const keep=new Set();for(const {s}of ranked)if(used+s.content.length<=PAPER_LIMIT){keep.add(s.id);used+=s.content.length;}
  selected=all.filter(s=>keep.has(s.id));
 }
 const sources=new Map(selected.map(s=>[s.id,s]));
 for(const h of history)for(const s of [...h.selected_sources,...h.cited_sources])if(s.document_id===document.id&&!sources.has(s.id))sources.set(s.id,{...s,role:'historical-evidence'});
 for(const s of attached)sources.set(s.id,s);
 // Current translated selections also receive their actual English paragraph, without replacing their identity.
 for(const f of fragments.filter(f=>f.language==='zh')){const en=contexts.find(c=>c.block_id===f.block_id&&c.side==='en');if(en){const s={...en,id:'C'+fingerprint([document.id,en.block_id,en.version,'paired-original']).slice(0,16),document_id:document.id,role:'paired-original',content:en.original};sources.set(s.id,s);}}
 const glossary=glossaryForChat(snapshot),summary=paperSummary(snapshot,document),scope={...summary,contextMode,focus,chapter,background:backgroundInfo,glossaryEntries:glossary.length,kind:contextMode==='standard'?'reading-context':fullSize<=PAPER_LIMIT?'full-text':'partial-text',providedBlocks:selected.length,totalBlocks:all.length,providedCharacters:selected.reduce((n,s)=>n+s.content.length,0),historyUsed:history.length,historyTotal:completed.length,attached:fragments.length};
 return {mode:'paper-chat',glossary,sources:[...sources.values()],history,scope};
}
function resolvePaper(fragment,snapshot){const b=snapshot.parse?.id===fragment.parse_id?snapshot.parse.pages.flatMap(p=>p.blocks).find(b=>b.id===fragment.block_id):null;return {...fragment,status:b?.text===fragment.full?'exact':'review',current_block:b?.text===fragment.full?b.id:null};}
module.exports={prepareChat,paperSummary,paperSources,resolvePaper,PAPER_LIMIT,MAX_HISTORY};
