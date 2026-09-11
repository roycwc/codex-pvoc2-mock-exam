import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS,CATEGORIES} from '../dist/questions.js';
import {makeSession,makeExamSession,scoreSession,secondsRemaining,isSessionValid,recordAnswer,shuffled,submitPaper,startNextPaper,isBetweenPapers,setAnswer,endSession,durationSeconds} from '../dist/core.js';
const byId=new Map(QUESTIONS.map(q=>[q.id,q]));
const correct=(s,start,count,now)=>s.items.slice(start,start+count).forEach(i=>assert(setAnswer(s,i.id,byId.get(i.id).answer,now)));
for(const part of ['A','B'])test(`${part}: 40 distinct questions, correct pool, complete topic coverage and 45 minutes`,()=>{
 const s=makeExamSession(QUESTIONS,part,1000);
 assert.equal(s.items.length,40);assert.equal(new Set(s.items.map(i=>i.id)).size,40);
 assert(s.items.every(i=>byId.get(i.id).part===part&&[...i.order].sort().join('')==='0123'));
 assert.deepEqual(new Set(s.items.map(i=>byId.get(i.id).category)),new Set(CATEGORIES.filter(c=>c.part===part).map(c=>c.id)));
 assert.equal(secondsRemaining(s,1000),2700);assert(isSessionValid(s,QUESTIONS));
});
test('shuffled display choices map to the original answer without answer-position bias',()=>{
 const s=makeExamSession(QUESTIONS,'B',1000);
 for(const i of s.items){const display=i.order.indexOf(byId.get(i.id).answer);assert(setAnswer(s,i.id,i.order[display],1001));}
 const score=scoreSession(s,QUESTIONS);assert.equal(score.correct,40);assert.equal(score.percentage,100);assert(score.passed);
});
test('single paper threshold: 23 fails, 24 passes; unanswered receives zero',()=>{
 const s=makeExamSession(QUESTIONS,'A',1000);correct(s,0,23,1001);
 assert.equal(scoreSession(s,QUESTIONS).passed,false);assert.equal(scoreSession(s,QUESTIONS).unanswered,17);
 correct(s,23,1,1002);assert.equal(scoreSession(s,QUESTIONS).passed,true);assert.equal(scoreSession(s,QUESTIONS).percentage,60);
});
test('full 80 questions: 23 in A and 40 in B fails despite a high combined score',()=>{
 const s=makeExamSession(QUESTIONS,'AB',1000);assert.equal(s.items.length,80);
 correct(s,0,23,1001);assert(submitPaper(s,2000));assert(startNextPaper(s,3000));correct(s,40,40,3001);assert(submitPaper(s,4000));
 const score=scoreSession(s,QUESTIONS);assert.equal(score.correct,63);assert.equal(score.percentage,78.75);assert.equal(score.passed,false);
 assert.deepEqual(score.papers.map(p=>[p.part,p.correct,p.passed]),[['A',23,false],['B',40,true]]);
 assert(isSessionValid(s,QUESTIONS));
});
test('full 80 questions: independent 24/40 in both papers passes',()=>{
 const s=makeExamSession(QUESTIONS,'AB',1000);correct(s,0,24,1001);submitPaper(s,2000);startNextPaper(s,3000);correct(s,40,24,3001);submitPaper(s,4000);
 assert(scoreSession(s,QUESTIONS).passed);assert.equal(scoreSession(s,QUESTIONS).unanswered,32);
});
test('A expires while closed: restoration submits only A and preserves all 45 minutes for B',()=>{
 let s=makeExamSession(QUESTIONS,'AB',1000);s=JSON.parse(JSON.stringify(s));
 assert.equal(secondsRemaining(s,1000+3600000),0);assert(!setAnswer(s,s.items[0].id,0,3601000));
 assert(submitPaper(s,3601000));assert(isBetweenPapers(s));assert.equal(s.papers[0].finishedAt,2701000);
 assert.equal(secondsRemaining(s,3601000),null);assert.equal(s.papers[1].startedAt,null);assert(!submitPaper(s,3602000));
 s=JSON.parse(JSON.stringify(s));assert(isSessionValid(s,QUESTIONS));
 assert(startNextPaper(s,7201000));assert.equal(secondsRemaining(s,7201000),2700);assert.equal(secondsRemaining(s,7201000+1800000),900);
 assert.equal(durationSeconds(s,7201000),2700);
});
test('early A submission does not transfer time; neither future B nor frozen A can be edited',()=>{
 const s=makeExamSession(QUESTIONS,'AB',1000),a=s.items[0].id,b=s.items[40].id;
 assert(!setAnswer(s,b,0,1001));assert(!startNextPaper(s,1001));assert(setAnswer(s,a,1,1001));
 assert(submitPaper(s,61000));assert(!setAnswer(s,a,2,62000));assert(!setAnswer(s,b,2,62000));
 assert(startNextPaper(s,121000));assert.equal(secondsRemaining(s,121000),2700);assert(!setAnswer(s,a,2,121001));
 assert(setAnswer(s,b,2,121001));assert.equal(s.answers[a],1);assert.equal(durationSeconds(s,181000),120);
});
test('explicit end between papers retains A and marks unstarted B unanswered with no B duration',()=>{
 const s=makeExamSession(QUESTIONS,'AB',1000);correct(s,0,40,1001);submitPaper(s,61000);endSession(s,601000);
 const score=scoreSession(s,QUESTIONS);assert.equal(score.correct,40);assert.equal(score.papers[1].unanswered,40);assert(!score.passed);
 assert.equal(durationSeconds(s),60);assert(isSessionValid(s,QUESTIONS));assert(!startNextPaper(s,601001));
});
test('all wrong and blank answers receive no credit; deadline prevents late changes',()=>{
 const s=makeExamSession(QUESTIONS,'B',1000);assert.equal(scoreSession(s,QUESTIONS).correct,0);
 for(const i of s.items)setAnswer(s,i.id,(byId.get(i.id).answer+1)%4,1001);
 assert.equal(scoreSession(s,QUESTIONS).correct,0);assert.equal(scoreSession(s,QUESTIONS).answered,40);
 assert(!setAnswer(s,s.items[0].id,byId.get(s.items[0].id).answer,2701000));
});
test('reject corrupted saved records, wrong-paper IDs, transferred timer and premature B answers',()=>{
 const s=makeExamSession(QUESTIONS,'AB',1000);assert(!isSessionValid(null,QUESTIONS));
 for(const mutate of [
  b=>{b.items[0].order=[0,0,2,3];},b=>{b.items[1].id=b.items[0].id;},b=>{b.answers[b.items[0].id]=7;},
  b=>{b.papers[0].deadline+=1000;},b=>{b.items[0].id='UNKNOWN';},b=>{[b.items[0],b.items[40]]=[b.items[40],b.items[0]];},
  b=>{b.answers[b.items[40].id]=0;},b=>{b.position=40;},b=>{b.activePaper=1;},b=>{b.checked[b.items[0].id]=true;}
 ]){const bad=structuredClone(s);mutate(bad);assert(!isSessionValid(bad,QUESTIONS));}
});
test('practice caps to topic size, records mistakes once and clears the latest error on success',()=>{
 const pool=QUESTIONS.slice(0,7),s=makeSession(pool,20,'practice',1000);assert.equal(s.items.length,7);assert.equal(secondsRemaining(s),null);assert(isSessionValid(s,QUESTIONS));
 const q=byId.get(s.items[0].id);let stats=recordAnswer({},q,(q.answer+1)%4,1000);assert(!stats[q.id].lastCorrect);
 stats=recordAnswer(stats,q,q.answer,2000);assert(stats[q.id].lastCorrect);assert.equal(stats[q.id].attempts,2);
 s.checked[q.id]=true;assert(!setAnswer(s,q.id,0));
 assert.throws(()=>makeSession([],10));assert.throws(()=>makeExamSession(pool,'A'));
});
test('shuffle leaves the original bank untouched',()=>{const a=[0,1,2,3],b=shuffled(a,()=>.2);assert.deepEqual(a,[0,1,2,3]);assert.deepEqual([...b].sort(),a);});
