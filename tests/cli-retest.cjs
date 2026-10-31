// Opt-in diagnostics around the unchanged production CLI adapter; only public/synthetic inputs.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const originalSpawn=cp.spawn;
let activeLog,activeStart;
const scrub=s=>s.replace(/(Bearer\s+)[^\s"']+/gi,'$1[REDACTED]').replace(/\b(?:sk-|sess-)[A-Za-z0-9_-]{12,}/g,'[REDACTED]').replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)["'\s:=]+)[^\s,"'}]+/gi,'$1[REDACTED]');
cp.spawn=function(...args){const child=originalSpawn(...args),log=activeLog,start=activeStart;if(log){for(const stream of ['stdout','stderr'])child[stream]?.on('data',chunk=>{log.push({ms:Date.now()-start,stream,text:scrub(chunk.toString()).slice(0,20000)});});child.on('close',(code,signal)=>log.push({ms:Date.now()-start,type:'close',code,signal}));}return child;};
const {runCodex}=require('../electron/bilingual.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'paper-cli-retest-'));await fs.chmod(root,0o700);console.log('Diagnostics',root);
 const config={executable:'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',model:'gpt-6.1-sol'},results=[];
 const version=cp.execFileSync(config.executable,['--version'],{encoding:'utf8'}).trim();
 const modes=['text','image','page'].includes(process.env.READER_RETEST_MODE)?[process.env.READER_RETEST_MODE]:['text','image'];
 for(const mode of modes){
  activeLog=[];activeStart=Date.now();console.log('START',mode,version);
  let request,b,sourcePage,sourceID;
  if(mode==='text'){b={id:'connection-test',text:'A matrix contains rows and columns.'};request={images:[],instruction:'Translate source into Simplified Chinese. Return only JSON with exactly id and translation. Do not use tools.',schema:{type:'object',properties:{id:{type:'string'},translation:{type:'string'}},required:['id','translation'],additionalProperties:false},prompt:{id:b.id,source:b.text},timeout:180000};}
  else{
   const {DatabaseSync}=require('node:sqlite'),cache=process.env.READER_REAL_CACHE_DIR;if(!cache)throw new Error('Explicit isolated cache required for public image');
   const db=new DatabaseSync(path.join(cache,'library.sqlite'),{readOnly:true}),{inputs,instruction,schema}=require('../electron/page-workflow.cjs');const row=db.prepare('SELECT document_id,pages FROM parse_runs ORDER BY created_at DESC LIMIT 1').get(),p=JSON.parse(row.pages)[3],asset=db.prepare('SELECT path FROM page_assets WHERE page=4 LIMIT 1').get();
   sourcePage=p;sourceID=row.document_id;
   if(mode==='image')request={images:[path.join(cache,asset.path)],instruction:'Read the attached public paper page. Return only the LaTeX for the scaled dot-product attention equation, and its printed equation number. Use no tools.',schema:{type:'object',properties:{latex:{type:'string'},number:{type:'string'}},required:['latex','number'],additionalProperties:false},prompt:{task:'transcribe the Attention equation on this page, LaTeX without delimiters'},timeout:180000};
   else request={images:[path.join(cache,asset.path)],instruction,schema,prompt:{task:'translate_pages',pages:inputs([p]),glossary:[],previous:null,next_page:[],vision:true},timeout:600000};
   db.close();
  }
  const live=path.join(root,mode+'-progress.json'),ticker=setInterval(()=>fs.writeFile(live,JSON.stringify(activeLog||[]),{mode:0o600}).catch(()=>{}),1000);
  let result;try{const response=await runCodex(config,b,new AbortController().signal,request);result={mode,ok:true,ms:Date.now()-activeStart,response};if(mode==='image')require('../electron/math.cjs').validateLatex(response.latex,true);if(mode==='page'){const normalized=require('../electron/page-workflow.cjs').normalizeResult(response,[sourcePage],sourceID);result.normalized=normalized;}}catch(e){result={mode,ok:false,ms:Date.now()-activeStart,error:e.message};}
  clearInterval(ticker);const events=activeLog;activeLog=null;const file=path.join(root,mode+'.json');await fs.writeFile(file,JSON.stringify({version,result,events},null,2),{mode:0o600});results.push({...result,log:file});console.log('RESULT',JSON.stringify(mode==='page'?{mode,ok:result.ok,ms:result.ms,error:result.error,blocks:result.normalized?.[0].blocks.length,equations:result.normalized?.[0].blocks.filter(b=>b.semanticType==='equation').map(b=>({latex:b.latex,number:b.equation_number}))}:result));
  const messages=events.filter(e=>e.stream==='stderr'||e.stream==='stdout'&&/"type":"error"/.test(e.text)).flatMap(e=>e.text.split('\n')).filter(s=>/websocket|https|timed? ?out|retry|unauthor|401|403|429|failed|error|not supported|not found|quota|limit/i.test(s));console.log('CONNECTION MESSAGES',JSON.stringify(messages.slice(-12)));
 }
 await fs.writeFile('artifacts/cli-retest-'+(process.env.READER_RETEST_LABEL?process.env.READER_RETEST_LABEL+'-':'')+(process.env.READER_RETEST_MODE||'basic')+'-results.json',JSON.stringify({version,root,results},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
