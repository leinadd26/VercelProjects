import { S, cs, emit } from '../store.js';
import { getCo, wf } from '../companies.js';
import { QS, PERS, KEYQ } from '../arch.js';
import { callAsk, callClarify, callSummarize, callPitch, callEnd, hint, keysKnown } from '../sales.js';
import { esc, ic } from '../util.js';
import { bind, openApp, feedback, toast, bar, closeApp } from '../ui.js';
import { FACT_L } from '../viz.js';

export default { id: 'call', n: 'Gespräch', ic: 'phone', w: 1040, h: 680, nopad: true, create(root) {
  let hintOn = false;
  bind(root, {
    q(d) { callAsk(d.q); emit(); }, clar(d) { callClarify(d.q); emit(); }, sum() { callSummarize(); emit(); }, pitch() { callPitch(); emit(); }, hint() { hintOn = !hintOn; },
    free() { const t = root.querySelector('#ft').value.trim(); if (!t) return; const L = t.toLowerCase(); let best = null, bs = 0; QS.forEach(q => { if (S.call.asked.includes(q.id)) return; const sc = q.kw.split(' ').filter(w => L.includes(w)).length; if (sc > bs) { bs = sc; best = q; } }); if (!best) return toast('Daraus kann ich keine passende Frage ableiten. Formuliere konkreter oder nutze die Fragenliste.', 'warn'); callAsk(best.id, t); emit(); },
    end() { const fb = callEnd(); emit(); feedback({ title: 'Auswertung Discovery-Gespräch', score: fb.score, sum: fb.score >= 70 ? 'Starkes Gespräch.' : fb.score >= 45 ? 'Solide Basis, aber Lücken.' : 'Zu wenig belastbare Fakten.', good: fb.good, miss: fb.miss, real: fb.real, next: fb.next }); },
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ft') root.querySelector('[data-a=free]').click(); });
  function render() {
    const c = S.call;
    if (!c) { root.innerHTML = `<div class="empty" style="padding:60px"><p>Kein aktives Gespräch.</p><p class="sm">Starte Gespräche im Kalender am Tag des Termins.</p></div>`; return; }
    const co = getCo(c.co), ct = co.cn[c.ct], k = cs(c.co), P = PERS[ct.p], cats = [...new Set(QS.map(q => q.cat))];
    root.innerHTML = `<div class="split" style="grid-template-columns:1fr 330px"><div style="display:flex;flex-direction:column;min-height:0;overflow:hidden"><div class="row pad" style="padding:10px 14px;border-bottom:1px solid var(--line)"><div class="sp"><b>${esc(ct.name)}</b> <span class="mut">${esc(ct.role)} · ${esc(co.n)}</span></div><span class="mut sm">${Math.max(0, c.left)} / ${c.tot} min</span><div style="width:90px">${bar(Math.max(0, c.left) / c.tot * 100, c.left < 10 ? 'bad' : '')}</div>${S.hints ? `<button class="btn s g" data-a="hint">${ic('bulb', 14)}</button>` : ''}</div>${hintOn ? `<div class="card sm" style="margin:8px 14px 0">${esc(hint('call'))}</div>` : ''}
    <div class="tx" data-sc="tx" style="flex:1;overflow:auto">${c.tx.map(m => `<div class="${m.w}">${esc(m.t)}${m.vague && !k.known[m.q]?.vague === false ? '' : ''}${m.q && k.known[m.q]?.vague && m.w === 'c' && !c.ended ? `<div style="margin-top:6px"><span class="chip" data-a="clar" data-q="${m.q}">Präzisieren?</span></div>` : ''}</div>`).join('')}</div>
    <div class="row pad" style="padding:10px 14px;border-top:1px solid var(--line)"><input id="ft" data-k="ft" placeholder="${c.ended ? 'Gespräch ist beendet' : 'Eigene Frage formulieren …'}" ${c.ended ? 'disabled' : ''}><button class="btn" data-a="free" ${c.ended ? 'disabled' : ''}>Fragen</button><button class="btn" data-a="sum" ${c.sum || c.asked.length < 3 || c.ended ? 'disabled' : ''}>Zusammenfassen</button><button class="btn" data-a="pitch" ${c.pitched || c.ended ? 'disabled' : ''}>Lösung skizzieren</button><button class="btn ${c.ended ? 'p' : 'd'}" data-a="end">${c.ended ? 'Auswerten' : 'Beenden'}</button></div></div>
    <div class="sb" style="border-left:1px solid var(--line);border-right:0" data-sc="pal"><div class="pad col">${cats.map(cat => `<div><div class="xs mut3" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${cat}</div><div class="col" style="gap:4px">${QS.filter(q => q.cat === cat).map(q => `<span class="chip ${c.asked.includes(q.id) || c.ended || c.left <= 0 ? 'u' : ''}" data-a="q" data-q="${q.id}" style="border-radius:8px">${esc(q.t)}</span>`).join('')}</div></div>`).join('')}
    <div class="card"><h3>Kernfakten ${keysKnown(c.co)}/${KEYQ.length}</h3>${KEYQ.map(q => `<div class="xs" style="padding:1px 0;${k.known[q] ? '' : 'opacity:.4'}">${k.known[q] ? (k.known[q].vague ? '◐' : '●') : '○'} ${FACT_L[q]}</div>`).join('')}</div></div></div></div>`;
  }
  return { render, busy: () => document.activeElement?.id === 'ft', go() { } };
} };
