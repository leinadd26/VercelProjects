// Projektsimulation: Aufgaben, Aufwand, Vorfälle, Abnahme, Go-live, Wartung
import { S, cs, rnd, pick, chance, between, uid, notify, logAct, hist, gain, addRep, addTrust, useHours, lesson, ledger } from './store.js';
import { getCo, wf, addrOf, dm } from './companies.js';
import { CAMP, COMP, INC, ARCH, PERS } from './arch.js';
import { clamp, sum, nextWorkday, fmtDate, eur } from './util.js';
import { queueMail, issueInvoice, checkMiles } from './sim.js';

export const pct = p => { const tt = sum(p.tasks, t => t.h); return Math.min(100, Math.round(100 * sum(p.tasks, t => Math.min(1, t.w / t.real) * t.h) / (tt || 1))); };
export const effort = comps => sum(comps, k => COMP[k].h) + 11;

function mkTask(n, k, h, sk, extra = 1) {
  const skl = sum(sk.length ? sk : ['Python'], s => S.skills[s] || 10) / Math.max(1, sk.length);
  const real = Math.max(1, Math.round(h * between(.85, 1.45) * (1.28 - skl / 200) * extra * 2) / 2);
  return { id: uid('k'), n, k, h, real, w: 0, st: 'todo', sk };
}
export function createProject(co, prop, o = {}) {
  const w = wf(co), c = cs(co.id), camp = CAMP[co.camp], comps = prop.comps || [];
  const tasks = [];
  if (o.gig) { tasks.push(mkTask(o.title, 'gig', Math.round(o.h * .7), ['Python'])); tasks.push(mkTask('Test & Übergabe', 'gigt', Math.round(o.h * .3), ['Debugging'])); }
  else {
    tasks.push(mkTask('Anforderungen & Architektur abstimmen', 'req', 4, ['Workflow-Architektur', 'Prozessanalyse']));
    comps.forEach(k => tasks.push(mkTask(COMP[k].n.split(' (')[0], k, COMP[k].h, COMP[k].sk, k === 'rpa' ? 1.2 : 1)));
    tasks.push(mkTask('Integrationstest', 'test', 3, ['Debugging']));
    tasks.push(mkTask('Deployment & Dokumentation', 'dep', 4, ['Deployment']));
  }
  const weeks = prop.weeks || 3, price = Math.round(prop.price), depPct = (prop.terms ?? 30) / 100;
  const p = { id: uid('p'), co: co.id, name: o.title || (prop.pilot ? 'Pilot: ' : '') + ARCH[co.a].n, arch: co.a, price, mt: prop.mt || 0, pilot: prop.pilot ? 1 : 0, comps, tasks, status: o.gig ? 'build' : 'kickoff', sd: S.day, dl: S.day + weeks * 7, sat: 72, q: 60, pend: [], inc: {}, fb: [], extraCost: 0, rc: 0, gig: o.gig ? 1 : 0, hrs: 0, bill: [], ev: [],
    apiWrong: comps.includes('rest') && w.api !== 'rest', licMissing: comps.includes('rest') && w.api === 'rest' && w.lic, risks: [] };
  if (depPct > 0 && !o.gig) p.bill.push({ id: uid('b'), label: `Anzahlung ${Math.round(depPct * 100)} %`, amt: Math.round(price * depPct), ready: 1, sent: 0 });
  p.bill.push({ id: uid('b'), label: o.gig ? 'Rechnung' : (depPct > 0 ? 'Schlussrechnung' : 'Rechnung'), amt: price - (p.bill[0]?.amt || 0), ready: 0, sent: 0, fin: 1 });
  const k = c.known.api; if (comps.includes('rest') && !(k && k.src && !k.stale && k.v === 'rest' && k.src !== 'doku')) p.risks.push({ t: 'Verfügbarkeit der API im Zielsystem nicht abschließend verifiziert (Annahme).', l: 2 });
  if (comps.includes('rpa')) p.risks.push({ t: 'UI-Automatisierung ist fragil bei Updates des Zielsystems.', l: 2 });
  if (!comps.includes('sec') && !o.gig) p.risks.push({ t: 'Kein Security-Paket eingeplant (Secrets, Rollen, Mandantentrennung).', l: 2 });
  if (camp.freeze && p.dl >= camp.freeze[0] && p.dl < camp.freeze[1]) p.risks.push({ t: 'Go-live fällt in den Code-Freeze der Hochsaison.', l: 3 });
  if (price < effort(comps) * S.me.rate * .8 && !o.gig) p.risks.push({ t: 'Festpreis liegt unter deinem Stundensatz × Aufwand – wenig Puffer.', l: 2 });
  S.projects.push(p); c.status = 'won'; c.price = price; setSt(co.id, 'gewonnen'); hist(co.id, `Vertrag unterzeichnet: ${eur(price)}`);
  logAct(`Neues Projekt: ${p.name} (${co.n}, ${eur(price)})`, co.id); gain('Projektmanagement', 1);
  const ct = dm(co);
  queueMail(1, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: `Kick-off: ${p.name}`, body: `Guten Tag,\n\nschön, dass wir starten. Wir erwarten die Fertigstellung bis ${fmtDate(p.dl)}. ${o.gig ? '' : 'Bitte beginnen Sie mit der Abstimmung der Anforderungen; Testzugänge liefern wir, sobald wir Ihre Liste haben.'}\n\n${ct.name}`, co: co.id, ct: ct.i });
  return p;
}
function setSt(id, st) { const c = cs(id); c.stage = st; c.lead = 1; }

