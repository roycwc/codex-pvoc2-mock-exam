export const PAPER_MS = 45 * 60 * 1000;
export function shuffled(items, random = Math.random) {
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export function makeSession(bank,count,mode='practice',now=Date.now(),random=Math.random) {
  if(!bank.length||!Number.isInteger(count)||count<1)throw new Error('沒有合適題目');
  if(!['practice','mistakes'].includes(mode))throw new Error('請用分卷模式建立考試');
  return {id:`${now}-${random().toString(36).slice(2)}`,mode,startedAt:now,deadline:null,
    items:shuffled(bank,random).slice(0,Math.min(count,bank.length)).map(q=>({id:q.id,order:shuffled([0,1,2,3],random)})),
    answers:{},checked:{},flags:[],position:0,finishedAt:null};
}
// Each topic appears; remaining places are random. This is our sampling policy,
// not a claim about unpublished official weighting.
function samplePaper(bank,random) {
  if(bank.length<40)throw new Error('每部模擬試需要至少 40 道候選題目');
  const initial=[...new Set(bank.map(q=>q.category))].flatMap(c=>shuffled(bank.filter(q=>q.category===c),random).slice(0,1));
  const used=new Set(initial.map(q=>q.id));
  return shuffled([...initial,...shuffled(bank.filter(q=>!used.has(q.id)),random).slice(0,40-initial.length)],random);
}
export function makeExamSession(bank,choice='AB',now=Date.now(),random=Math.random) {
  if(!['A','B','AB'].includes(choice))throw new Error('試卷選擇不正確');
  const parts=choice==='AB'?['A','B']:[choice];
  const items=parts.flatMap(part=>samplePaper(bank.filter(q=>q.part===part),random).map(q=>({id:q.id,order:shuffled([0,1,2,3],random)})));
  return {id:`${now}-${random().toString(36).slice(2)}`,mode:'exam',choice,startedAt:now,items,answers:{},checked:{},flags:[],position:0,finishedAt:null,activePaper:0,
    papers:parts.map((part,n)=>({part,start:n*40,end:(n+1)*40,startedAt:n===0?now:null,deadline:n===0?now+PAPER_MS:null,finishedAt:null}))};
}
export function currentPaper(s){return s?.mode==='exam'?s.papers[s.activePaper]:null;}
export function paperRange(s){const p=currentPaper(s);return p?{start:p.start,end:p.end}:{start:0,end:s.items.length};}
export function isBetweenPapers(s){return s?.mode==='exam'&&s.finishedAt===null&&currentPaper(s).finishedAt!==null;}
export function secondsRemaining(s,now=Date.now()){
  const p=currentPaper(s);return !p||p.finishedAt!==null||s.finishedAt!==null?null:Math.max(0,Math.ceil((p.deadline-now)/1000));
}
export function canAnswer(s,id,now=Date.now()){
  if(!s||s.finishedAt!==null||s.checked[id])return false;
  if(s.mode!=='exam')return s.items.some(i=>i.id===id);
  const p=currentPaper(s);return !isBetweenPapers(s)&&secondsRemaining(s,now)>0&&s.items.slice(p.start,p.end).some(i=>i.id===id);
}
export function setAnswer(s,id,answer,now=Date.now()){
  if(!Number.isInteger(answer)||answer<0||answer>3||!canAnswer(s,id,now))return false;
  s.answers[id]=answer;return true;
}
// A freezes on submission; B starts only on an explicit next-paper action.
export function submitPaper(s,now=Date.now()){
  if(s.mode!=='exam'||s.finishedAt!==null||isBetweenPapers(s))return false;
  const p=currentPaper(s);p.finishedAt=Math.min(now,p.deadline);
  if(s.activePaper===s.papers.length-1)s.finishedAt=p.finishedAt;
  return true;
}
export function startNextPaper(s,now=Date.now()){
  if(!isBetweenPapers(s)||s.activePaper+1>=s.papers.length||now<currentPaper(s).finishedAt)return false;
  s.activePaper++;const p=currentPaper(s);p.startedAt=now;p.deadline=now+PAPER_MS;s.position=p.start;return true;
}
// Ending the whole attempt gives unanswered future papers zero credit.
export function endSession(s,now=Date.now()){
  if(s.finishedAt!==null)return;
  if(s.mode==='exam'){if(!isBetweenPapers(s))submitPaper(s,now);s.finishedAt??=now;}
  else s.finishedAt=now;
}
function scoreItems(items,answers,byId){
  const correct=items.filter(i=>answers[i.id]===byId.get(i.id)?.answer).length;
  const answered=items.filter(i=>Number.isInteger(answers[i.id])).length,total=items.length;
  return {correct,answered,unanswered:total-answered,total,percentage:total?correct/total*100:0,passed:total>0&&correct/total>=.6};
}
export function scoreSession(s,questions){
  const byId=new Map(questions.map(q=>[q.id,q])),total=scoreItems(s.items,s.answers,byId);
  if(s.mode!=='exam')return total;
  const papers=s.papers.map(p=>({part:p.part,...scoreItems(s.items.slice(p.start,p.end),s.answers,byId)}));
  return {...total,papers,passed:papers.every(p=>p.passed)};
}
export function durationSeconds(s,now=Date.now()){
  if(s.mode!=='exam')return Math.max(0,Math.round(((s.finishedAt??now)-s.startedAt)/1000));
  return Math.round(s.papers.reduce((sum,p)=>sum+(p.startedAt===null?0:Math.max(0,Math.min(p.finishedAt??now,p.deadline)-p.startedAt)),0)/1000);
}
export function isSessionValid(s,questions){
  if(!s||typeof s!=='object'||typeof s.id!=='string'||!['practice','exam','mistakes'].includes(s.mode))return false;
  if(!Array.isArray(s.items)||!s.items.length||s.items.length>questions.length)return false;
  const known=new Map(questions.map(q=>[q.id,q])),ids=s.items.map(i=>i?.id);
  if(new Set(ids).size!==ids.length||ids.some(id=>!known.has(id)))return false;
  if(s.items.some(i=>!Array.isArray(i.order)||i.order.length!==4||[...i.order].sort().join(',')!=='0,1,2,3'))return false;
  if(!s.answers||typeof s.answers!=='object'||Array.isArray(s.answers)||!s.checked||typeof s.checked!=='object'||Array.isArray(s.checked))return false;
  if(Object.entries(s.answers).some(([id,n])=>!ids.includes(id)||!Number.isInteger(n)||n<0||n>3))return false;
  if(Object.entries(s.checked).some(([id,v])=>!ids.includes(id)||v!==true||!Number.isInteger(s.answers[id])))return false;
  if(!Array.isArray(s.flags)||s.flags.some(id=>!ids.includes(id)))return false;
  if(!Number.isInteger(s.position)||s.position<0||s.position>=ids.length||!Number.isFinite(s.startedAt))return false;
  if(!(s.finishedAt===null||Number.isFinite(s.finishedAt)&&s.finishedAt>=s.startedAt))return false;
  if(s.mode!=='exam')return s.deadline===null;
  if(!['A','B','AB'].includes(s.choice)||!Array.isArray(s.papers))return false;
  const parts=s.choice==='AB'?['A','B']:[s.choice];
  if(s.papers.length!==parts.length||ids.length!==parts.length*40||!Number.isInteger(s.activePaper)||s.activePaper<0||s.activePaper>=parts.length||Object.keys(s.checked).length)return false;
  for(let n=0;n<parts.length;n++){
    const p=s.papers[n];
    if(!p||p.part!==parts[n]||p.start!==n*40||p.end!==(n+1)*40||s.items.slice(p.start,p.end).some(i=>known.get(i.id).part!==p.part))return false;
    if(n>s.activePaper){
      if(p.startedAt!==null||p.deadline!==null||p.finishedAt!==null||s.items.slice(p.start,p.end).some(i=>s.answers[i.id]!==undefined))return false;
    }else{
      if(!Number.isFinite(p.startedAt)||p.deadline!==p.startedAt+PAPER_MS)return false;
      if(n===0&&p.startedAt!==s.startedAt)return false;
      if(n>0&&(s.papers[n-1].finishedAt===null||p.startedAt<s.papers[n-1].finishedAt))return false;
      if(!(p.finishedAt===null||Number.isFinite(p.finishedAt)&&p.finishedAt>=p.startedAt&&p.finishedAt<=p.deadline))return false;
      if(n<s.activePaper&&p.finishedAt===null)return false;
    }
  }
  const p=currentPaper(s);
  if(s.position<p.start||s.position>=p.end)return false;
  if(s.finishedAt===null&&p.finishedAt!==null&&s.activePaper===parts.length-1)return false;
  return true;
}
export function recordAnswer(stats,q,answer,time=Date.now()){
  const previous=stats[q.id]||{attempts:0,correct:0},right=answer===q.answer;
  return {...stats,[q.id]:{attempts:previous.attempts+1,correct:previous.correct+Number(right),lastCorrect:right,lastAt:time}};
}
