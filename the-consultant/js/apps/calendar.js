import { S, cs, emit, uid } from '../store.js';
import { getCo } from '../companies.js';
import { startCall } from '../sales.js';
import { esc, ic, eur, fmtDate, fmtLong, dateOf, wd } from '../util.js';
import { bind, openApp, toast } from '../ui.js';

export default { id: 'calendar', n: 'Kalender', ic: 'cal', w: 980, h: 680, create(root) {
  let off = 0, selD = null; S.rem ||= [];
  const evs = d => {
    const o = [];
    S.meetings.filter(m => m.d === d && !m.missed).forEach(m => o.push({ t: `${m.h}:00 ${getCo(m.co).n}`, c: m.done ? 'ev' : 'ev', m }));
    S.projects.filter(p => p.dl === d && !['live', 'done'].includes(p.status)).forEach(p => o.push({ t: `Frist: ${getCo(p.co).n}`, c: 'ev dl' }));
    S.inv.filter(i => i.due === d && !i.paid).forEach(i => o.push({ t: `Fällig: ${i.no}`, c: 'ev ms' }));
    S.rem.filter(r => r.d === d).forEach(r => o.push({ t: r.t, c: 'ev ms', r }));
    Object.entries(S.co).filter(([, c]) => c.fu === d && c.lead).forEach(([id]) => o.push({ t: `Follow-up: ${getCo(id).n}`, c: 'ev dl' }));
    return o;
  };
  bind(root, { prev() { off--; }, next() { off++; }, today() { off = 0; selD = S.day; }, sel(d) { selD = +d.d; },
    call(d) { const r = startCall(d.id); emit(); if (r.nohours) return toast(`Dafür fehlen dir heute Stunden (benötigt ${r.need.toFixed(1).replace('.', ',')} h). Plane Projektarbeit nach dem Termin.`, 'warn'); if (r.noshow) return; openApp('call'); }, mail(d) { openApp('mail', { to: d.to }); },
    addrem() { const t = root.querySelector('#rt').value.trim(), dd = root.querySelector('#rd').value; if (!t || !dd) return toast('Text und Datum angeben.', 'warn'); S.rem.push({ id: uid('r'), d: Math.round((Date.parse(dd) - Date.UTC(2026, 10, 2)) / 864e5), t }); emit(); } });
  function render() {
    const base = dateOf(S.day), y = base.getUTCFullYear(), mo = base.getUTCMonth() + off, first = new Date(Date.UTC(y, mo, 1)), dayN = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), d0 = Math.round((first - Date.UTC(2026, 10, 2)) / 864e5), lead = (first.getUTCDay() + 6) % 7;
    selD ??= S.day; const cells = []; for (let i = 0; i < lead; i++) cells.push('<div></div>'); for (let i = 0; i < dayN; i++) { const d = d0 + i, e = evs(d); cells.push(`<div class="${d === S.day ? 'td' : ''}" data-a="sel" data-d="${d}" style="cursor:pointer;${selD === d ? 'box-shadow:inset 0 0 0 1px var(--ac)' : ''}"><span class="${d < S.day ? 'mut3' : ''}">${i + 1}</span>${e.slice(0, 3).map(x => `<div class="${x.c}">${esc(x.t)}</div>`).join('')}${e.length > 3 ? `<div class="xs mut3">+${e.length - 3}</div>` : ''}</div>`); }
    const sd = evs(selD);
    root.innerHTML = `<div class="pad"><div class="row mb"><h2>${first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><span class="sp"></span><button class="btn s" data-a="prev">${ic('back', 13)}</button><button class="btn s" data-a="today">Heute</button><button class="btn s" data-a="next">${ic('arrow', 13)}</button></div>
    <div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="hd">${d}</div>`).join('')}${cells.join('')}</div>
    <div class="g2 mt" style="margin-top:14px"><div class="card"><h3>${fmtLong(selD)}</h3>${sd.map(x => x.m ? `<div class="row sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="tag ac">${x.m.h}:00 · ${x.m.dur} min</span><span class="sp tr">${esc(getCo(x.m.co).n)} – ${esc(getCo(x.m.co).cn[x.m.ct].name)}</span>${x.m.done ? '<span class="tag ok">erledigt</span>' : x.m.d === S.day ? `<button class="btn s p" data-a="call" data-id="${x.m.id}">${ic('phone', 13)} Gespräch starten</button>` : '<span class="tag">geplant</span>'}</div>` : `<div class="sm" style="padding:5px 0">${esc(x.t)}</div>`).join('') || '<p class="mut sm">Keine Einträge.</p>'}</div>
    <div class="card"><h3>Erinnerung hinzufügen</h3><div class="col"><input id="rt" data-k="rt" placeholder="Was?"><input id="rd" type="date" data-k="rd"><button class="btn s p" data-a="addrem">Hinzufügen</button></div></div></div>
    <div class="card mt" style="margin-top:12px"><h3>Nächste Termine</h3>${S.meetings.filter(m => !m.done && m.d >= S.day).sort((a, b) => a.d - b.d).slice(0, 6).map(m => `<div class="row sm" style="padding:3px 0"><span class="tag">${fmtDate(m.d, { weekday: 'short', day: '2-digit', month: '2-digit' })} ${m.h}:00</span>${esc(getCo(m.co).n)} <span class="mut">(${m.type})</span></div>`).join('') || '<p class="mut sm">Keine. Vereinbare Termine über E-Mail-Antworten interessierter Kontakte.</p>'}</div></div>`;
  }
  return { render, go(id) { const m = S.meetings.find(x => x.id === id); if (m) { selD = m.d; off = 0; } } };
} };
