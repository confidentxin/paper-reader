const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {LibraryStore}=require('../electron/storage.cjs');
const {BilingualService}=require('../electron/bilingual.cjs');
const {makePDF}=require('./fixtures.cjs');
async function setup(t,translate){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'paper-bilingual-')), store=await new LibraryStore(root).open();
 const source=path.join(root,'test.pdf');await fs.writeFile(source,makePDF());const staged=await store.stage(source),doc=await store.commit(staged.token,{pages:3,title:'Keep metadata'});
 const service=new BilingualService(store,null,translate);service.saveConfig({provider:'codex',executable:'/test/codex',model:'test'});
 t.after(async()=>{await service.close();store.close();await fs.rm(root,{recursive:true,force:true});});
 return {root,store,doc,service};
}
function payload(text='Source paragraph') {return {version:'geometry-1',pages:[1,2,3].map(page=>({page,layout:'single-column',warning:'heuristic',blocks:[0,1].map(order=>({page,order,text:`${text} ${page}.${order}`,kind:'paragraph',confidence:'geometry',regions:[{page,x:.1,y:.2+order*.2,width:.7,height:.1}]}))}))};}
async function idle(service){if(service.work)await service.work;}
test('v1 backup precedes explicit v3 migration and retains metadata, position, PDF bytes',async t=>{
 const s=await setup(t);s.store.update(s.doc.id,{page:2,offset:.37,zoom:'1.5',favorite:1});await s.service.close();s.store.close();
 // Build an actual v1 database in an independent directory from the original schema.
 const root=path.join(s.root,'legacy');await fs.mkdir(path.join(root,'documents'),{recursive:true});
 const db=new DatabaseSync(path.join(root,'library.sqlite'));
 db.exec('CREATE TABLE documents (id TEXT PRIMARY KEY,title TEXT,original_name TEXT,bytes INTEGER,pages INTEGER,category TEXT,favorite INTEGER,status TEXT,page INTEGER,offset REAL,zoom TEXT,imported_at TEXT,last_opened TEXT); PRAGMA user_version=1;');
 db.prepare('INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(s.doc.id,'Keep metadata','test.pdf',100,3,'研究',1,'reading',2,.37,'1.5','2026-10-17',null);db.close();
 await fs.copyFile(path.join(s.root,'documents',s.doc.id+'.pdf'),path.join(root,'documents',s.doc.id+'.pdf'));
 const upgraded=await new LibraryStore(root).open();assert.equal(upgraded.db.prepare('PRAGMA user_version').get().user_version,4);assert.equal(upgraded.get(s.doc.id).offset,.37);assert.equal(upgraded.get(s.doc.id).favorite,1);assert.deepEqual(Buffer.from(await upgraded.read(s.doc.id)),makePDF());
 const backups=await fs.readdir(path.join(root,'backups'));assert.equal(backups.length,1);const old=new DatabaseSync(path.join(root,'backups',backups[0]));assert.equal(old.prepare('PRAGMA user_version').get().user_version,1);assert.equal(old.prepare('SELECT page FROM documents').get().page,2);old.close();upgraded.close();
 // Return an open connection for cleanup.
 s.store.db=new DatabaseSync(path.join(s.root,'library.sqlite'));
});
test('stable content identity, historical parse preservation, coordinate validation and position',async t=>{
 const {service,doc,store}=await setup(t);let a=service.saveParse(doc.id,payload());const first=a.parse;
 const b=first.pages[0].blocks[0];assert.equal(b.source_hash.length,64);assert.equal(service.saveParse(doc.id,payload()).parse.id,first.id);
 service.position(doc.id,b.id,'focus');assert.equal(service.snapshot(doc.id).position.block_id,b.id);
 assert.throws(()=>service.saveParse(doc.id,{...payload(),version:'unknown'}));const bad=payload();bad.pages[0].blocks[0].regions[0].x=-1;assert.throws(()=>service.saveParse(doc.id,bad));
 a=service.saveParse(doc.id,payload('changed'));assert.notEqual(a.parse.id,first.id);assert.equal(store.db.prepare('SELECT count(*) AS n FROM parse_runs').get().n,2);
});
test('strict block response validation, partial retry only missing blocks, cache reuse and model isolation',async t=>{
 let calls=0,fail=true;
 const {service,doc}=await setup(t,async b=>{calls++;return {id:fail&&b.order===1?'wrong-id':b.id,translation:'测试译文 '+b.text};});
 const parsed=service.saveParse(doc.id,payload());let id=service.start(doc.id,{type:'page',page:1});await idle(service);
 let snapshot=service.snapshot(doc.id);assert.equal(snapshot.jobs[0].state,'partial');assert.equal(snapshot.translations.length,1);fail=false;
 service.resume(id);await idle(service);assert.equal(calls,3);assert.equal(service.snapshot(doc.id).translations.length,2);
 service.start(doc.id,{type:'page',page:1});await idle(service);assert.equal(calls,3);
 service.saveConfig({provider:'codex',executable:'/test/codex',model:'different'});service.start(doc.id,{type:'block',page:1,blockID:parsed.parse.pages[0].blocks[0].id});await idle(service);assert.equal(calls,4);
 assert.throws(()=>service.resume(id),/配置已变化/);
});
test('pause aborts in-flight block, cancellation leaves valid cache, resume after process restart',async t=>{
 let count=0;
 const {service,doc,store}=await setup(t,async(b,c,signal)=>{count++;if(count===1)return {id:b.id,translation:'已完成'};return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true});});});
 service.saveParse(doc.id,payload());const id=service.start(doc.id,{type:'page',page:1});
 while(count<2)await new Promise(r=>setTimeout(r,5));await service.stop(id);
 let snap=service.snapshot(doc.id);assert.equal(snap.jobs[0].state,'paused');assert.equal(snap.translations.length,1);assert.equal(snap.jobs[0].items[1].state,'pending');
 const reopened=new BilingualService(store,null,async b=>({id:b.id,translation:'恢复译文'}));reopened.resume(id);await idle(reopened);assert.equal(reopened.snapshot(doc.id).jobs[0].state,'completed');
 const other=reopened.start(doc.id,{type:'page',page:2});await reopened.stop(other,true);assert.equal(reopened.snapshot(doc.id).jobs.find(j=>j.id===other).state,'cancelled');assert.throws(()=>reopened.resume(other),/取消/);await reopened.close();
});
test('restart converts running to paused; changed parse cannot resume stale job',async t=>{
 const {service,doc,store}=await setup(t,async b=>({id:b.id,translation:'译文'}));service.saveParse(doc.id,payload());const id=service.start(doc.id,{type:'page',page:1});await idle(service);
 store.db.prepare("UPDATE jobs SET state='running' WHERE id=?").run(id);store.db.prepare("UPDATE job_items SET state='running' WHERE job_id=?").run(id);
 const reopened=new BilingualService(store);assert.equal(reopened.snapshot(doc.id).jobs[0].state,'paused');assert.ok(reopened.snapshot(doc.id).jobs[0].items.every(i=>i.state==='pending'));
 reopened.saveParse(doc.id,payload('new'));assert.throws(()=>reopened.resume(id),/解析版本/);await reopened.close();
});
test('provider configuration rejects insecure URLs, never returns secret, clears it on endpoint change',async t=>{
 const s=await setup(t), encryption={isEncryptionAvailable:()=>true,encryptString:k=>Buffer.from('cipher:'+k)};s.service.encryption=encryption;
 for(const baseURL of ['http://example.org','https://user:secret@example.org','https://example.org?key=secret'])assert.throws(()=>s.service.saveConfig({provider:'api',baseURL,model:'test'}));
 const saved=s.service.saveConfig({provider:'api',baseURL:'https://example.org/v1',model:'test',key:'private-key'});assert.ok(saved.hasKey);assert.ok(!JSON.stringify(saved).includes('private-key'));
 assert.equal(s.service.saveConfig({provider:'api',baseURL:'https://other.example/v1',model:'test'}).hasKey,false);
});
test('visual presentation reuses text identity; full scope includes captions/prose and excludes media labels',async t=>{
 const {service,doc}=await setup(t,async b=>({id:b.id,translation:'对应中文'}));const old=service.saveParse(doc.id,payload()),before=old.parse.pages[0].blocks[0].id;service.start(doc.id,{type:'block',page:1,blockID:before});await idle(service);const oldTranslation=service.snapshot(doc.id).translations[0];
 const data=payload();for(const p of data.pages){p.presentation_version='visual-1';p.blocks[0].display='text';p.blocks[1].display='skip';p.blocks.push({page:p.page,order:2,text:'原始表格',kind:'source',confidence:'geometry',regions:[{page:p.page,x:.1,y:.4,width:.7,height:.3}],display:'visual',visualType:'table'});}
 const parsed=service.saveParse(doc.id,data);assert.equal(parsed.parse.pages[0].blocks[0].id,before);assert.equal(parsed.parse.pages[0].presentation_version,'visual-1');const id=service.start(doc.id,{type:'all',page:2});await idle(service);const job=service.snapshot(doc.id).jobs.find(j=>j.id===id);assert.equal(job.items.length,3);assert.ok(job.items.every(i=>i.state==='done'));assert.ok(service.snapshot(doc.id).translations.some(t=>t.cache_key===oldTranslation.cache_key&&t.created_at===oldTranslation.created_at));
});
test('Codex full translation batches across pages and validates all IDs before atomic write',async t=>{
 const s=await setup(t);s.service.translateOverride=undefined;
 const exe=path.join(s.root,'fake-codex'),counter=path.join(s.root,'calls.txt');
 async function code(bad){await fs.writeFile(exe,`#!/usr/bin/env node\nconst fs=require('node:fs');let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const args=process.argv.slice(2),p=JSON.parse(input);fs.appendFileSync(${JSON.stringify(counter)},'x');const blocks=p.blocks||[p],translations=blocks.map((b,i)=>({id:${bad?'blocks[0].id':'b.id'},translation:'真实接口结构的模拟中文'}));fs.writeFileSync(args[args.indexOf('-o')+1],JSON.stringify(p.blocks?{translations}:translations[0]));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message'}}));});`);await fs.chmod(exe,0o700);}
 await code(true);s.service.saveConfig({provider:'codex',executable:exe,model:'test'});s.service.saveParse(s.doc.id,payload());const id=s.service.start(s.doc.id,{type:'all',page:2});await idle(s.service);assert.equal(s.service.snapshot(s.doc.id).jobs[0].state,'partial');assert.equal(s.service.snapshot(s.doc.id).translations.length,0);
 await code(false);const resumed=s.service.start(s.doc.id,{type:'all',page:1});assert.equal(resumed,id);await idle(s.service);const snap=s.service.snapshot(s.doc.id);assert.equal(snap.jobs[0].state,'completed');assert.equal(snap.translations.length,6);assert.equal((await fs.readFile(counter,'utf8')).length,2);
 s.service.start(s.doc.id,{type:'all',page:1});await idle(s.service);assert.equal((await fs.readFile(counter,'utf8')).length,2);
});
