// Opt-in: one genuine multimodal request for Attention page 4, in an isolated copy.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {LibraryStore}=require('../electron/storage.cjs');const {BilingualService}=require('../electron/bilingual.cjs');const {instruction,schema,inputs,normalizeResult}=require('../electron/page-workflow.cjs');
(async()=>{
 const source=process.env.READER_REAL_CACHE_DIR;if(!source)throw new Error('Explicit isolated source cache required');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'paper-math-real-')),data=path.join(root,'data');await fs.cp(source,data,{recursive:true});
 const store=await new LibraryStore(data).open(),service=new BilingualService(store);try{
 const [doc]=store.list(),snap=service.snapshot(doc.id),p=snap.parse.pages[3],asset=store.db.prepare('SELECT path FROM page_assets WHERE document_id=? AND page=4').get(doc.id),config=service.config();
 const request={instruction,schema,prompt:{task:'translate_pages',pages:inputs([p]),glossary:snap.reading.glossary,previous:null,next_page:[],vision:true},images:[path.join(data,asset.path)],timeout:600000};
 console.log('Requesting actual page 4; isolated library',data);let raw,accepted;
 for(let attempt=0;attempt<2;attempt++){raw=await service.requestStructured(config,request,new AbortController().signal);try{accepted=normalizeResult(raw,[p],doc.id,snap.reading.glossary);break;}catch(e){await fs.writeFile('artifacts/math-actual-rejected-v34.json',JSON.stringify({error:e.message,raw},null,2));console.log('Validation:',e.message);request.prompt.repair=e.message;if(attempt)throw e;}}
 const result=accepted[0],equations=result.blocks.filter(b=>b.semanticType==='equation');if(!equations.length)throw new Error('No equation recognized');
 // Only this isolated model-test copy is updated for GUI verification. Formal library is never touched.
 const old=store.db.prepare('SELECT r.cache_key FROM page_results r JOIN job_items i ON i.cache_key=r.cache_key WHERE i.job_id=? AND r.page=4').get(snap.reading.job_id);
 store.db.exec('BEGIN IMMEDIATE');try{store.db.prepare('UPDATE page_results SET data=? WHERE cache_key=?').run(JSON.stringify(result),old.cache_key);for(const b of result.blocks)store.db.prepare('INSERT OR IGNORE INTO blocks VALUES (?,?,?,?,?)').run(b.id,doc.id,result.version,b.source_hash,JSON.stringify(b));store.db.exec('COMMIT');}catch(e){store.db.exec('ROLLBACK');throw e;}
 await fs.writeFile('artifacts/math-actual-page4-v34.json',JSON.stringify({scope:'one genuine CLI multimodal page; new equation schema and validation, isolated cache for UI; not whole-paper quality approval',dataDir:data,raw,result,equations:equations.map(b=>({latex:b.latex,number:b.equation_number,regions:b.regions}))},null,2));console.log('Accepted equations:',equations.map(b=>({latex:b.latex,number:b.equation_number})));console.log('DATA',data);
 }finally{await service.close();store.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
