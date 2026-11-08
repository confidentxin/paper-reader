const {test}=require('node:test'),assert=require('node:assert/strict');
const {structureBlocks,glossaryForChat}=require('../electron/paper-structure.cjs');
const block=(text,kind='paragraph',page=1,extra={})=>({id:text,text,kind,page,display:'text',...extra});
test('legacy abstract inference excludes headings, author footnotes and next section without mutating sources',()=>{
 const old=[block('A paper title','heading'),block('Alice University'),block('Abstract','heading'),block('Actual abstract first part.'),block('Actual abstract second part.'),block('∗Equal contribution.'),block('Author affiliations'),block('1 Introduction','heading'),block('This is the introduction.')],before=JSON.stringify(old),out=structureBlocks(old);
 assert.equal(JSON.stringify(old),before);assert.deepEqual(out.filter(b=>b.paper_role==='abstract').map(b=>b.text),['Abstract','Actual abstract first part.','Actual abstract second part.']);assert.equal(out.at(-1).paper_role,'introduction');assert.equal(out[0].paper_role,'title');assert.ok(out.every((b,i)=>b.id===old[i].id));
});
test('unclear titles and mentions of abstract do not become abstracts; legacy inference stops at page boundary',()=>{
 const out=structureBlocks([block('We abstract a representation.'),block('Abstract','heading'),block('Abstract body'),block('Another section without a heading','paragraph',2)]);assert.equal(out[0].paper_role,'other');assert.equal(out.at(-1).paper_role,'other');assert.ok(!structureBlocks([block('A title','heading'),block('Authors')]).some(b=>b.paper_role==='abstract'));
});
test('model roles are separate from block type, including explicit other and continued abstract',()=>{
 const out=structureBlocks([block('Abstract','heading'),block('Authors','paragraph',1,{paper_role:'other',role_origin:'model'}),block('Continued abstract','paragraph',2,{paper_role:'abstract',role_origin:'model'})]);assert.equal(out[1].paper_role,'other');assert.equal(out[2].paper_role,'abstract');assert.equal(out[2].role_origin,'model');
});
test('glossary reads only current structured snapshot, bounds values and deduplicates',()=>{
 const terms=glossaryForChat({reading:{glossary:[{source:'Attention',translation:'注意力'},{source:'attention',translation:'重复项'},{source:'',translation:'无效'},{source:'x'.repeat(161),translation:'过长'},...Array.from({length:100},(_,i)=>({source:'term'+i,translation:'术语'+i}))]}});assert.equal(terms.length,80);assert.deepEqual(terms[0],{source:'Attention',translation:'注意力'});assert.deepEqual(glossaryForChat({}),[]);
});
