import {QUESTIONS, CATEGORIES, SOURCES, BANK_VERSION, CHECKED, PARTS} from './questions.js';
import {makeSession, makeExamSession, scoreSession, secondsRemaining, isSessionValid, recordAnswer, currentPaper, paperRange, isBetweenPapers, setAnswer, submitPaper, startNextPaper, endSession, durationSeconds} from './core.js';
import {diagramHTML} from './diagrams.js';

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
let practicePart = data.preferences.part;
let examChoice = 'AB';
let result = null;
let reviewWrongOnly = false;
let toastTimer;

function readData() {
  const clean = {version:BANK_VERSION, stats:{}, history:[], session:null, preferences:{category:'all',count:10,part:'all'}};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clean;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return clean;
    if (parsed.preferences) {
      if (['all','A','B'].includes(parsed.preferences.part)) clean.preferences.part=parsed.preferences.part;
      if (parsed.preferences.category === 'all' || categoryById.has(parsed.preferences.category)) clean.preferences.category = parsed.preferences.category;
      if ([10,20,'all'].includes(parsed.preferences.count)) clean.preferences.count = parsed.preferences.count;
    }
    if(clean.preferences.part!=='all'&&clean.preferences.category!=='all'&&categoryById.get(clean.preferences.category)?.part!==clean.preferences.part)clean.preferences.category='all';
    for (const [id,s] of Object.entries(parsed.stats || {})) {
      if (byId.has(id) && s && Number.isInteger(s.attempts) && s.attempts > 0 && Number.isInteger(s.correct) && s.correct >= 0 && s.correct <= s.attempts && typeof s.lastCorrect === 'boolean') clean.stats[id] = s;
    }
    if (Array.isArray(parsed.history)) clean.history = parsed.history.filter(h => h && typeof h.id === 'string' && Number.isFinite(h.at) && Number.isInteger(h.correct) && h.correct >= 0 && [40,80].includes(h.total) && h.correct <= h.total).slice(0,10);
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
  const section=q.part==='A' ? categoryById.get(q.category).name : q.page>=288?'乙部問答題':q.page>=284?'石油氣':q.page>=267?'防火與環保':q.page>=247?'操作與維修':q.page>=217?'輔機':q.page>=209?'舷外汽油機':q.page>=161?'主機':q.page>=147?'基本原理':'考試綱要';
  const sampleSource=q.part==='A'?SOURCES.sampleA:SOURCES.sampleB;
  return `<div class="refs"><span class="eyebrow">答案出處</span><a href="${SOURCES.guide.url}#page=${q.page+1}" target="_blank" rel="noopener noreferrer">海事處考試手冊 ↗<br>${escape(section)}・印刷頁 ${q.page}（PDF 第 ${q.page+1} 頁）</a>${q.sample?`<a href="${sampleSource.url}" target="_blank" rel="noopener noreferrer">${q.part==='A'?'甲':'乙'}部官方樣本同類考點：第 ${q.sample} 題 ↗（答案在卷末）</a>`:''}<small>依據 ${SOURCES.guide.edition}；核對日期 ${CHECKED}。題目、選項及解釋由本站編寫。</small></div>`;
}
function activeQuestion() {
  const s = data.session;
  if (!s || isBetweenPapers(s)) return null;
  const item = s.items[s.position];
  return {session:s,item,q:byId.get(item.id)};
}
function questionCard(s) {
  const {q,item} = activeQuestion();
  const answer = s.answers[q.id];
  const checked = s.mode !== 'exam' && s.checked[q.id] === true;
  const right = answer === q.answer;
  const cat = categoryById.get(q.category);
  const range=paperRange(s), number=s.position-range.start+1;
  return `<article class="card" aria-label="選擇題"><div class="question-top"><span class="tag">${q.part==='A'?'甲部':'乙部'} · ${escape(cat.name)}</span><span class="question-meta">${number} / ${range.end-range.start}</span></div><div class="question-body"><div class="question-number">QUESTION ${String(number).padStart(2,'0')} <span aria-hidden="true">/</span> ${q.id}</div><h2 class="question-text" id="question-text">${escape(q.stem)}</h2>${diagramHTML(q.id)}<div class="options" role="group" aria-labelledby="question-text">${item.order.map((originalIndex,displayIndex) => {
    const correct = checked && originalIndex === q.answer;
    const incorrect = checked && originalIndex === answer && !right;
    return `<button type="button" class="option ${originalIndex === answer ? 'selected' : ''} ${correct ? 'correct' : ''} ${incorrect ? 'incorrect' : ''}" data-option="${originalIndex}" aria-pressed="${originalIndex === answer}" ${checked ? 'disabled' : ''}><span class="letter" aria-hidden="true">${'ABCD'[displayIndex]}</span><span class="choice-text">${escape(q.options[originalIndex])}</span>${correct ? '<span class="answer-mark">✓ 正確</span>' : incorrect ? '<span class="answer-mark">✕ 你揀</span>' : ''}</button>`;
  }).join('')}</div></div>${checked ? `<section class="explanation ${right ? '' : 'is-wrong'}" aria-live="polite"><h3>${right ? '答啱咗！' : '差少少，睇睇原因。'}</h3><p>${escape(q.explanation)}</p>${refHTML(q)}</section>` : ''}<div class="question-bottom">${s.mode === 'exam' ? `<button class="text-btn ${s.flags.includes(q.id) ? 'flagged-btn' : ''}" data-action="flag" aria-pressed="${s.flags.includes(q.id)}">${s.flags.includes(q.id) ? '◆ 已標記' : '◇ 標記再睇'}</button><div class="exam-navigation"><button class="secondary" data-action="previous" ${s.position === range.start ? 'disabled' : ''}>上一題</button><button class="primary" data-action="${s.position === range.end-1 ? 'submit-exam' : 'next'}">${s.position === range.end-1 ? '交此卷' : '下一題 →'}</button></div>` : `<span class="subtle">${checked ? '記住原理，再試下一題。' : '揀一個最合適答案'}</span><button class="primary" data-action="${checked ? 'next' : 'check'}" ${!checked && answer === undefined ? 'disabled' : ''}>${checked ? (s.position === s.items.length-1 ? '查看練習結果' : '下一題 →') : '確認答案'}</button>`}</div></article><div class="question-tail"><span>${q.sample ? '官方樣本考點・自編題目' : '官方手冊考點・自編題目'}</span><span>考綱 ${escape(cat.syllabus)}</span></div>`;
}
function railHTML() {
  return `<aside class="right-rail"><section class="exam-promo"><p class="eyebrow">EXAM MODE</p><h2>練好節奏，<br>再上試場。</h2><div class="exam-metrics"><div><strong>40</strong><small>每卷題數</small></div><div><strong>45</strong><small>每卷分鐘</small></div></div><button class="primary lime" data-action="exam-intro">試一份模擬卷 →</button></section><section class="rail-note"><h3>讀懂原因，先至記得穩。</h3><p>答案附解釋同官方手冊頁碼。標有「樣本考點」嘅題目，相關知識曾出現於海事處公開樣本。</p><a href="#sources" data-action="sources">睇題庫依據 ↗</a></section></aside>`;
}
function practiceHTML() {
  if (!data.session || data.session.mode==='exam' || data.session.mode==='mistakes') startPractice(false);
  const categories=CATEGORIES.filter(c=>practicePart==='all'||c.part===practicePart);
  return heading('PRACTICE / 甲部＋乙部','航海到輪機，逐題練穩。','甲部 180 題 · 乙部 180 題 · 每題附解釋及官方出處。')+`<div class="workspace"><div><div class="toolbar"><label class="field">試卷<select id="practice-part"><option value="all" ${practicePart==='all'?'selected':''}>甲＋乙部</option><option value="A" ${practicePart==='A'?'selected':''}>甲部・航駛船藝</option><option value="B" ${practicePart==='B'?'selected':''}>乙部・輪機知識</option></select></label><label class="field">考點<select id="category"><option value="all">全部考點</option>${categories.map(c=>`<option value="${c.id}" ${category===c.id?'selected':''}>${c.part==='A'?'甲':'乙'} · ${c.name}</option>`).join('')}</select></label><label class="field">題數<select id="practice-count">${[10,20,'all'].map(n=>`<option value="${n}" ${practiceCount===n?'selected':''}>${n==='all'?'全部':n+' 題'}</option>`).join('')}</select></label><button class="text-btn" data-action="new-practice">換一組 ↻</button></div>${questionCard(data.session)}</div>${railHTML()}</div>`;
}
function startPractice(renderAfter=true, mode='practice') {
  const pool = mode === 'mistakes' ? wrongQuestions() : QUESTIONS.filter(q=>(practicePart==='all'||q.part===practicePart)&&(category==='all'||q.category===category));
  if (!pool.length) return false;
  data.session = makeSession(pool, mode === 'mistakes' ? pool.length : practiceCount === 'all' ? pool.length : practiceCount, mode);
  data.preferences={category,count:practiceCount,part:practicePart};
  result = null; save();
  if (renderAfter) render();
  return true;
}
function examIntroHTML() {
  const history=data.history.length?`<section class="history"><h3>最近模擬試</h3>${data.history.map(h=>{const pass=typeof h.passed==='boolean'?h.passed:h.correct>=24;return `<div class="history-row"><span>${new Date(h.at).toLocaleString('zh-HK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}<small class="block">${h.choice==='AB'?'甲乙雙卷':h.choice==='A'?'甲部':'乙部'}${Array.isArray(h.papers)?' · '+h.papers.map(p=>`${p.part==='A'?'甲':'乙'} ${p.correct}/40`).join(' · '):''}</small></span><span>${h.correct} / ${h.total}<small class="block">${pass?'達合格線':'未達合格線'}</small></span></div>`;}).join('')}</section>`:'';
  return heading('MOCK EXAM / 模擬考試','揀好試卷，認真試一次。','完整二級船牌考試包括甲、乙兩部，各自合格。',false)+`<fieldset class="paper-picker"><legend>今次想練邊份？</legend>${['AB','A','B'].map(v=>`<label class="paper-choice ${examChoice===v?'selected':''}"><input type="radio" name="exam-choice" value="${v}" ${examChoice===v?'checked':''}><strong>${v==='AB'?'甲乙雙卷練習':v==='A'?'甲部・航駛船藝':'乙部・輪機知識'}</strong><span>${v==='AB'?'80 題 · 兩卷各 45 分鐘':v==='A'?'40 題 · 45 分鐘 · 航海與安全':'40 題 · 45 分鐘 · 引擎與操作'}</span></label>`).join('')}</fieldset><div class="exam-intro"><section class="exam-start"><p class="eyebrow">${examChoice==='AB'?'PART A + PART B':examChoice==='A'?'PART A · NAVIGATION':'PART B · ENGINEERING'}</p><h2>${examChoice==='AB'?'兩部都練，分開過關。':'一份卷，專心做。'}</h2><p>${examChoice==='AB'?'先做甲部，交卷後自行開始乙部。<br>兩卷完成後，睇成績、解釋同出處。':'每次抽取不同題目，選項重新排列。<br>交卷後睇成績、解釋同出處。'}</p><div class="exam-numbers"><div><strong>${examChoice==='AB'?'80':'40'}</strong><span>合共題數</span></div><div><strong>45</strong><span>每卷分鐘</span></div><div><strong>24</strong><span>每卷答啱合格</span></div></div><button class="primary lime" data-action="start-exam">開始${examChoice==='B'?'乙':'甲'}部計時 →</button></section><section class="card instructions"><h3>考試格式已按官方核對</h3><ol><li>甲部：航駛、船藝及安全；乙部：輪機知識。</li><li>各 40 題、45 分鐘，各題同分；每部 24 題答啱達合格線。</li><li>雙卷各自計時及評分，甲部剩餘時間不帶入乙部，分數不能互相補足。</li><li>考試中隱藏答案。時間到交當前試卷；重新整理仍會繼續計時。</li></ol><p class="subtle">雙卷是本站方便連續練習的安排。正式考試可分開報考，須在兩年內通過兩部。本站每卷涵蓋各大範疇，抽題比例並非官方配額。</p><div class="refs"><a href="${SOURCES.peak.url}#page=2" target="_blank" rel="noopener noreferrer">官方指南第 2.3–2.4 節 ↗</a></div></section></div>${history}`;
}
function examHTML() {
  if(!data.session||data.session.mode!=='exam')return examIntroHTML();
  const s=data.session,p=currentPaper(s),items=s.items.slice(p.start,p.end),answered=items.filter(i=>s.answers[i.id]!==undefined).length;
  if(isBetweenPapers(s))return heading('BETWEEN PAPERS / 卷間休息','甲部已交卷，準備乙部。','甲部答案已鎖定；兩卷完成後一併查看解釋。',false)+`<section class="card between-papers"><span class="tag">甲部 ${answered} / 40 題已作答</span><h2>乙部・輪機知識</h2><p>40 題，另外 45 分鐘。<br>按下按鈕先開始乙部計時，休息時間不計入考試用時。</p><button class="primary" data-action="start-next-paper">開始乙部計時 →</button><button class="text-btn" data-action="end-attempt">結束整次練習</button></section>`;
  return heading(s.choice==='AB'?`FULL PRACTICE / 第 ${s.activePaper+1} 卷，共 2 卷`:'EXAM IN PROGRESS',PARTS[p.part],'可以改答、標記及跳題；交卷後本卷答案會鎖定。',false)+`<div class="exam-bar"><div>本卷已作答 <strong>${answered} / 40</strong><small>本卷答啱 24 題達合格線</small></div><div><small>本卷剩餘時間</small><div id="timer" class="timer" role="timer" aria-live="off">${formatTime(secondsRemaining(s))}</div></div></div><div class="exam-layout"><div>${questionCard(s)}</div><aside class="card exam-map"><h3>${p.part==='A'?'甲':'乙'}部題目一覽</h3><div class="number-grid">${items.map((i,n)=>`<button class="qnum ${s.answers[i.id]!==undefined?'answered':''} ${s.position===p.start+n?'current':''} ${s.flags.includes(i.id)?'flagged':''}" data-jump="${p.start+n}" aria-label="本卷第 ${n+1} 題，${s.answers[i.id]!==undefined?'已作答':'未作答'}${s.flags.includes(i.id)?'，已標記':''}" ${s.position===p.start+n?'aria-current="step"':''}>${n+1}</button>`).join('')}</div><div class="map-legend"><span>淺藍：已作答</span><span>橙點：已標記</span></div><button class="primary" data-action="submit-exam">${s.choice==='AB'&&s.activePaper===0?'提交甲部 →':'交卷及查看結果'}</button><p class="subtle" style="margin-top:13px">未答按 0 分計。${s.choice==='AB'?'甲、乙各自合格。':''}</p></aside></div>`;
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
  return `<details class="card review-item"><summary><span class="review-state ${right?'':'wrong'}">${answer===null?q.id:right?'✓ 答啱':answer===undefined?'− 未答':'✕ 答錯'}</span><span>${escape(q.stem)}</span></summary><div class="review-answer">${diagramHTML(q.id)}<ol type="A">${order.map(i=>`<li class="${i===q.answer?'right':''}">${escape(q.options[i])}${i===q.answer?' ✓ 正確答案':''}${i===answer?'（你的選擇）':''}</li>`).join('')}</ol><p class="explain-text">${escape(q.explanation)}</p>${refHTML(q)}</div></details>`;
}
function resultsHTML() {
  const s=result, score=scoreSession(s,QUESTIONS), isExam=s.mode==='exam';
  const duration=durationSeconds(s);
  const shown=s.items.filter(i=>!reviewWrongOnly||s.answers[i.id]!==byId.get(i.id).answer);
  return heading(isExam?'EXAM RESULT / 模擬試成績':'PRACTICE RESULT / 練習完成',isExam?(score.passed?'達到合格線，繼續練穩。':'睇清錯因，下次再試。'):'完成一組，進步一步。',isExam?'每卷獨立以 24/40 為合格線；合計百分比只供參考。':'你嘅作答已更新到本機學習記錄。',false)+`<section class="results-head"><div class="score">${score.correct}<small> / ${score.total}</small></div><div><h2>${Number(score.percentage.toFixed(1))}% 正確</h2><p>${score.unanswered} 題未答 · 用時 ${formatTime(duration)}</p><p>${isExam?(score.passed?'本次各卷均達合格線。':'有試卷未達合格線，分數不能互補。'):'逐題睇返解釋，記住背後原理。'}</p></div></section>${isExam?`<div class="paper-scores">${score.papers.map(p=>`<section class="card paper-score"><span class="eyebrow">${PARTS[p.part]}</span><h3>${p.correct} / 40 <span class="${p.passed?'pass':'fail'}">${p.passed?'達合格線':'未達合格線'}</span></h3><p>${p.unanswered} 題未答 · ${p.percentage}%</p></section>`).join('')}</div>`:''}<div class="result-actions"><button class="primary" data-action="${isExam?'exam-intro':'new-practice'}">${isExam?'再做一份模擬卷':'再練一組'} →</button><button class="secondary" data-action="mistakes">錯題重溫</button><button class="secondary" data-action="toggle-review" aria-pressed="${reviewWrongOnly}">${reviewWrongOnly?'顯示全部題目':'只睇錯題／未答'}</button></div><div class="review-list">${shown.length?shown.map(i=>reviewItem(byId.get(i.id),s.answers[i.id],i)).join(''):'<section class="card empty"><h2>全部答啱！</h2><p>今次沒有錯題或未答題目。</p></section>'}</div>`;
}
function sourcesHTML() {
  const sampleCount=QUESTIONS.filter(q=>q.sample).length;
  return heading('SOURCES / 題庫與出處','有出處，先練得安心。',`最近核對：${CHECKED} · ${QUESTIONS.length} 題自編選擇題`,false)+`<section class="card sources-intro"><h2>完整兩部：航海、船藝、安全、輪機。</h2><p>按海事處甲部 14 項、乙部 7 項大範疇編寫，甲乙各 180 題。每題有四個選項、答案、解釋及支持答案的官方手冊頁碼；${sampleCount} 題另列相關官方公開樣本考點。情境題、計算題、燈號與頂標示意幫助分辨相近概念。</p><div class="notice">本站為獨立研習網站。題目是自編模擬題，並非歷屆真題，不能保證正式考試會出同一題。官方不公開正式題目及答案。遇到特定機型操作、油品和設定，應按製造商手冊。</div></section><div class="source-grid">${Object.values(SOURCES).map(s=>`<article class="card source-card"><span class="eyebrow">${s.edition}</span><h3>${s.title}</h3><p>${s.description}</p><a href="${s.url}" target="_blank" rel="noopener noreferrer">開啟官方文件 ↗</a></article>`).join('')}</div>${['A','B'].map(part=>`<section class="card coverage"><h3>${PARTS[part]} · 180 題</h3>${CATEGORIES.filter(c=>c.part===part).map(c=>{const n=QUESTIONS.filter(q=>q.category===c.id).length;return `<div class="coverage-row"><span>${c.name}</span><div class="mini-progress"><span style="width:${n/40*100}%"></span></div><small>${n} 題</small></div>`;}).join('')}</section>`).join('')}<section class="card sources-intro" style="margin-top:24px"><h3>核對方式與使用限制</h3><p style="margin-top:12px">考試制度對照 2025 年海事處規則及 2026 年 9 月 PEAK 指南：甲、乙部各 40 題、45 分鐘、60% 合格；兩部須分別通過。雙卷練習按上述規格連做兩卷，並非聲稱官方設一份合計評分的 80 題卷。</p><p style="margin-top:12px">知識內容依 2021 年官方手冊及兩份公開樣本核對。計算題列清假設；燈號題寫明船長、船種及狀態，示意圖只顯示題目所需識別部分。干擾選項採用相近零件、燈序、數值或操作次序；不靠選項長短指定答案。</p><p style="margin-top:12px">舊手冊涉及罰款、機場管制區邊界及器材數量的資料須另外核對現行規定；本版未把未確立現行依據的數字出成題。手冊印刷頁 34 的海里米數亦未用作換算題。涵蓋大範疇不等於官方全部考點，仍應閱讀完整考綱及最新航行佈告。</p><p style="margin-top:12px">每卷先覆蓋各大範疇再隨機抽餘下題目；這是本站練習分配，不是官方公布的出題比例。PDF 連結列出實際 PDF 頁碼和印刷頁碼，部分手機閱讀器需手動跳頁。</p><p class="subtle" style="margin-top:16px">記錄只保存在本瀏覽器，不需註冊、不上傳作答資料。版本更新會保留已完成練習紀錄，舊版未完成試卷因題庫修訂不再續用。</p></section>`;
}
function render(focus=false) {
  let content=result ? resultsHTML() : view==='practice'?practiceHTML():view==='exam'?examHTML():view==='mistakes'?mistakesHTML():sourcesHTML();
  if (!storageOK) content='<p class="storage-notice" role="status">這個瀏覽器未能儲存進度。仍可操題，但重新整理或關閉後可能失去記錄。</p>'+content;
  $('main').innerHTML=content;updateSidebar();
  if (focus) {$('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function formatTime(seconds) {const n=Math.max(0,Math.floor(seconds||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function selectAnswer(answer) {
  const current=activeQuestion();if(!current||result)return false;
  const {session:s,q}=current;
  if(s.mode==='exam'&&secondsRemaining(s)===0){finishPaper(true);return false;}
  if(!setAnswer(s,q.id,answer))return false;
  save();render();document.querySelector(`[data-option="${answer}"]`)?.focus({preventScroll:true});return true;
}
function checkPractice() {
  const current=activeQuestion();if(!current||current.session.mode==='exam'||result)return;
  const {session:s,q}=current;
  if (s.checked[q.id]||s.answers[q.id]===undefined)return;
  s.checked[q.id]=true;data.stats=recordAnswer(data.stats,q,s.answers[q.id]);save();render();
  document.querySelector('[data-action="next"]')?.focus({preventScroll:true});
}
function finishPaper(expired=false) {
  const s=data.session;if(!s||s.mode!=='exam'||!submitPaper(s))return;
  const d=$('confirm-dialog');if(d.open)d.close('paper-ended');
  if(s.finishedAt!==null)finishSession();else{save();render(true);}
  if(expired)toast('本卷時間到，已自動交卷。');
}
function finishSession() {
  const s=data.session;if(!s)return;
  endSession(s);
  if(s.mode==='exam')for(const i of s.items)data.stats=recordAnswer(data.stats,byId.get(i.id),s.answers[i.id]);
  const score=scoreSession(s,QUESTIONS);
  if(s.mode==='exam'&&!data.history.some(h=>h.id===s.id))data.history=[{id:s.id,at:s.finishedAt,choice:s.choice,correct:score.correct,total:score.total,passed:score.passed,papers:score.papers},...data.history].slice(0,10);
  result=structuredClone(s);reviewWrongOnly=false;data.session=null;save();
  const d=$('confirm-dialog');if(d.open)d.close('finished');render(true);
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
    const ok=await confirmAction('交卷並離開？','離開會結束整次模擬試，當前及尚未開始的試卷，未答題目全部按 0 分計。','交卷並離開');
    if(!ok){history.replaceState(null,'',`#${view}`);return;}finishSession();
  }
  result=null;view=next;
  if(data.session?.mode==='mistakes'&&next!=='mistakes'){data.session=null;save();}
  history.replaceState(null,'',`#${next}`);render(true);
}
async function action(name) {
  if(['practice','mistakes','sources'].includes(name))return navigate(name);
  if(name==='exam-intro')return navigate('exam');
  if(name==='start-exam'){
    if(data.session?.mode==='exam')return;
    data.session=makeExamSession(QUESTIONS,examChoice);view='exam';result=null;save();render(true);return;
  }
  if(name==='start-mistakes'){view='mistakes';startPractice(true,'mistakes');return;}
  if(name==='new-practice'){view='practice';startPractice();return;}
  if(name==='check'){checkPractice();return;}
  if(name==='toggle-review'){reviewWrongOnly=!reviewWrongOnly;render();return;}
  const s=data.session;if(!s)return;
  if(name==='start-next-paper'){if(startNextPaper(s)){save();render(true);}return;}
  if(name==='end-attempt'){
    if(await confirmAction('結束整次練習？','尚未作答的乙部會按 0 分計。你亦可以取消，保留進度稍後再開始乙部。','結束練習'))finishSession();return;
  }
  if(s.mode==='exam'&&secondsRemaining(s)===0){finishPaper(true);return;}
  if(isBetweenPapers(s))return;
  const range=paperRange(s);
  if(name==='submit-exam'){
    if(s.mode!=='exam')return;
    const paperIndex=s.activePaper,remaining=s.items.slice(range.start,range.end).filter(i=>s.answers[i.id]===undefined).length;
    const next=s.choice==='AB'&&s.activePaper===0;
    const message=`本卷${remaining?'還有 '+remaining+' 題未答，按 0 分計。':'全部題目已作答。'}${next?'提交後甲部會鎖定，之後可自行開始乙部。':'交卷後可查看成績、答案及解釋。'}`;
    if(await confirmAction('確認提交本卷？',message,'提交本卷')){
      if(data.session===s&&s.activePaper===paperIndex&&!isBetweenPapers(s))finishPaper(secondsRemaining(s)===0);
    }return;
  }
  if(name==='flag'){const id=s.items[s.position].id;s.flags=s.flags.includes(id)?s.flags.filter(x=>x!==id):[...s.flags,id];save();render();return;}
  if(name==='previous'&&s.position>range.start){s.position--;save();render(true);return;}
  if(name==='next'){
    if(s.mode!=='exam'&&!s.checked[s.items[s.position].id])return;
    if(s.position===range.end-1){if(s.mode!=='exam')finishSession();}
    else{s.position++;save();render(true);}
  }
}
$('nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)void navigate(b.dataset.view);});
$('main').addEventListener('click',e=>{
  const option=e.target.closest('[data-option]');if(option){selectAnswer(Number(option.dataset.option));return;}
  const jump=e.target.closest('[data-jump]');if(jump&&data.session?.mode==='exam'){
    if(secondsRemaining(data.session)===0){finishPaper(true);return;}
    const range=paperRange(data.session),n=Number(jump.dataset.jump);
    if(isBetweenPapers(data.session)||!Number.isInteger(n)||n<range.start||n>=range.end)return;
    data.session.position=n;save();render(true);return;
  }
  const b=e.target.closest('[data-action]');if(b){e.preventDefault();void action(b.dataset.action);}
});
$('main').addEventListener('change',e=>{
  if(e.target.name==='exam-choice'&&['AB','A','B'].includes(e.target.value)){examChoice=e.target.value;render();return;}
  if(e.target.id==='practice-part'){practicePart=e.target.value;category='all';startPractice();return;}
  if(e.target.id==='category'){category=e.target.value;startPractice();}
  if(e.target.id==='practice-count'){practiceCount=e.target.value==='all'?'all':Number(e.target.value);startPractice();}
});
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.hash='practice';url.search='';
  try{if(navigator.share){await navigator.share({title:'大偈研習室',text:'香港二級船牌甲乙部 360 題，附答案、解釋、官方出處及分卷模擬試。',url:url.href});return;}}
  catch(e){if(e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(url.href);toast('已複製網址，可以分享畀朋友。');}
  catch{window.prompt('複製以下網站網址：',url.href);}
});
function tick(){
  const s=data.session;if(s?.mode!=='exam')return;
  const left=secondsRemaining(s);
  if(left===0){finishPaper(true);return;}
  if(left===null)return;
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
