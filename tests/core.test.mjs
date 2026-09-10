import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS} from '../dist/questions.js';
import {makeSession,scoreSession,secondsRemaining,isSessionValid,recordAnswer,shuffled} from '../dist/core.js';

test('exam is 40 distinct questions with randomized, valid option permutations',()=>{
  const s=makeSession(QUESTIONS,40,'exam',10000);
  assert.equal(s.items.length,40);assert.equal(new Set(s.items.map(i=>i.id)).size,40);
  assert(s.items.every(i=>[...i.order].sort().join('')==='0123'));
  assert.equal(s.deadline,2710000);assert(isSessionValid(s,QUESTIONS));
});
test('shuffled answer labels still map back to the correct original option',()=>{
  const s=makeSession(QUESTIONS,40,'exam');
  for(const i of s.items){const q=QUESTIONS.find(q=>q.id===i.id);const displayed=i.order.indexOf(q.answer);s.answers[i.id]=i.order[displayed];}
  const score=scoreSession(s,QUESTIONS);assert.equal(score.correct,40);assert.equal(score.percentage,100);assert(score.passed);
});
test('60 percent threshold is exactly 24 of 40, unanswered is zero',()=>{
  const s=makeSession(QUESTIONS,40,'exam');
  for(const i of s.items.slice(0,23))s.answers[i.id]=QUESTIONS.find(q=>q.id===i.id).answer;
  let score=scoreSession(s,QUESTIONS);assert.equal(score.correct,23);assert.equal(score.unanswered,17);assert.equal(score.passed,false);
  const i=s.items[23];s.answers[i.id]=QUESTIONS.find(q=>q.id===i.id).answer;
  score=scoreSession(s,QUESTIONS);assert.equal(score.percentage,60);assert.equal(score.passed,true);assert.equal(score.unanswered,16);
});
test('all wrong and all blank receive no credit',()=>{
  const s=makeSession(QUESTIONS,40,'exam');assert.equal(scoreSession(s,QUESTIONS).correct,0);
  for(const i of s.items)s.answers[i.id]=(QUESTIONS.find(q=>q.id===i.id).answer+1)%4;
  const score=scoreSession(s,QUESTIONS);assert.equal(score.correct,0);assert.equal(score.answered,40);
});
test('timer survives serialization and counts actual elapsed time',()=>{
  const s=makeSession(QUESTIONS,40,'exam',100000);
  const restored=JSON.parse(JSON.stringify(s));
  assert.equal(secondsRemaining(restored,100000),2700);
  assert.equal(secondsRemaining(restored,100000+1800000),900);
  assert.equal(secondsRemaining(restored,2800000),0);
  assert.equal(secondsRemaining(restored,9999999),0);
});
test('saved session rejects missing, duplicate, corrupt and stale records',()=>{
  const s=makeSession(QUESTIONS,40,'exam',1000);
  assert(!isSessionValid(null,QUESTIONS));
  let bad=structuredClone(s);bad.items[0].order=[0,0,2,3];assert(!isSessionValid(bad,QUESTIONS));
  bad=structuredClone(s);bad.items[1].id=bad.items[0].id;assert(!isSessionValid(bad,QUESTIONS));
  bad=structuredClone(s);bad.answers[s.items[0].id]=7;assert(!isSessionValid(bad,QUESTIONS));
  bad=structuredClone(s);bad.deadline+=1000;assert(!isSessionValid(bad,QUESTIONS));
  bad=structuredClone(s);bad.items[0].id='UNKNOWN';assert(!isSessionValid(bad,QUESTIONS));
});
test('practice count is capped to available category questions and has no deadline',()=>{
  const small=QUESTIONS.slice(0,7);const s=makeSession(small,20,'practice');
  assert.equal(s.items.length,7);assert.equal(secondsRemaining(s),null);assert(isSessionValid(s,QUESTIONS));
  assert.throws(()=>makeSession([],10,'practice'));assert.throws(()=>makeSession(small,40,'exam'));
});
test('a wrong answer is recorded, a later right answer clears latest-error status',()=>{
  const q=QUESTIONS[0];let stats=recordAnswer({},q,(q.answer+1)%4,1000);
  assert.equal(stats[q.id].lastCorrect,false);assert.equal(stats[q.id].attempts,1);
  stats=recordAnswer(stats,q,q.answer,2000);assert.equal(stats[q.id].lastCorrect,true);assert.equal(stats[q.id].correct,1);assert.equal(stats[q.id].attempts,2);
  stats=recordAnswer(stats,q,undefined,3000);assert.equal(stats[q.id].lastCorrect,false);
});
test('shuffle does not mutate question data',()=>{
  const a=[0,1,2,3],copy=[...a];const b=shuffled(a,()=>.2);assert.deepEqual(a,copy);assert.deepEqual([...b].sort(),copy);
});
