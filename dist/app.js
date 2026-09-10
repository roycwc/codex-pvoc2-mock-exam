import {QUESTIONS, CATEGORIES, SOURCES, BANK_VERSION, CHECKED} from './questions.js';
import {makeSession, scoreSession, secondsRemaining, isSessionValid, recordAnswer} from './core.js';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = new Map(QUESTIONS.map(q => [q.id, q]));
const categoryById = new Map(CATEGORIES.map(c => [c.id, c]));
const STORAGE_KEY = 'hk-engine-study-v1';
let storageOK = true;
let data = readData();
let view = 'practice';
let category = data.preferences.category;
let practiceCount = data.preferences.count;
let result = null;
let reviewWrongOnly = false;
let toastTimer;

function readData() {
  const clean = {version:BANK_VERSION, stats:{}, history:[], session:null, preferences:{category:'all',count:10}};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clean;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return clean;
    if (parsed.preferences) {
      if (parsed.preferences.category === 'all' || categoryById.has(parsed.preferences.category)) clean.preferences.category = parsed.preferences.category;
      if ([10,20,'all'].includes(parsed.preferences.count)) clean.preferences.count = parsed.preferences.count;
    }
    for (const [id,s] of Object.entries(parsed.stats || {})) {
      if (byId.has(id) && s && Number.isInteger(s.attempts) && s.attempts > 0 && Number.isInteger(s.correct) && s.correct >= 0 && s.correct <= s.attempts && typeof s.lastCorrect === 'boolean') clean.stats[id] = s;
    }
    if (Array.isArray(parsed.history)) clean.history = parsed.history.filter(h => h && typeof h.id === 'string' && Number.isFinite(h.at) && Number.isInteger(h.correct) && h.correct >= 0 && h.correct <= 40 && h.total === 40).slice(0,10);
    if (parsed.version === BANK_VERSION && isSessionValid(parsed.session, QUESTIONS) && parsed.session.finishedAt === null) clean.session = parsed.session;
    return clean;
  } catch { storageOK = false; return clean; }
}
function save() {
  try {localStorage.setItem(STORAGE_KEY, JSON.stringify(data));}
  catch {storageOK = false;}
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
function wrongQuestions() {return QUESTIONS.filter(q => data.stats[q.id]?.lastCorrect === false);}
function updateSidebar() {
  const count = Object.keys(data.stats).length;
  $('seen-count').textContent = `${count} 題`;
  $('seen-bar').style.width = `${count / QUESTIONS.length * 100}%`;
  $('seen-label').textContent = `已練習 ${count} / ${QUESTIONS.length} 題`;
  $('wrong-count').textContent = wrongQuestions().length;
  document.querySelectorAll('[data-view]').forEach(b => {
    const selected = b.dataset.view === view;
    b.classList.toggle('active', selected);
    if (selected) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
}
function heading(kicker,title,description,badge=true) {
  return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${description}</p></div>${badge ? `<div class="pool-badge"><strong>${QUESTIONS.length}</strong> 題題庫</div>` : ''}</div>`;
}
function refHTML(q) {
  const page = q.page;
  const section = page >= 288 ? '第 4 章・（23）乙部問答題' : page >= 284 ? '第 4 章・（22）石油氣' : page >= 267 ? '第 4 章・（21）防火與環保' : page >= 247 ? '第 4 章・（20）操作與維修' : page >= 217 ? '第 4 章・（19）輔機' : page >= 209 ? '第 4 章・（18）舷外汽油機' : page >= 161 ? '第 4 章・（17）主機' : page >= 147 ? '第 4 章・（16）基本原理' : '第 3 章・考試綱要';
  const samplePage = q.sample <= 4 ? 2 : q.sample <= 8 ? 3 : q.sample <= 12 ? 4 : q.sample <= 17 ? 5 : q.sample <= 21 ? 6 : q.sample <= 26 ? 7 : q.sample <= 32 ? 8 : q.sample <= 36 ? 9 : 10;
  return `<div class="refs"><span class="eyebrow">答案出處</span><a href="${SOURCES.guide.url}#page=${page+1}" target="_blank" rel="noopener noreferrer">海事處考試手冊 ↗<br>${section}・印刷頁 ${page}（PDF 第 ${page+1} 頁）</a>${q.sample ? `<a href="${SOURCES.sample.url}#page=${samplePage}" target="_blank" rel="noopener noreferrer">相關官方樣本考點：第 ${q.sample} 題 ↗</a>` : ''}<small>依據 ${SOURCES.guide.edition}；核對日期 ${CHECKED}。題目與解釋由本站編寫。</small></div>`;
}
function activeQuestion() {
  const s = data.session;
  if (!s) return null;
  const item = s.items[s.position];
  return {session:s,item,q:byId.get(item.id)};
}
function questionCard(s) {
  const {q,item} = activeQuestion();
  const answer = s.answers[q.id];
  const checked = s.mode !== 'exam' && s.checked[q.id] === true;
  const right = answer === q.answer;
  const cat = categoryById.get(q.category);
  return `<article class="card" aria-label="選擇題"><div class="question-top"><span class="tag">${escape(cat.name)}</span><span class="question-meta">${s.position+1} / ${s.items.length}</span></div><div class="question-body"><div class="question-number">QUESTION ${String(s.position+1).padStart(2,'0')} <span aria-hidden="true">/</span> ${q.id}</div><h2 class="question-text" id="question-text">${escape(q.stem)}</h2><div class="options" role="group" aria-labelledby="question-text">${item.order.map((originalIndex,displayIndex) => {
    const correct = checked && originalIndex === q.answer;
    const incorrect = checked && originalIndex === answer && !right;
    return `<button type="button" class="option ${originalIndex === answer ? 'selected' : ''} ${correct ? 'correct' : ''} ${incorrect ? 'incorrect' : ''}" data-option="${originalIndex}" aria-pressed="${originalIndex === answer}" ${checked ? 'disabled' : ''}><span class="letter" aria-hidden="true">${'ABCD'[displayIndex]}</span><span class="choice-text">${escape(q.options[originalIndex])}</span>${correct ? '<span class="answer-mark">✓ 正確</span>' : incorrect ? '<span class="answer-mark">✕ 你揀</span>' : ''}</button>`;
  }).join('')}</div></div>${checked ? `<section class="explanation ${right ? '' : 'is-wrong'}" aria-live="polite"><h3>${right ? '答啱咗！' : '差少少，睇睇原因。'}</h3><p>${escape(q.explanation)}</p>${refHTML(q)}</section>` : ''}<div class="question-bottom">${s.mode === 'exam' ? `<button class="text-btn ${s.flags.includes(q.id) ? 'flagged-btn' : ''}" data-action="flag" aria-pressed="${s.flags.includes(q.id)}">${s.flags.includes(q.id) ? '◆ 已標記' : '◇ 標記再睇'}</button><div class="exam-navigation"><button class="secondary" data-action="previous" ${s.position === 0 ? 'disabled' : ''}>上一題</button><button class="primary" data-action="${s.position === s.items.length-1 ? 'submit-exam' : 'next'}">${s.position === s.items.length-1 ? '交卷' : '下一題 →'}</button></div>` : `<span class="subtle">${checked ? '記住原理，再試下一題。' : '揀一個最合適答案'}</span><button class="primary" data-action="${checked ? 'next' : 'check'}" ${!checked && answer === undefined ? 'disabled' : ''}>${checked ? (s.position === s.items.length-1 ? '查看練習結果' : '下一題 →') : '確認答案'}</button>`}</div></article><div class="question-tail"><span>${q.sample ? '官方樣本考點・自編題目' : '官方手冊考點・自編題目'}</span><span>考綱 ${escape(cat.syllabus)}</span></div>`;
}
function railHTML() {
  return `<aside class="right-rail"><section class="exam-promo"><p class="eyebrow">EXAM MODE</p><h2>練好節奏，<br>再上試場。</h2><div class="exam-metrics"><div><strong>40</strong><small>條選擇題</small></div><div><strong>45</strong><small>分鐘限時</small></div></div><button class="primary lime" data-action="exam-intro">試一份模擬卷 →</button></section><section class="rail-note"><h3>讀懂原因，先至記得穩。</h3><p>答案附解釋同官方手冊頁碼。標有「樣本考點」嘅題目，相關知識曾出現於海事處公開樣本。</p><a href="#sources" data-action="sources">睇題庫依據 ↗</a></section></aside>`;
}
function practiceHTML() {
  if (!data.session || data.session.mode === 'exam' || data.session.mode === 'mistakes') startPractice(false);
  return heading('PRACTICE / 輪機知識','準備好，開偈。','每日練一組，逐個考點搞清楚。') + `<div class="workspace"><div><div class="toolbar"><label class="field">範圍<select id="category"><option value="all">全部考點</option>${CATEGORIES.map(c=>`<option value="${c.id}" ${category===c.id?'selected':''}>${c.name}</option>`).join('')}</select></label><label class="field">題數<select id="practice-count"><option value="10" ${practiceCount===10?'selected':''}>10 題</option><option value="20" ${practiceCount===20?'selected':''}>20 題</option><option value="all" ${practiceCount==='all'?'selected':''}>全部</option></select></label><button class="text-btn" data-action="new-practice">換一組 ↻</button></div>${questionCard(data.session)}</div>${railHTML()}</div>`;
}
function startPractice(renderAfter=true, mode='practice') {
  const pool = mode === 'mistakes' ? wrongQuestions() : QUESTIONS.filter(q=>category==='all'||q.category===category);
  if (!pool.length) return false;
  data.session = makeSession(pool, mode === 'mistakes' ? pool.length : practiceCount === 'all' ? pool.length : practiceCount, mode);
  data.preferences={category,count:practiceCount};
  result = null; save();
  if (renderAfter) render();
  return true;
}
function examIntroHTML() {
  const history = data.history.length ? `<section class="history"><h3>最近模擬試</h3>${data.history.map(h=>`<div class="history-row"><span>${new Date(h.at).toLocaleString('zh-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span>${h.correct} / 40 · ${h.correct>=24?'達合格線':'未達合格線'}</span></div>`).join('')}</section>` : '';
  return heading('MOCK EXAM / 模擬考試','測試一下，準備成點？','按官方乙部題數、時限及合格分數模擬。',false)+`<div class="exam-intro"><section class="exam-start"><p class="eyebrow">PART B · ENGINEERING</p><h2>一份卷，專心做。</h2><p>隨機抽題，選項次序重新排列。<br>交卷後一次過睇成績、解釋同出處。</p><div class="exam-numbers"><div><strong>40</strong><span>條題目</span></div><div><strong>45</strong><span>分鐘</span></div><div><strong>24</strong><span>題答啱合格</span></div></div><button class="primary lime" data-action="start-exam">開始計時考試 →</button></section><section class="card instructions"><h3>落筆前，記住幾點</h3><ol><li>每題只有一個最佳答案，各題佔 2.5%。</li><li>可以返回修改，亦可以標記唔肯定嘅題目。</li><li>考試中不顯示答案；時間一到自動交卷。</li><li>重新整理或暫時離開分頁，計時仍然繼續。</li></ol><p class="subtle">本站隨機抽題，不代表官方各章出題比例；本模擬成績只供練習參考。</p><div class="refs"><a href="${SOURCES.peak.url}#page=2" target="_blank" rel="noopener noreferrer">核對官方考試規則 ↗</a></div></section></div>${history}`;
}
function examHTML() {
  if (!data.session || data.session.mode !== 'exam') return examIntroHTML();
  const s=data.session, answered=Object.keys(s.answers).length;
  return heading('EXAM IN PROGRESS','乙部模擬考試','遇到難題可以先標記，之後再返嚟。',false)+`<div class="exam-bar"><div>已作答 <strong>${answered} / 40</strong><small>答啱 24 題達合格線</small></div><div><small>剩餘時間</small><div id="timer" class="timer" role="timer" aria-live="off">${formatTime(secondsRemaining(s))}</div></div></div><div class="exam-layout"><div>${questionCard(s)}</div><aside class="card exam-map"><h3>題目一覽</h3><div class="number-grid">${s.items.map((i,n)=>`<button class="qnum ${s.answers[i.id] !== undefined?'answered':''} ${s.position===n?'current':''} ${s.flags.includes(i.id)?'flagged':''}" data-jump="${n}" aria-label="第 ${n+1} 題，${s.answers[i.id]!==undefined?'已作答':'未作答'}${s.flags.includes(i.id)?'，已標記':''}" ${s.position===n?'aria-current="step"':''}>${n+1}</button>`).join('')}</div><div class="map-legend"><span>淺藍：已作答</span><span>橙點：已標記</span></div><button class="primary" data-action="submit-exam">交卷及查看結果</button><p class="subtle" style="margin-top:13px">未答題目按 0 分計。</p></aside></div>`;
}
function mistakesHTML() {
  const pool=wrongQuestions();
  if (data.session?.mode==='mistakes') return heading('REVISIT / 錯題重溫','再做一次，搞清楚。','今次答啱，呢題就會移出待重溫清單。')+`<div class="workspace"><div>${questionCard(data.session)}</div>${railHTML()}</div>`;
  if (!pool.length) return heading('REVISIT / 錯題重溫','把唔熟嘅，練熟。','每次答題後，自動更新待重溫清單。',false)+`<section class="card empty"><div class="empty-mark" aria-hidden="true">✓</div><h2>暫時冇待重溫題目</h2><p>你答錯嘅題目會出現喺呢度。重新答啱後，就會移出清單。</p><button class="primary" data-action="practice">去操題 →</button></section>`;
  return heading('REVISIT / 錯題重溫',`${pool.length} 個考點，再練穩啲。`,'只保留最近一次答錯或模擬試未答嘅題目。',false)+`<div class="result-actions"><button class="primary" data-action="start-mistakes">開始錯題練習 →</button></div><div class="review-list">${pool.map(q=>reviewItem(q,null,null)).join('')}</div>`;
}
function reviewItem(q,answer,item) {
  const right=answer===q.answer;
  const order=item?.order || [0,1,2,3];
  return `<details class="card review-item"><summary><span class="review-state ${right?'':'wrong'}">${answer===null?q.id:right?'✓ 答啱':answer===undefined?'− 未答':'✕ 答錯'}</span><span>${escape(q.stem)}</span></summary><div class="review-answer"><ol type="A">${order.map(i=>`<li class="${i===q.answer?'right':''}">${escape(q.options[i])}${i===q.answer?' ✓ 正確答案':''}${i===answer?'（你的選擇）':''}</li>`).join('')}</ol><p class="explain-text">${escape(q.explanation)}</p>${refHTML(q)}</div></details>`;
}
function resultsHTML() {
  const s=result, score=scoreSession(s,QUESTIONS), isExam=s.mode==='exam';
  const duration=Math.max(0,Math.min(isExam?2700:Infinity,Math.round((s.finishedAt-s.startedAt)/1000)));
  const shown=s.items.filter(i=>!reviewWrongOnly||s.answers[i.id]!==byId.get(i.id).answer);
  return heading(isExam?'EXAM RESULT / 模擬試成績':'PRACTICE RESULT / 練習完成',isExam?(score.passed?'達到合格線，繼續練穩。':'睇清錯因，下次再試。'):'完成一組，進步一步。',isExam?'合格線 60% · 本次模擬結果不代表正式考試成績。':'你嘅作答已更新到本機學習記錄。',false)+`<section class="results-head"><div class="score">${score.correct}<small> / ${score.total}</small></div><div><h2>${Number(score.percentage.toFixed(1))}% 正確</h2><p>${score.unanswered} 題未答 · 用時 ${formatTime(duration)}</p><p>${isExam?(score.passed?'今次達 24 題合格要求。':'未達 24 題合格要求。'):'逐題睇返解釋，記住背後原理。'}</p></div></section><div class="result-actions"><button class="primary" data-action="${isExam?'exam-intro':'new-practice'}">${isExam?'再做一份模擬卷':'再練一組'} →</button><button class="secondary" data-action="mistakes">錯題重溫</button><button class="secondary" data-action="toggle-review" aria-pressed="${reviewWrongOnly}">${reviewWrongOnly?'顯示全部題目':'只睇錯題／未答'}</button></div><div class="review-list">${shown.length?shown.map(i=>reviewItem(byId.get(i.id),s.answers[i.id],i)).join(''):'<section class="card empty"><h2>全部答啱！</h2><p>今次沒有錯題或未答題目。</p></section>'}</div>`;
}
function sourcesHTML() {
  const sampleCount=QUESTIONS.filter(q=>q.sample).length;
  return heading('SOURCES / 題庫與出處','有出處，先練得安心。',`最近核對：${CHECKED} · ${QUESTIONS.length} 題自編選擇題`,false)+`<section class="card sources-intro"><h2>對照考綱，學真正需要嘅知識。</h2><p>題目按海事處乙部考綱編寫，答案逐題對照考試手冊。當中 ${sampleCount} 題對應公開官方樣本出現過的考點，其餘來自手冊列明的輪機原理及操作知識。所有題目都有四個選項、答案、解釋及實際支持答案的頁碼。</p><div class="notice">本站並非海事處或高峰進修學院網站。題目是自編模擬題，並非歷屆真題，亦無法保證考試會出同一題。官方指南明言不公開正式試題及答案。涉及特定機型的操作、油品及設定，以製造商手冊為準。</div></section><div class="source-grid">${Object.values(SOURCES).map(s=>`<article class="card source-card"><span class="eyebrow">${s.edition}</span><h3>${s.title}</h3><p>${s.description}</p><a href="${s.url}" target="_blank" rel="noopener noreferrer">開啟官方文件 ↗</a></article>`).join('')}</div><section class="card coverage"><h3>題庫範圍</h3>${CATEGORIES.map(c=>{const n=QUESTIONS.filter(q=>q.category===c.id).length;return `<div class="coverage-row"><span>${c.name}</span><div class="mini-progress"><span style="width:${n/40*100}%"></span></div><small>${n} 題</small></div>`;}).join('')}<p class="subtle">上述是本站題庫分布，官方沒有在所引用資料中公布各範疇的固定出題比例。本站不設甲部航駛題庫。</p></section><section class="card sources-intro" style="margin-top:24px"><h3>點樣核對同處理資料差異？</h3><p style="margin-top:12px">技術內容採用 2021 年 5 月版海事處手冊；考試制度則以 2025 年規則及 2026 年 9 月高峰指南核對。題目會寫明機型或情境，避免把傳統化油器、鉛酸電池或特定冷卻設計套用到所有設備。對措辭不清或樣本與技術說明不易一致解讀的題目，未直接收錄。</p><p style="margin-top:12px">例如一般低油壓警報與已確認油壓為零，在手冊的處理描述不同；本站把條件寫清楚並分題處理。PDF 連結使用實際 PDF 頁碼，文字同時列印刷頁碼；部分手機閱讀器可能不支援自動跳頁。</p><p class="subtle" style="margin-top:16px">學習記錄只存在你的瀏覽器；更換裝置、使用無痕模式或清除網站資料後，記錄不會同步。網站不要求註冊、不上傳作答記錄，亦不包含第三方追蹤碼。</p></section>`;
}
function render(focus=false) {
  let content=result ? resultsHTML() : view==='practice'?practiceHTML():view==='exam'?examHTML():view==='mistakes'?mistakesHTML():sourcesHTML();
  if (!storageOK) content='<p class="storage-notice" role="status">這個瀏覽器未能儲存進度。仍可操題，但重新整理或關閉後可能失去記錄。</p>'+content;
  $('main').innerHTML=content;updateSidebar();
  if (focus) {$('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function formatTime(seconds) {const n=Math.max(0,Math.floor(seconds||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function selectAnswer(answer) {
  const current=activeQuestion();
  if (!current || !Number.isInteger(answer) || answer<0 || answer>3 || result) return false;
  const {session:s,q}=current;
  if (s.mode==='exam' && secondsRemaining(s)===0) {finishSession(true);return false;}
  if (s.checked[q.id]) return false;
  s.answers[q.id]=answer;save();render();
  document.querySelector(`[data-option="${answer}"]`)?.focus({preventScroll:true});
  return true;
}
function checkPractice() {
  const current=activeQuestion();if(!current||current.session.mode==='exam'||result)return;
  const {session:s,q}=current;
  if (s.checked[q.id]||s.answers[q.id]===undefined)return;
  s.checked[q.id]=true;data.stats=recordAnswer(data.stats,q,s.answers[q.id]);save();render();
  document.querySelector('[data-action="next"]')?.focus({preventScroll:true});
}
function finishSession(expired=false) {
  const s=data.session;if(!s||s.finishedAt!==null)return;
  if (s.mode==='exam') for(const i of s.items) data.stats=recordAnswer(data.stats,byId.get(i.id),s.answers[i.id]);
  s.finishedAt=s.mode==='exam'&&expired?s.deadline:Date.now();
  const score=scoreSession(s,QUESTIONS);
  if(s.mode==='exam'&&!data.history.some(h=>h.id===s.id)) data.history=[{id:s.id,at:s.finishedAt,correct:score.correct,total:40},...data.history].slice(0,10);
  result=structuredClone(s);reviewWrongOnly=false;data.session=null;save();
  const dialog=$('confirm-dialog');if(dialog.open)dialog.close('expired');
  render(true);if(expired)toast('時間到，已自動交卷。');
}
async function confirmAction(title,message,button='確認') {
  const d=$('confirm-dialog');if(d.open)return false;
  $('dialog-title').textContent=title;$('dialog-message').textContent=message;
  d.querySelector('[value="confirm"]').textContent=button;
  return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true});d.showModal();});
}
async function navigate(next) {
  if (!['practice','exam','mistakes','sources'].includes(next))return;
  if(data.session?.mode==='exam'&&next!=='exam') {
    const ok=await confirmAction('交卷並離開？','模擬試仍在計時。離開會交卷，未答題目按 0 分計。','交卷並離開');
    if(!ok){history.replaceState(null,'',`#${view}`);return;}finishSession();
  }
  result=null;view=next;
  if(data.session?.mode==='mistakes'&&next!=='mistakes'){data.session=null;save();}
  history.replaceState(null,'',`#${next}`);render(true);
}
async function action(name) {
  if(name==='practice'||name==='mistakes'||name==='sources')return navigate(name);
  if(name==='exam-intro')return navigate('exam');
  if(name==='start-exam') {
    data.session=makeSession(QUESTIONS,40,'exam');view='exam';result=null;save();render(true);return;
  }
  if(name==='start-mistakes'){view='mistakes';startPractice(true,'mistakes');return;}
  if(name==='new-practice'){view='practice';startPractice();return;}
  if(name==='check'){checkPractice();return;}
  if(name==='toggle-review'){reviewWrongOnly=!reviewWrongOnly;render();return;}
  const s=data.session;if(!s)return;
  if(s.mode==='exam'&&secondsRemaining(s)===0){finishSession(true);return;}
  if(name==='submit-exam') {
    if(s.mode!=='exam')return;
    const remaining=s.items.length-Object.keys(s.answers).length;
    if(await confirmAction('確認交卷？',remaining?`仲有 ${remaining} 題未答，未答題目按 0 分計。交卷後可查看全部答案及解釋。`:'全部題目已作答。交卷後會顯示分數、答案及解釋。','確認交卷'))finishSession();return;
  }
  if(name==='flag'){const id=s.items[s.position].id;s.flags=s.flags.includes(id)?s.flags.filter(x=>x!==id):[...s.flags,id];save();render();return;}
  if(name==='previous'&&s.position>0){s.position--;save();render(true);return;}
  if(name==='next') {
    if(s.mode!=='exam'&&!s.checked[s.items[s.position].id])return;
    if(s.position===s.items.length-1)finishSession();else{s.position++;save();render(true);}
  }
}
$('nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)void navigate(b.dataset.view);});
$('main').addEventListener('click',e=>{
  const option=e.target.closest('[data-option]');if(option){selectAnswer(Number(option.dataset.option));return;}
  const jump=e.target.closest('[data-jump]');if(jump&&data.session?.mode==='exam'){
    if(secondsRemaining(data.session)===0){finishSession(true);return;}
    data.session.position=Number(jump.dataset.jump);save();render(true);return;
  }
  const b=e.target.closest('[data-action]');if(b){e.preventDefault();void action(b.dataset.action);}
});
$('main').addEventListener('change',e=>{
  if(e.target.id==='category'){category=e.target.value;startPractice();}
  if(e.target.id==='practice-count'){practiceCount=e.target.value==='all'?'all':Number(e.target.value);startPractice();}
});
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.hash='practice';url.search='';
  try{if(navigator.share){await navigator.share({title:'大偈研習室',text:'香港二級遊樂船乙部操題，附答案解釋及官方出處。',url:url.href});return;}}
  catch(e){if(e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(url.href);toast('已複製網址，可以分享畀朋友。');}
  catch{window.prompt('複製以下網站網址：',url.href);}
});
function tick(){
  const s=data.session;if(s?.mode!=='exam')return;
  const left=secondsRemaining(s);
  if(left===0){finishSession(true);return;}
  const timer=$('timer');if(timer){timer.textContent=formatTime(left);timer.classList.toggle('urgent',left<=300);}
}
setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('pageshow',tick);
window.addEventListener('hashchange',()=>{const desired=location.hash.slice(1);if(desired!==view)void navigate(desired);});
if(data.session?.mode==='exam') view='exam';
else if(data.session?.mode==='mistakes')view='mistakes';
else if(['exam','mistakes','sources'].includes(location.hash.slice(1)))view=location.hash.slice(1);
render();tick();

// Optional browser-standard integration; never required for the website to work.
const context=document.modelContext;
if(context?.registerTool){
  const lifecycle=new AbortController();
  const registration=(tool)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  registration({name:'read_current_question',description:'Read the question currently visible in this study app. Answers are returned only after the practice answer has been checked.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){const current=activeQuestion();if(!current||result||!['practice','exam','mistakes'].includes(view))return {question:null};const {q,item,session:s}=current;const checked=s.mode!=='exam'&&s.checked[q.id];return {id:q.id,mode:s.mode,question:q.stem,options:item.order.map((i,n)=>({label:'ABCD'[n],text:q.options[i]})),...(checked?{answer:'ABCD'[item.order.indexOf(q.answer)],explanation:q.explanation}:{})};}});
  registration({name:'select_current_answer',description:'Select A, B, C or D for the currently visible question. This only stages a selection; it does not check an answer or submit an exam.',inputSchema:{type:'object',properties:{option:{type:'string',enum:['A','B','C','D']}},required:['option'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!['A','B','C','D'].includes(input.option)||Object.keys(input).some(k=>k!=='option'))throw new Error('Choose A, B, C or D.');const current=activeQuestion();if(!current||!['practice','exam','mistakes'].includes(view))throw new Error('No question is visible.');if(!selectAnswer(current.item.order['ABCD'.indexOf(input.option)]))throw new Error('This question cannot be changed.');return {id:current.q.id,selected:input.option,submitted:false};}});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
