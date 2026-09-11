import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {QUESTIONS,CATEGORIES,SOURCES} from '../dist/questions.js';
import {DIAGRAMS} from '../dist/diagrams.js';

assert.equal(QUESTIONS.length,360,'Expected 360 reviewed questions');
assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,QUESTIONS.length,'Duplicate IDs');
assert.equal(new Set(QUESTIONS.map(q=>q.stem)).size,QUESTIONS.length,'Duplicate questions');
for(const part of ['A','B']) assert.equal(QUESTIONS.filter(q=>q.part===part).length,180);
for(const c of CATEGORIES) assert(QUESTIONS.some(q=>q.category===c.id),c.id+' empty topic');
for(const id of Object.keys(DIAGRAMS)) assert(QUESTIONS.some(q=>q.id===id),id+' missing diagram question');
for(const q of QUESTIONS){
  assert(q.id.startsWith(q.part),q.id+' part');
  assert(CATEGORIES.some(c=>c.id===q.category&&c.part===q.part),q.id+' part/category mismatch');
  assert(CATEGORIES.some(c=>c.id===q.category),q.id+' category');
  assert.equal(q.options.length,4,q.id+' options');
  assert.equal(new Set(q.options).size,4,q.id+' duplicate options');
  assert(q.options.every(o=>typeof o==='string'&&o.trim().length>0),q.id+' empty option');
  assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<=3,q.id+' answer');
  assert(q.stem.length>=10&&q.explanation.length>=20,q.id+' incomplete question');
  assert(Number.isInteger(q.page)&&q.page>=1&&q.page<=311,q.id+' source page');
  if(q.sample!==null)assert(Number.isInteger(q.sample)&&q.sample>=1&&q.sample<=40,q.id+' sample number');
  assert.equal(q.checked,'2026-09-10');
  assert(!/[\uFFFD]/.test(q.stem+q.options.join('')+q.explanation),q.id+' broken characters');
}
for(const s of Object.values(SOURCES))assert(new URL(s.url).protocol==='https:');
const dist=resolve('dist');
const html=readFileSync(resolve(dist,'index.html'),'utf8');
assert(html.includes('lang="zh-Hant-HK"'));
assert(html.includes('name="viewport"'));
for(const m of html.matchAll(/(?:src|href)="(\.\/[^"#?]+)(?:[?#][^"]*)?"/g))assert(existsSync(resolve(dist,m[1])),'Missing '+m[1]);
const files=readdirSync(dist);
for(const file of files.filter(f=>f.endsWith('.js'))){
  const path=resolve(dist,file);execFileSync(process.execPath,['--check',path]);
  const source=readFileSync(path,'utf8');
  for(const m of source.matchAll(/from ['"](\.\/.+?)['"]/g))assert(existsSync(resolve(dirname(path),m[1])),file+' missing import '+m[1]);
}
assert(!html.includes('http://'),'Insecure local asset');
assert(!readFileSync(resolve(dist,'styles.css'),'utf8').includes('@import'),'No unnecessary external CSS dependency');
const bytes=files.reduce((sum,f)=>sum+(statSync(resolve(dist,f)).isFile()?statSync(resolve(dist,f)).size:0),0);
console.log(`PASS: ${QUESTIONS.length} questions, ${CATEGORIES.length} topics, 4 unique choices and a page reference for every question.`);
console.log(`PASS: entrypoint, asset references, relative module imports and JavaScript syntax; ${Math.round(bytes/1024)} KB total static payload.`);
console.log(`Official sample-linked questions: ${QUESTIONS.filter(q=>q.sample).length}. Source accuracy was reviewed editorially; these structural checks are not an independent fact-check.`);
