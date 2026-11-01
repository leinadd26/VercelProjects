// Gemeinsame Darstellungen: Prozesslandkarte (aus Erkenntnissen), Architekturdiagramm, Kontoverlauf, Fakten
import { S, cs } from './store.js';
import { ARCH, COMP, LANES, QS, API_TXT } from './arch.js';
import { getCo } from './companies.js';
import { esc, eur, num } from './util.js';

export function processMap(co) {
  const k = cs(co.id).known, ar = ARCH[co.a]; const n = (t, q) => `<div class="nd ${q ? 'q' : ''}">${q ? '?' : esc(t)}</div>`, a = '<span class="ar">→</span>';
  const steps = k.who ? ar.steps : null;
  return `<div class="flow">${n(ar.trig.split('–')[0].split('.')[0], !k.trigger)}${a}${steps ? steps.map(s => n(s) + a).join('') : n('', 1) + a + n('', 1) + a}${n(k.systems ? co.sysn : '', !k.systems)}${a}${n(k.success ? 'Ergebnis: ' + (S.co && '') + 'Erfolgsmaß erhoben' : '', !k.success)}</div>`;
}
export function archDiagram(comps, api) {
  if (!comps.length) return '<p class="mut sm">Noch keine Bausteine gewählt.</p>';
  return `<div class="col">${LANES.map((l, i) => { const cs_ = comps.filter(c => COMP[c].lane === i); return cs_.length ? `<div><div class="xs mut3" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${l}</div><div class="flow">${cs_.map((c, j) => `<div class="nd">${esc(COMP[c].n)}</div>${j < cs_.length - 1 ? '<span class="ar">+</span>' : ''}`).join('')}</div></div>` : ''; }).join('')}</div>`;
}
export function cashChart(h = 120) {
  const d = S.cashH.length > 1 ? S.cashH : [[0, S.cashH[0][1]], [1, S.cashH[0][1]]], W = 400, H = h, mx = Math.max(...d.map(x => x[1])), mn = Math.min(0, ...d.map(x => x[1])), x0 = d[0][0], x1 = d[d.length - 1][0] || 1;
  const X = v => 8 + (v - x0) / Math.max(1, x1 - x0) * (W - 16), Y = v => H - 16 - (v - mn) / Math.max(1, mx - mn) * (H - 30);
  const pts = d.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' L'), z = Y(0);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kontoverlauf"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c8dff" stop-opacity=".35"/><stop offset="1" stop-color="#4c8dff" stop-opacity="0"/></linearGradient></defs><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="#2c3a60" stroke-dasharray="3 3"/><path class="ar" d="M${X(d[0][0])},${z} L${pts} L${X(x1)},${z}z"/><path d="M${pts}"/><text x="8" y="12">${eur(mx)}</text><text x="8" y="${H - 3}">Tag ${x0 + 1}</text><text x="${W - 50}" y="${H - 3}">Tag ${x1 + 1}</text></svg>`;
}
export const FACT_L = { trigger: 'Auslöser', who: 'Beteiligte', systems: 'Systeme', volume: 'Vorgänge / Monat', duration: 'Minuten / Vorgang', errors: 'Fehlerquote', failure: 'Bei Fehlern', storage: 'Datenablage', api: 'Schnittstelle', judgment: 'Menschl. Urteil', cost: 'Kosten', success: 'Erfolgsmaß', priorities: 'Prioritäten', tried: 'Bisher versucht', team: 'Haltung des Teams', decision: 'Entscheider', budget: 'Budgetrahmen', security: 'Datenschutz / Sicherheit', it: 'Technischer Kontakt' };
export function factsTable(id) {
  const k = cs(id).known; const keys = QS.map(q => q.id);
  return `<table class="tbl">${keys.map(q => { const f = k[q]; const v = f ? (f.txt || String(f.v)) : null; return `<tr><td class="mut3 sm" style="width:130px">${FACT_L[q]}</td><td class="sm">${f ? `${esc(v)} ${f.vague ? '<span class="tag warn">ungefähr</span>' : ''}${f.stale ? '<span class="tag bad">veraltet?</span>' : ''}${f.src && f.src !== 'Gespräch' ? `<span class="tag">${esc(f.src)}</span>` : ''}` : '<span class="mut3">– nicht erhoben –</span>'}</td></tr>`; }).join('')}</table>`;
}
export const trustLbl = t => t >= 75 ? 'Sehr gut' : t >= 55 ? 'Gut' : t >= 40 ? 'Neutral' : t >= 25 ? 'Angespannt' : 'Schlecht';
export { num };
