const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {runCodex}=require('../electron/bilingual.cjs');
async function executable(t,code){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'paper-cli-contract-'));
 const file=path.join(dir,'fake-codex');await fs.writeFile(file,'#!/usr/bin/env node\n'+code);await fs.chmod(file,0o700);t.after(()=>fs.rm(dir,{recursive:true,force:true}));return file;
}
test('CLI adapter passes text only via stdin, disables tools, uses schema and deletes isolated files',async t=>{
 const file=await executable(t,`const fs=require('node:fs');let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const args=process.argv.slice(2),p=JSON.parse(input),output=args[args.indexOf('-o')+1],schema=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1]));fs.writeFileSync(output,JSON.stringify({id:p.id,translation:JSON.stringify({args,root:process.cwd(),source:p.source,schema,secretInherited:!!process.env.PAPER_READER_TEST_SECRET})}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message'}}));});`);
 process.env.PAPER_READER_TEST_SECRET='never-forward';t.after(()=>delete process.env.PAPER_READER_TEST_SECRET);
 const result=await runCodex({executable:file,model:'explicit-model'},{id:'a',text:'Quoted `$(touch ignored)` text'},new AbortController().signal),info=JSON.parse(result.translation);
 assert.equal(result.id,'a');assert.equal(info.secretInherited,false);assert.equal(info.source,'Quoted `$(touch ignored)` text');assert.ok(!info.args.includes(info.source));assert.ok(info.args.includes('--ignore-user-config'));assert.ok(info.args.includes('shell_tool'));assert.ok(info.args.includes('code_mode_host'));assert.equal(info.schema.additionalProperties,false);await assert.rejects(fs.stat(info.root));
});
test('CLI adapter rejects any tool event and kills rather than accepting its output',async t=>{
 const file=await executable(t,`console.log(JSON.stringify({type:'item.started',item:{type:'command_execution'}}));setTimeout(()=>{},30000);`);
 await assert.rejects(runCodex({executable:file,model:'explicit-model'},{id:'a',text:'data'},new AbortController().signal),/tool call/);
});
test('CLI pause/abort ends an active subprocess promptly',async t=>{
 const file=await executable(t,'process.stdin.resume();setTimeout(()=>{},30000);'),controller=new AbortController();
 const start=Date.now(),promise=runCodex({executable:file,model:'explicit-model'},{id:'a',text:'data'},controller.signal);setTimeout(()=>controller.abort(),100);
 await assert.rejects(promise,/Interrupted/);assert.ok(Date.now()-start<3000);
});
test('CLI timeout waits for process exit and removes its working directory',async t=>{
 const marker=path.join(await fs.mkdtemp(path.join(os.tmpdir(),'paper-cli-timeout-')),'marker');t.after(()=>fs.rm(path.dirname(marker),{recursive:true,force:true}));
 const file=await executable(t,`require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,cwd:process.cwd()}));process.stdin.resume();setInterval(()=>{},1000);`);
 await assert.rejects(runCodex({executable:file,model:'explicit-model'},null,new AbortController().signal,{images:[],prompt:{},instruction:'test',timeout:1500}),/timeout/);
 const info=JSON.parse(await fs.readFile(marker));assert.throws(()=>process.kill(info.pid,0));await assert.rejects(fs.stat(info.cwd));
});
