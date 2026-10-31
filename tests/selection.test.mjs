import {test} from 'node:test';import assert from 'node:assert/strict';
import {hasAlignment,readableEnglish} from '../src/bilingual/selection.ts';
test('sentence mapping requires complete original and translation, never inferred from lengths',()=>{
 const b={text:'First sentence. Second sentence.',translation:'第一句。第二句。',alignment:[{source:'First sentence.',translation:'第一句。'},{source:'Second sentence.',translation:'第二句。'}]};assert.equal(hasAlignment(b),true);b.alignment[1].translation='另一句。';assert.equal(hasAlignment(b),false);delete b.alignment;assert.equal(hasAlignment(b),false);
});
test('English reading removes PDF line breaks and line-end word splits without changing stored sources',()=>{const s='A trans\u00ad\nformer model\nuses cross-\nattention.';assert.equal(readableEnglish(s),'A transformer model uses cross-attention.');assert.ok(s.includes('\n'));});
