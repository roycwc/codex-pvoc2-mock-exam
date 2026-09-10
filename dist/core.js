export function shuffled(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function makeSession(bank, count, mode = 'practice', now = Date.now(), random = Math.random) {
  if (!bank.length || !Number.isInteger(count) || count < 1) throw new Error('沒有合適題目');
  if (!['practice', 'exam', 'mistakes'].includes(mode)) throw new Error('模式不正確');
  if (mode === 'exam' && (count !== 40 || bank.length < 40)) throw new Error('模擬考試需要 40 題');
  const chosen = shuffled(bank, random).slice(0, Math.min(count, bank.length));
  return {
    id: `${now}-${random().toString(36).slice(2)}`, mode, startedAt: now,
    deadline: mode === 'exam' ? now + 45 * 60 * 1000 : null,
    items: chosen.map(q => ({ id: q.id, order: shuffled([0,1,2,3], random) })),
    answers: {}, checked: {}, flags: [], position: 0, finishedAt: null
  };
}
export function scoreSession(session, questions) {
  const byId = new Map(questions.map(q => [q.id, q]));
  const correct = session.items.filter(i => session.answers[i.id] === byId.get(i.id)?.answer).length;
  const answered = session.items.filter(i => Number.isInteger(session.answers[i.id])).length;
  const total = session.items.length;
  return {correct, answered, unanswered: total - answered, total, percentage: total ? correct / total * 100 : 0, passed: total > 0 && correct / total >= .6};
}
export function secondsRemaining(session, now = Date.now()) {
  return session.deadline === null ? null : Math.max(0, Math.ceil((session.deadline - now) / 1000));
}
export function isSessionValid(s, questions) {
  if (!s || typeof s !== 'object' || typeof s.id !== 'string') return false;
  if (!['practice','exam','mistakes'].includes(s.mode) || !Array.isArray(s.items) || !s.items.length || s.items.length > questions.length) return false;
  const known = new Set(questions.map(q => q.id));
  const ids = s.items.map(i => i?.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !known.has(id))) return false;
  if (s.items.some(i => !Array.isArray(i.order) || i.order.length !== 4 || [...i.order].sort().join(',') !== '0,1,2,3')) return false;
  if (!s.answers || typeof s.answers !== 'object' || Array.isArray(s.answers) || !s.checked || typeof s.checked !== 'object' || Array.isArray(s.checked)) return false;
  if (Object.entries(s.answers).some(([id,n]) => !ids.includes(id) || !Number.isInteger(n) || n < 0 || n > 3)) return false;
  if (Object.entries(s.checked).some(([id,v]) => !ids.includes(id) || v !== true || !Number.isInteger(s.answers[id]))) return false;
  if (!Array.isArray(s.flags) || s.flags.some(id => !ids.includes(id))) return false;
  if (!Number.isInteger(s.position) || s.position < 0 || s.position >= ids.length || !Number.isFinite(s.startedAt)) return false;
  if (!(s.finishedAt === null || Number.isFinite(s.finishedAt))) return false;
  if (s.mode === 'exam' && (ids.length !== 40 || !Number.isFinite(s.deadline) || s.deadline !== s.startedAt + 2700000)) return false;
  return s.mode === 'exam' || s.deadline === null;
}
export function recordAnswer(stats, q, answer, time = Date.now()) {
  const previous = stats[q.id] || {attempts:0, correct:0};
  const right = answer === q.answer;
  return {...stats, [q.id]: {attempts:previous.attempts + 1, correct:previous.correct + Number(right), lastCorrect:right, lastAt:time}};
}
