import { S, cs, emit } from '../store.js';
import { getCo } from '../companies.js';
import { pct, canWork, workTask, resolveInc, holdDemo, offerMaint } from '../proj.js';
import { issueInvoice } from '../sim.js';
import { INC, COMP, CAMP } from '../arch.js';
import { hint } from '../sales.js';
import { esc, ic, eur, fmtDate, sum } from '../util.js';
import { bind, toast, feedback, alertBox, bar, sc } from '../ui.js';
import { archDiagram } from '../viz.js';

const ST = { kickoff: 'Kick-off', build: 'Umsetzung', demo: 'Abnahme-Demo', deploy: 'Deployment', live: 'Live', done: 'Abgeschlossen', cancelled: 'Abgebrochen' };
export default { id: 'projects', n: 'Projekte', ic: 'folder', w: 1080, h: 700, nopad: true, create(root) {
  let sel = null, tab = 'tasks', hintOn = false;
  bind(root, {
    sel(d) { sel = d.id; tab = 'tasks'; }, tab(d) { tab = d.t; }, hint() { hintOn = !hintOn; },
    work(d) { const p = S.projects.find(x => x.id === sel), h = d.h === 'rest' ? S.hours : +d.h, r = workTask(sel, d.t, h); if (r.err) toast(r.err, 'warn'); else if (r.done) toast('Aufgabe abgeschlossen.', 'good'); emit(); },
    inc(d) { const r = resolveInc(sel, +d.o); emit(); if (r) feedback({ title: r.good ? 'Gute Entscheidung' : 'Entscheidung mit Folgen', good: r.good ? [r.f] : [], miss: r.good ? [] : [r.f], next: 'Vorfälle sind Alltag – entscheidend ist, ob du die Ursache oder nur das Symptom behebst.' }); },
    demo() { const r = holdDemo(sel); emit(); if (r.err) return toast(r.err, 'warn'); feedback({ title: r.ok ? 'Abnahme erteilt' : 'Änderungswünsche', good: r.ok ? [r.f] : [], miss: r.ok ? [] : [r.f] }); },
    bill(d) { const inv = issueInvoice(sel, d.b); if (inv) { toast(`Rechnung ${inv.no} gestellt (fällig ${fmtDate(inv.due)}).`, 'good'); emit(); } },
    maint() { const v = +root.querySelector('#mf').value, r = offerMaint(sel, v); emit(); feedback({ title: r.ok ? 'Wartungsvertrag' : 'Kein Wartungsvertrag', good: r.ok ? [r.f] : [], miss: r.ok ? [] : [r.f], pro: ['Setze die Gebühr so, dass Hosting, API-Kosten und dein Supportaufwand gedeckt sind.'] }); },
  });
  function render() {
    const P = S.projects.slice().reverse(); if (!sel && P.length) sel = P[0].id; if (sel && !P.find(p => p.id === sel)) sel = P[0]?.id || null;
    const p = P.find(x => x.id === sel);
    root.innerHTML = `<div class="split" style="grid-template-columns:260px 1fr"><div class="sb"><div class="pad b">Projekte (${P.length})</div><div class="list">${P.map(x => `<div class="it ${x.id === sel ? 'sel' : ''}" data-a="sel" data-id="${x.id}"><div class="sp" style="min-width:0"><div class="b sm tr">${esc(getCo(x.co).n)}</div><div class="xs mut3 tr">${esc(x.name)}</div><div class="row xs" style="margin-top:5px"><span class="tag ${['live', 'done'].includes(x.status) ? 'ok' : x.pend.length ? 'bad' : 'ac'}">${ST[x.status]}</span>${x.pend.length ? '<span class="tag bad">Vorfall!</span>' : ''}<span class="sp"></span><span class="mut3">${pct(x)} %</span></div></div></div>`).join('') || '<div class="empty">Noch kein Projekt. Gewinne einen Kunden über Angebot und Verhandlung.</div>'}</div></div>
    <div data-sc="p">${p ? view(p) : '<div class="empty" style="padding:60px">Wähle ein Projekt.</div>'}</div></div>`;
  }
  function view(p) {
    const co = getCo(p.co), over = S.day - p.dl, inc = p.pend[0] && INC[p.pend[0]], active = !['live', 'done', 'cancelled'].includes(p.status);
    return `<div class="pad col"><div class="row w"><h2 class="sp">${esc(p.name)}</h2><span class="tag ac">${ST[p.status]}</span>${p.pilot ? '<span class="tag">Pilot</span>' : ''}${S.hints ? `<button class="btn s g" data-a="hint">${ic('bulb', 14)}</button>` : ''}</div>
    ${hintOn ? `<div class="card sm">${esc(hint('project'))}</div>` : ''}
    <div class="g4"><div class="kpi"><div class="l">Kunde</div><div class="v sm tr" style="font-size:14px">${esc(co.n)}</div></div><div class="kpi"><div class="l">Budget</div><div class="v" style="font-size:16px">${eur(p.price)}</div><div class="s">${p.mt ? eur(p.mt) + '/Mo Wartung' : 'ohne Wartung'}</div></div><div class="kpi"><div class="l">Frist</div><div class="v ${over > 0 && active ? 'bad' : ''}" style="font-size:16px">${fmtDate(p.dl)}</div><div class="s">${active ? (over > 0 ? over + ' Tage überfällig' : 'in ' + (p.dl - S.day) + ' Tagen') : ''}</div></div><div class="kpi"><div class="l">Zufriedenheit</div><div class="v ${sc(p.sat)}" style="font-size:16px">${Math.round(p.sat)}/100</div>${bar(p.sat, sc(p.sat))}</div></div>
    ${inc ? `<div class="card" style="border-color:#6a2d38"><h3 class="bad">Vorfall: ${esc(inc.n)}</h3><p class="sm">${esc(inc.d)}</p><div class="col">${inc.o.map((o, i) => `<button class="btn" style="justify-content:flex-start;white-space:normal;height:auto;padding:8px 12px;text-align:left" data-a="inc" data-o="${i}">${esc(o.t)}${o.h ? ` <span class="mut3 xs">(~${o.h} h)</span>` : ''}</button>`).join('')}</div></div>` : ''}
    ${p.status === 'demo' ? `<div class="card"><h3>Abnahme-Demo bereit</h3><p class="sm mut">Zeige reale Beispieldaten und Fehlerfälle. Dauer ca. 1,5 h.</p><button class="btn p" data-a="demo">${ic('play', 14)} Demo durchführen</button></div>` : ''}
    ${p.status === 'live' && !p.mt && !p.churn && !p.gig ? `<div class="card"><h3>Wartungsvertrag anbieten</h3><div class="row"><input id="mf" type="number" value="240" style="width:120px"> <span class="mut sm">€ / Monat</span><button class="btn p s" data-a="maint">Anbieten</button></div><p class="xs mut3">Betriebskosten dieses Projekts: ca. ${eur(sum(p.comps, k => COMP[k].c))}/Monat.</p></div>` : ''}
    <div class="tabs" style="padding:0">${[['tasks', 'Aufgaben'], ['arch', 'Architektur'], ['bill', 'Rechnungen'], ['risk', 'Risiken'], ['fb', 'Verlauf & Feedback']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-t="${k}">${n}</button>`).join('')}</div>
    ${tab === 'tasks' ? `<div class="row"><span class="mut sm">Gesamtfortschritt (Selbsteinschätzung)</span><span class="sp"></span><b>${pct(p)} %</b></div>${bar(pct(p))}<table class="tbl"><thead><tr><th>Aufgabe</th><th>Plan</th><th>Gearbeitet</th><th></th></tr></thead><tbody>${p.tasks.map(t => { const why = canWork(p, t); return `<tr><td class="sm"><b>${esc(t.n)}</b>${why && t.st !== 'done' ? `<div class="xs mut3">${esc(why)}</div>` : ''}</td><td class="sm">${t.h} h</td><td class="sm">${t.w} h${t.st !== 'done' ? '' : ''}<div style="width:70px">${bar(t.st === 'done' ? 100 : Math.min(95, t.w / t.real * 100), t.st === 'done' ? 'ok' : t.w > t.h ? 'warn' : '')}</div></td><td class="r" style="white-space:nowrap">${t.st === 'done' ? '<span class="tag ok">fertig</span>' : why ? '' : `<button class="btn s" data-a="work" data-t="${t.id}" data-h="2">2 h</button> <button class="btn s" data-a="work" data-t="${t.id}" data-h="4">4 h</button> <button class="btn s p" data-a="work" data-t="${t.id}" data-h="rest">Rest (${Math.max(0, S.hours).toFixed(1).replace('.', ',')} h)</button>`}</td></tr>`; }).join('')}</tbody></table><p class="xs mut3">Der tatsächliche Aufwand kann von der Planung abweichen – deine Erfahrung in den jeweiligen Fähigkeiten beeinflusst ihn. Gearbeitet: ${p.hrs.toFixed(1)} h.</p>` : ''}
    ${tab === 'arch' ? `<div class="card">${p.gig ? '<p class="mut sm">Kleinauftrag ohne Architektur.</p>' : archDiagram(p.comps)}</div>${p.comps.length ? `<table class="tbl"><tbody>${p.comps.map(k => `<tr><td class="sm">${esc(COMP[k].n)}</td><td class="sm mut">${COMP[k].c} €/Mo</td></tr>`).join('')}</tbody></table>` : ''}` : ''}
    ${tab === 'bill' ? `<table class="tbl"><tbody>${p.bill.map(b => `<tr><td class="sm">${esc(b.label)}</td><td class="sm">${eur(b.amt)}</td><td class="r">${b.sent ? '<span class="tag ok">gestellt</span>' : b.ready ? `<button class="btn s p" data-a="bill" data-b="${b.id}">Rechnung stellen</button>` : '<span class="tag">noch nicht fällig</span>'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${tab === 'risk' ? `${p.risks.map(r => `<div class="card sm" style="margin-bottom:8px"><span class="tag ${r.l >= 3 ? 'bad' : 'warn'}">Risiko</span> ${esc(r.t)}</div>`).join('') || '<p class="mut sm">Keine bekannten Risiken – oder noch nicht erkannt.</p>'}<p class="xs mut3">Nicht alle Risiken sind sichtbar. Prüfe Annahmen, Abhängigkeiten und Betriebsaspekte.</p>` : ''}
    ${tab === 'fb' ? `${[...p.ev.map(e => ({ t: e })), ...p.fb.map(f => ({ t: `${f.n}: „${f.o}“`, f: f.f, g: f.good }))].reverse().map(x => `<div class="card sm" style="margin-bottom:8px">${esc(x.t)}${x.f ? `<div class="${x.g ? 'ok' : 'warn'} mt xs" style="margin-top:4px">${esc(x.f)}</div>` : ''}</div>`).join('') || '<p class="mut sm">Noch keine Ereignisse.</p>'}` : ''}</div>`;
  }
  return { render, go(id) { if (id) { sel = id; tab = 'tasks'; } } };
} };
