// Opt-in actual CLI test, a complete two-page deterministic English PDF (not a whole research paper).
import {_electron as electron} from 'playwright';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const prior=JSON.parse(await fs.readFile('artifacts/stage5/full-real-results.json','utf8')),root=path.dirname(prior.dataDir);
const app=await electron.launch({...process.env.READER_TEST_EXECUTABLE?{executablePath:process.env.READER_TEST_EXECUTABLE,args:[]}:{args:['.']},env:{...process.env,PAPER_READER_DATA_DIR:path.join(root,'data')}});
try{
 const page=await app.firstWindow();await page.locator('.rp-library').waitFor();const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(path.join(os.homedir(),'Library/Application Support/Paper Reader/library.sqlite'),{readOnly:true});const config=JSON.parse(db.prepare('SELECT config FROM model_settings WHERE id=1').get().config);db.close();assert.equal(config.provider,'codex');await page.evaluate(config=>window.reader.saveModelConfig(config),config);
 await page.locator('.rp-card-title').click();await page.getByLabel('论文对话输入',{exact:true}).waitFor();
 const docID=(await page.evaluate(()=>window.reader.list()))[0].id,turns=[];
 for(const question of ['请概括这份文档讲了什么，控制在 80 字以内并引用来源。','接着上一轮回答，说明文档是否给出了模型准确率的实测数字，控制在 80 字以内并引用来源。']){
  const previousCount=(await page.evaluate(id=>window.reader.annotationList(id),docID)).turns.length;const started=Date.now();await page.getByLabel('论文对话输入',{exact:true}).fill(question);await page.getByRole('button',{name:'发送论文对话',exact:true}).click();
  let turn;const deadline=Date.now()+240000;while(Date.now()<deadline){const entries=(await page.evaluate(id=>window.reader.annotationList(id),docID)).turns;turn=entries.at(-1);if(entries.length===previousCount+1&&turn&&turn.state!=='running')break;await new Promise(r=>setTimeout(r,250));}
  assert.equal(turn.state,'completed',turn.error);assert.ok(turn.citations.length);turns.push({question,answer:turn.answer,citations:turn.citations,scope:turn.scope,ms:Date.now()-started});
 }
 await page.getByRole('button',{name:'另存为 AI 笔记',exact:true}).last().click();await page.getByText('AI 回答已另存到笔记',{exact:true}).waitFor();await page.getByRole('button',{name:/^笔记 ·/}).click();
 const markdown=path.join(root,'real-notes.md');await app.evaluate(({dialog},p)=>{dialog.showSaveDialog=async()=>({filePath:p,canceled:false});},markdown);await page.getByRole('button',{name:'导出本论文 Markdown',exact:true}).click();await page.getByText('Markdown 已导出',{exact:true}).waitFor();assert.ok((await fs.readFile(markdown,'utf8')).includes('AI 生成内容'));
 await page.screenshot({path:'artifacts/stage5/real-notes.png'});
 await fs.writeFile('artifacts/stage5/real-chat.json',JSON.stringify({target:process.env.READER_TEST_EXECUTABLE,model:config.model,dataDir:path.join(root,'data'),scope:'Actual configured CLI; complete 2-page generated English fixture translation and two real conversation turns. Not full research-paper quality acceptance.',turns,markdown},null,2));
}finally{await app.close();}

