import { S } from '../store.js';
import { stats, openTasks, STAGES } from '../sim.js';
import { MILES } from '../arch.js';
import { getCo, allCo } from '../companies.js';
import { eur, esc, ic, fmtDate, fmtShort } from '../util.js';
import { bind, openApp, appApi, sc, bar } from '../ui.js';
import { cashChart } from '../viz.js';

export default { id: 'dashboard', n: 'Dashboard', ic: 'dash', w: 1040, h: 700, create(root) {
  bind(root, { open(d) { openApp(d.app); if (d.id) appApi(d.app)?.go?.(d.id); } });
  function render() {
    const st = stats(), tasks = openTasks(), leads = allCo().filter(c => { const k = S.co[c.id]; return k && k.lead && !['gewonnen', 'verloren', 'ruhend'].includes(k.stage); }).length,
      proj = S.projects.filter(p => ['kickoff', 'build', 'demo', 'deploy'].includes(p.status)).length, cust = S.projects.filter(p => !p.churn).length,
      mts = S.meetings.filter(m => !m.done && m.d >= S.day).sort((a, b) => a.d - b.d || a.h - b.h).slice(0, 5);
    const kp = (l, v, s, c = '') => `<div class="kpi"><div class="l">${l}</div><div class="v ${c}">${v}</div><div class="s">${s || '&nbsp;'}</div></div>`;
    root.innerHTML = `<div class="pad">
    <div class="g3 mb" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${kp('Kontostand', eur(S.cash), `Start ${eur(S.start)}`, S.cash < 300 ? 'bad' : '')}${kp('Umsatz (30 T.)', eur(st.rev), 'netto')}${kp('Ausgaben (30 T.)', eur(st.exp), 'Betrieb, Hosting, Tools')}${kp('Gewinn (30 T.)', eur(st.profit), '', st.profit < 0 ? 'bad' : st.profit > 0 ? 'ok' : '')}${kp('Wiederkehrend', eur(st.rec) + '/Mo', 'Wartungsverträge')}${kp('Reputation', Math.round(S.rep), S.me.exp)}</div>
    <div class="g2" style="grid-template-columns:1.25fr 1fr">
      <div class="col">
        <div class="card"><h3>Kontoverlauf</h3>${cashChart()}</div>
        <div class="card"><h3>Offene Aufgaben (${tasks.length})</h3>${tasks.length ? `<div class="list">${tasks.slice(0, 9).map(t => `<div class="it" data-a="open" data-app="${t.app}" data-id="${t.id || ''}"><span class="mut3">${ic('flag', 14)}</span><span class="sp sm">${esc(t.t)}</span></div>`).join('')}</div>` : '<div class="empty">Nichts offen. Recherchiere neue Unternehmen oder schreibe Leads an.</div>'}</div>
        <div class="card"><h3>Letzte Aktivitäten</h3>${S.act.slice(0, 7).map(a => `<div class="row sm" style="padding:3px 0"><span class="mut3 mono xs" style="width:44px">${fmtShort(a.d)}</span><span>${esc(a.t)}</span></div>`).join('') || '<div class="empty">Noch keine Aktivität.</div>'}</div>
      </div>
      <div class="col">
        <div class="card"><h3>Geschäft</h3><div class="g2" style="gap:8px">${kp('Aktive Leads', leads, 'in der Pipeline')}${kp('Projekte', proj, `${cust} Kunden gesamt`)}${kp('Offene Rechnungen', eur(st.out), `${S.inv.filter(i => !i.paid).length} Stk.`)}${kp('Stunden heute', S.hours.toFixed(1).replace('.', ','), `von ${(S.cap || 8).toString().replace('.', ',')} (Support: ${(8 - (S.cap || 8)).toFixed(1).replace('.', ',')} h)`)}</div></div>
        <div class="card"><h3>Anstehende Termine</h3>${mts.length ? mts.map(m => `<div class="row sm it" style="padding:5px 0;cursor:pointer" data-a="open" data-app="calendar" data-id="${m.id}"><span class="tag ${m.d === S.day ? 'ac' : ''}">${m.d === S.day ? 'Heute' : fmtShort(m.d)} ${m.h}:00</span><span class="tr">${esc(getCo(m.co).n)}</span></div>`).join('') : '<div class="empty">Keine Termine.</div>'}</div>
        <div class="card"><h3>Benachrichtigungen</h3>${S.notif.slice(0, 5).map(n => `<div class="sm" style="padding:4px 0;border-bottom:1px solid var(--line)">${esc(n.t)}</div>`).join('') || '<div class="empty">Ruhig.</div>'}</div>
        <div class="card"><h3>Meilensteine ${Object.keys(S.mil).length}/${MILES.length}</h3>${MILES.map(m => `<div class="row sm" style="padding:2px 0;${S.mil[m[0]] != null ? '' : 'opacity:.45'}"><span class="${S.mil[m[0]] != null ? 'ok' : ''}">${ic(S.mil[m[0]] != null ? 'check' : 'target', 14)}</span><span>${m[1]}</span></div>`).join('')}</div>
      </div></div></div>`;
  }
  return { render, go() { } };
} };