export function canWork(p, t) {
  if (t.st === 'done') return 'erledigt';
  if (['cancelled', 'live', 'done'].includes(p.status)) return 'Projekt abgeschlossen';
  if (p.blocked > 0 && !['req', 'gig'].includes(t.k)) return `Blockiert (Kunde liefert nicht) noch ${p.blocked} Tage`;
  if (t.k === 'test' && p.tasks.some(x => !['test', 'dep'].includes(x.k) && x.st !== 'done')) return 'Erst alle Bausteine fertigstellen';
  if (t.k === 'dep') { if (!p.appr) return 'Erst Abnahme-Demo bestehen'; const fz = CAMP[getCo(p.co).camp].freeze; if (fz && S.day >= fz[0] && S.day < fz[1]) return `Code-Freeze des Kunden bis ${fmtDate(fz[1])}`; }
  if (!['req', 'gig'].includes(t.k) && p.tasks.find(x => x.k === 'req')?.st !== 'done') return 'Erst Anforderungen abstimmen';
  if (p.pend.length) return 'Erst offenen Vorfall klären';
  return '';
}
export function workTask(pid, tid, h) {
  const p = S.projects.find(x => x.id === pid), t = p.tasks.find(x => x.id === tid), why = canWork(p, t); if (why) return { err: why };
  const amt = Math.min(h, Math.max(0, S.hours), t.real - t.w + .0001); if (amt <= 0) return { err: S.hours <= 0 ? 'Keine Stunden mehr heute – Tag beenden oder Überstunden vermeiden.' : 'Nichts mehr zu tun.' };
  t.w = Math.round((t.w + amt) * 10) / 10; useHours(amt); p.hrs += amt; t.sk.forEach(s => gain(s, amt * .1)); gain('Projektmanagement', amt * .03);
  let done = false;
  if (t.w >= t.real - .01) { t.st = 'done'; done = true; onTaskDone(p, t); }
  return { done, amt };
}
function onTaskDone(p, t) {
  if (t.k === 'req') { p.status = 'build'; p.ev.push('Anforderungen abgestimmt'); }
  if (t.k === 'gigt') finish(p);
  const k = COMP[t.k];
  if (k) {
    if (t.k === 'rest' && p.apiWrong && !p.inc.api_missing) return pend(p, 'api_missing');
    if (t.k === 'rest' && p.licMissing && !p.inc.api_missing) return pend(p, 'api_missing');
    const pool = k.inc.filter(i => !p.inc[i]); if (pool.length && chance(.55 - S.skills[k.sk[0]] / 400)) pend(p, pick(pool));
  }
  if (t.k === 'test') {
    if (!p.comps.includes('sec') && !p.inc.security_review && chance(.5)) pend(p, 'security_review');
    p.status = 'demo'; notify(`${getCo(p.co).n}: Bereit für die Abnahme-Demo.`, 'projects', 'good');
  }
  if (t.k === 'dep') goLive(p);
  if (!p.gig) {
    const left = p.tasks.filter(x => x.st !== 'done').length; if (!left && p.status !== 'live') { /* Reihenfolge erzwingt Abnahme vorher */ }
  }
}
function pend(p, id) { if (p.inc[id]) return; p.pend.push(id); p.inc[id] = 1; notify(`Vorfall im Projekt ${getCo(p.co).n}: ${INC[id].n}`, 'projects', 'warn'); }
export function raise(pid, id) { const p = S.projects.find(x => x.id === pid); if (p && !p.inc[id] && !p.pend.length) pend(p, id); }
export function resolveInc(pid, oi) {
  const p = S.projects.find(x => x.id === pid), id = p.pend[0], inc = INC[id], o = inc.o[oi]; if (!o) return null;
  p.pend.shift(); if (o.h) useHours(o.h);
  if (o.e > 0) ledger('exp', 'Projektkosten', o.e, `${inc.n} (${getCo(p.co).n})`, p.co);
  if (o.e < 0) p.bill.push({ id: uid('b'), label: `Change Request: ${inc.n.slice(0, 30)}`, amt: -o.e, ready: 1, sent: 0 });
  if (o.q) p.q = clamp(p.q + o.q, 0, 100); if (o.s) p.sat = clamp(p.sat + o.s, 0, 100); if (o.r) addRep(o.r); if (o.x) gain(o.x[0], o.x[1]); if (o.d) p.blocked = o.d;
  p.fb.push({ d: S.day, n: inc.n, o: o.t, f: o.f, good: (o.q || 0) >= 4 || (o.s || 0) > 0 || o.r > 0 }); if (!(o.q >= 4) && o.q < 0) lesson(`${inc.n}: „${o.t}“ – ${o.f}`);
  hist(p.co, `Vorfall gelöst: ${inc.n}`); return { f: o.f, good: (o.q || 0) >= 4 || (o.r || 0) > 0 };
}
export function holdDemo(pid) {
  const p = S.projects.find(x => x.id === pid); if (p.status !== 'demo') return { err: 'Keine Demo möglich' }; useHours(1.5);
  const ok = chance(clamp(.3 + p.q / 120 + (p.sat - 50) / 200 + p.rc * .15, .1, .95)) || p.rc >= 2;
  if (ok) { p.appr = 1; p.status = 'deploy'; p.sat = clamp(p.sat + 4, 0, 100); p.bill.find(b => b.fin).ready = 1; p.ev.push('Abnahme erteilt'); gain('Kommunikation', .8); gain('Projektmanagement', .8);
    notify(`${getCo(p.co).n}: Abnahme erteilt – Schlussrechnung kann gestellt werden.`, 'projects', 'good'); return { ok, f: 'Abnahme erteilt. Gute Demo: Sie zeigte reale Beispieldaten und Fehlerfälle, nicht nur den Idealpfad.' }; }
  p.rc++; p.sat = clamp(p.sat - 3, 0, 100); p.status = 'build'; const t = mkTask(`Nacharbeiten nach Demo (${p.rc})`, 'fix', 4, ['Debugging']); p.tasks.splice(p.tasks.findIndex(x => x.k === 'test'), 0, t); p.tasks.find(x => x.k === 'test').st = 'todo'; p.tasks.find(x => x.k === 'test').w = 0;
  return { ok, f: 'Der Kunde hat Änderungswünsche. In der Praxis: Demo mit echten Randfällen vorbereiten und Erwartungen vorab klären.' };
}
function goLive(p) {
  p.status = 'live'; p.live = S.day; const co = getCo(p.co), c = cs(p.co), ct = dm(co); c.sat = p.sat;
  const late = Math.max(0, S.day - p.dl); if (late) { p.sat = clamp(p.sat - Math.min(25, late * 1.5), 0, 100); lesson(`${co.n}: ${late} Tage zu spät geliefert – Puffer einplanen und früh informieren.`); }
  const r = clamp(Math.round(3 + (p.q - 55) / 12 + (p.sat - 60) / 14), -2, 10); addRep(r); c.sat = p.sat;
  if (p.gig) { p.status = 'done'; p.bill[0].ready = 1; return; }
  p.bill.find(b => b.fin).ready = 1;
  notify(`${co.n}: Go-live! Reputation ${r >= 0 ? '+' : ''}${r}.`, 'projects', 'good'); logAct(`Go-live: ${p.name} bei ${co.n}`, p.co);
  queueMail(1, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: p.sat >= 70 ? 'Danke – läuft!' : 'Rückmeldung zum Go-live', body: p.sat >= 70 ? `Guten Tag,\n\nes läuft. Die Kolleg:innen sind positiv überrascht. Wir sprechen gern über einen Wartungsvertrag${p.pilot ? ' und die Ausweitung nach dem Pilot' : ''}.\n\n${ct.name}` : `Guten Tag,\n\ndas System läuft, aber der Weg dahin war holprig (Termine, Rückmeldungen). Bitte bleiben Sie bei Rückfragen erreichbar.\n\n${ct.name}`, co: p.co, ct: ct.i });
  if (p.pilot && p.sat >= 72) { c.trust = clamp(c.trust + 15, 0, 100); c.upsell = 1; c.int = 60; notify(`${co.n} hat Interesse an der Vollversion – erstelle ein Angebot.`, 'crm', 'good'); }
  if (p.sat >= 75 && chance(.45)) { S.mil.ref ||= 0; }
  lesson(`Projekt ${co.n}: Qualität ${p.q}/100, Zufriedenheit ${Math.round(p.sat)}/100 – ${p.sat >= 70 ? 'Empfehlungen werden wahrscheinlicher.' : 'Kundenvertrauen wiederherstellen.'}`);
  checkMiles();
}
function finish(p) { goLive(p); }
export function offerMaint(pid, fee) {
  const p = S.projects.find(x => x.id === pid), co = getCo(p.co), w = wf(co), ok = p.sat >= 60 && fee <= Math.max(150, w.net * .35) * (p.sat >= 80 ? 1.3 : 1) * PERS[dm(co).p].price;
  if (ok) { p.mt = fee; notify(`${co.n} unterschreibt den Wartungsvertrag (${eur(fee)}/Monat).`, 'projects', 'good'); checkMiles(); return { ok, f: 'Wartungsvertrag vereinbart – wiederkehrender Umsatz stabilisiert dein Geschäft. Achte darauf, dass die Gebühr Hosting und Support deckt.' }; }
  return { ok, f: p.sat < 60 ? 'Der Kunde ist nicht zufrieden genug für eine Bindung.' : 'Die Gebühr steht für den Kunden nicht im Verhältnis zum Nutzen.' };
}
export function onPaid(p, inv) { hist(p.co, `Zahlung ${inv.no} eingegangen`); }
export function liveOutage(p) {
  if (p.pend.length) return; const mon = p.comps.includes('mon');
  if (!mon && chance(.4)) p.sat = clamp(p.sat - 3, 0, 100); pend(p, 'outage'); p.inc.outage = 0;
  const co = getCo(p.co), ct = dm(co); queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: mon ? 'Alarm: Verarbeitung gestoppt' : 'DRINGEND: System läuft nicht!', body: mon ? 'Ihr Monitoring hat einen Fehler gemeldet. Bitte prüfen.' : `Seit heute Morgen verarbeitet das System nichts mehr. Wir merken es erst jetzt, weil sich Kunden beschweren.\n\n${ct.name}`, co: p.co, ct: ct.i });
}
export function daily() {
  for (const p of S.projects) {
    if (['live', 'done', 'cancelled'].includes(p.status)) { if (p.status === 'live' && !p.churn) p.sat = clamp(p.sat + (p.q >= 70 ? .08 : -.12), 0, 100); if (p.pend.length) p.sat = clamp(p.sat - 2, 0, 100); continue; }
    const camp = CAMP[getCo(p.co).camp], over = S.day - p.dl;
    if (p.blocked > 0) p.blocked--;
    if (over > 0) { p.sat = clamp(p.sat - (over <= 3 ? .8 : 1.6) * camp.late, 0, 100); if (over === 3 || over === 10) { const co = getCo(p.co), ct = dm(co); queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: `Wo bleibt ${p.name}?`, body: `Guten Tag,\n\nder vereinbarte Termin (${fmtDate(p.dl)}) ist verstrichen und wir haben keinen aktuellen Stand. Bitte melden Sie sich mit einem verbindlichen Zeitplan.\n\n${ct.name}`, co: p.co, ct: ct.i, kind: 'complaint', pid: p.id }); notify(`${co.n} beschwert sich über die Verzögerung.`, 'mail', 'bad'); addRep(-1); } }
    if (p.pend.length) p.sat = clamp(p.sat - 1, 0, 100);
    if (!p.gig && p.status === 'build' && !p.pend.length && p.rc < 1) {
      const r = rnd(); if (r < .035 && !p.inc.scope_creep) pend(p, 'scope_creep'); else if (r < .06 && !p.inc.cust_delay) pend(p, 'cust_delay'); else if (r < .075 && !p.inc.changing_req && pct(p) > 60) pend(p, 'changing_req');
    }
    cs(p.co).sat = p.sat;
  }
}
