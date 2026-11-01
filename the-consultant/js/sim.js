// Simulationskern: Tagesablauf, Warteschlange, E-Mail-Zustellung, Termine, Rechnungen, Ereignisse, Meilensteine
import { S, cs, rnd, pick, chance, between, uid, notify, logAct, hist, ledger, gain, addRep, addTrust, useHours, emit, lesson } from './store.js';
import { allCo, getCo, wf, genCompany, addrOf, sal, dm, STATIC } from './companies.js';
import { CAMP, ARCH, PERS, COMP, MILES, SKILLS, INC } from './arch.js';
import { isWeekend, nextWorkday, clamp, sum, fmtDate, eur, wd } from './util.js';
import * as P from './proj.js';

export const STAGES = ['neu', 'recherche', 'kontaktiert', 'interessiert', 'discovery', 'angebot', 'verhandlung', 'gewonnen', 'verloren', 'ruhend'];
export const STAGE_N = { neu: 'Entdeckt', recherche: 'Recherche', kontaktiert: 'Kontaktiert', interessiert: 'Interessiert', discovery: 'Discovery', angebot: 'Angebot', verhandlung: 'Verhandlung', gewonnen: 'Gewonnen', verloren: 'Verloren', ruhend: 'Ruhend' };
const SO = Object.fromEntries(STAGES.map((s, i) => [s, i]));
export function setStage(id, st, force) {
  const c = cs(id); if (!force && SO[st] <= SO[c.stage] && !['verloren', 'ruhend'].includes(st)) return;
  c.stage = st; c.lead = 1; hist(id, `Phase: ${STAGE_N[st]}`);
}
export function makeLead(id) { const c = cs(id); if (!c.lead) { c.lead = 1; c.seen = 1; if (c.stage === 'neu') c.stage = 'recherche'; logAct(`Lead angelegt: ${getCo(id).n}`, id); } }
export function seen(id) { const c = cs(id); if (!c.seen) { c.seen = 1; } }

// Einschätzung (für den Spieler sichtbar): aus beobachtbaren Größen, keine Garantie
export function calcProb(id) {
  const c = cs(id), base = { neu: 2, recherche: 4, kontaktiert: 8, interessiert: 18, discovery: 30, angebot: 45, verhandlung: 62, gewonnen: 100, verloren: 0, ruhend: 3 }[c.stage];
  if (c.stage === 'gewonnen' || c.stage === 'verloren') return base;
  return clamp(Math.round(base + (c.trust - 50) / 6 + c.int / 12 - (Object.keys(c.known).length < 4 && SO[c.stage] >= 4 ? 8 : 0)), 1, 95);
}

// ---------- Warteschlange & E-Mail ----------
export const qAdd = (d, t, x) => { S.q.push({ d, t, ...x }); };
export function queueMail(delay, m) { qAdd(nextWorkday(S.day + Math.max(0, delay)), 'mail', { m }); }
export function deliver(m) {
  m.id = uid('m'); m.n = S.uid; m.d = S.day; m.f = 'in'; m.rd = 0; m.th = m.th || uid('t'); m.att = m.att || []; m.act = m.act || [];
  S.emails.push(m); notify(`E-Mail von ${m.fn}: ${m.subj}`, 'mail', 'mail'); return m;
}
export function sendMail(o) { // o: {co, ct, to, subj, body, att, th, replyTo, kind}
  const m = { id: uid('m'), n: S.uid, th: o.th || uid('t'), fn: S.me.name, from: `${S.me.name.split(' ')[0].toLowerCase()}@${slug(S.me.co.name)}.example`, to: o.to, subj: o.subj, body: o.body, d: S.day, f: 'sent', rd: 1, co: o.co, ct: o.ct, att: o.att || [], act: [], kind: o.kind || 'out' };
  S.emails.push(m); useHours(.25);
  if (o.co) { const c = cs(o.co); m.pm = c.mail; m.pd = c.lastMail; c.mail++; c.lastMail = S.day; c.lastContact = S.day; makeLead(o.co); hist(o.co, `E-Mail gesendet: ${o.subj}`); }
  logAct(`E-Mail gesendet: ${o.subj}`, o.co); return m;
}
export const slug = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Kontakt als bekannt markieren
export function knowContact(id, i) { const c = cs(id); if (!c.knownC.includes(i)) { c.knownC.push(i); hist(id, `Ansprechperson bekannt: ${getCo(id).cn[i].name}`); } }
export function visitPage(id, page) {
  const co = getCo(id), c = cs(id); c.seen = 1; const first = !c.visited[page]; c.visited[page] = 1;
  const vis = { about: ['s'], contact: ['s'], impressum: ['s'], careers: ['j'], news: ['n'], home: [] }[page] || [];
  co.cn.forEach(ct => { if (vis.includes(ct.vis)) knowContact(id, ct.i); });
  if (first && page === 'home') { /* erste Sichtung */ }
  return first;
}

// ---------- Termine ----------
export function slotsFor(co, ct) {
  const out = [], r = PERS[ct.p]; let d = nextWorkday(S.day + 1), n = 0;
  while (out.length < 14 && n++ < 30) { if (!isWeekend(d)) for (const h of [9, 11, 14, 16]) { if (rnd() > (r.ghost + .25) && !S.meetings.some(m => m.d === d && m.h === h && !m.done)) out.push({ d, h }); } d++; }
  return out;
}
export function bookMeeting(o) { // {co, ct, d, h, type, dur}
  const co = getCo(o.co), ct = co.cn[o.ct], dur = o.dur || Math.max(20, Math.round(45 * PERS[ct.p].time / 5) * 5);
  if (S.meetings.some(m => m.d === o.d && m.h === o.h && !m.done)) return null;
  const m = { id: uid('c'), co: o.co, ct: o.ct, d: o.d, h: o.h, dur, type: o.type || 'discovery', done: 0, title: o.title };
  S.meetings.push(m); hist(o.co, `Termin vereinbart: ${fmtDate(o.d)} ${o.h}:00`); knowContact(o.co, o.ct);
  queueMail(1, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: `Termin ${fmtDate(o.d)}, ${o.h}:00 Uhr bestätigt`, body: `${PERS[ct.p].pre[0]} ${greet(ct)},\n\nich habe den Termin am ${fmtDate(o.d, { weekday: 'long', day: 'numeric', month: 'long' })} um ${o.h}:00 Uhr (ca. ${dur} Minuten) in meinem Kalender eingetragen.\n\nBis dahin!\n${ct.name}`, co: o.co, ct: o.ct });
  return m;
}
const greet = ct => `Guten Tag${S.me.name ? '' : ''}`.trim();
export function missMeeting(m) {
  m.done = 1; m.missed = 1; const co = getCo(m.co), ct = co.cn[m.ct];
  addTrust(m.co, -22); addRep(-3); cs(m.co).int = Math.max(0, cs(m.co).int - 20); hist(m.co, 'Termin verpasst');
  notify(`Termin mit ${co.n} verpasst – Vertrauen und Reputation sinken.`, 'calendar', 'bad');
  queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: 'Wir hatten einen Termin…', body: `Guten Tag,\n\nwir hatten heute einen Termin vereinbart, es hat sich aber leider niemand gemeldet. Das ist nicht der Eindruck, den ich mir erhofft hatte.\n\n${ct.name}`, co: m.co, ct: m.ct });
  lesson(`Termin mit ${co.n} verpasst: Verlässlichkeit ist im Beratungsgeschäft die Eintrittskarte.`);
}

// ---------- Finanzen ----------
export function nextInvNo() { return `RE-2026-${String(S.inv.length + 1).padStart(3, '0')}`; }
export function issueInvoice(pid, bi) {
  const p = S.projects.find(x => x.id === pid), b = p.bill.find(x => x.id === bi); if (!b || b.sent || !b.ready) return null;
  const co = getCo(p.co), camp = CAMP[co.camp], pers = PERS[dm(co).p];
  const inv = { id: uid('i'), no: nextInvNo(), co: p.co, pid, label: b.label, amt: b.amt, d: S.day, due: S.day + camp.pay, paid: null, rem: 0, rec: b.rec || 0 };
  const lag = Math.round(camp.lag * between(.2, 1.4) + (p.sat < 50 ? 8 : 0) + (pers.delay > 2 ? 3 : 0) + (chance(.1) ? 12 : 0));
  inv.pd = nextWorkday(inv.due + lag - (camp.lag > 6 ? 0 : 2)); b.sent = 1; b.inv = inv.id; S.inv.push(inv); qAdd(inv.pd, 'pay', { id: inv.id });
  hist(p.co, `Rechnung ${inv.no}: ${eur(inv.amt)}`); logAct(`Rechnung ${inv.no} gestellt (${eur(inv.amt)})`, p.co); return inv;
}
export function remind(id) {
  const inv = S.inv.find(x => x.id === id); if (!inv || inv.paid || S.day <= inv.due) return false;
  inv.rem++; addTrust(inv.co, -3); const q = S.q.find(x => x.t === 'pay' && x.id === id); if (q) q.d = Math.min(q.d, nextWorkday(S.day + 2 + inv.rem * 2)); hist(inv.co, `Zahlungserinnerung zu ${inv.no}`); return true;
}
function payInv(id) {
  const inv = S.inv.find(x => x.id === id); if (!inv || inv.paid) return; inv.paid = S.day; ledger('rev', inv.rec ? 'Wartung' : 'Projekt', inv.amt, `${inv.no} ${getCo(inv.co).n}`, inv.co);
  notify(`Zahlungseingang ${eur(inv.amt)} von ${getCo(inv.co).n}`, 'finance', 'good');
  const p = S.projects.find(x => x.id === inv.pid); if (p) P.onPaid(p, inv);
}
export function stats() {
  const from = S.day - 30, led = S.led.filter(l => l.d > from), rev = sum(led.filter(l => l.t === 'rev'), l => l.a), exp = sum(led.filter(l => l.t === 'exp'), l => l.a);
  const rec = sum(S.projects.filter(p => p.status === 'live' && p.mt > 0 && !p.churn), p => p.mt);
  return { rev, exp, profit: rev - exp, rec, out: sum(S.inv.filter(i => !i.paid), i => i.amt), allRev: sum(S.led.filter(l => l.t === 'rev'), l => l.a), allExp: sum(S.led.filter(l => l.t === 'exp'), l => l.a) };
}

// ---------- Tagesablauf ----------
export function endDay() {
  S.meetings.filter(m => m.d === S.day && !m.done).forEach(missMeeting);
  if (S.call) S.call = null;
  let guard = 0; do { S.day++; process(); } while (isWeekend(S.day) && guard++ < 4);
  S.hours = 8; hist2(); emit();
}
const hist2 = () => { const l = S.cashH[S.cashH.length - 1]; if (l[0] !== S.day) S.cashH.push([S.day, S.cash]); };
function process() {
  const due = S.q.filter(x => x.d <= S.day); S.q = S.q.filter(x => x.d > S.day);
  for (const x of due) { if (x.t === 'mail') deliver(x.m); else if (x.t === 'pay') payInv(x.id); else if (x.t === 'fn') FN[x.fn] && FN[x.fn](x); }
  P.daily();
  for (const co of allCo()) { const c = S.co[co.id]; if (!c || !c.lead || ['gewonnen', 'verloren', 'ruhend'].includes(c.stage)) continue;
    if (c.fu === S.day) notify(`Follow-up fällig: ${co.n}`, 'crm', 'warn');
    if (S.day - c.lastContact > 28 && c.stage !== 'recherche' && c.stage !== 'neu') { c.stage = 'ruhend'; c.int = 0; hist(co.id, 'Lead ruht (keine Aktivität)'); notify(`${co.n} ist eingeschlafen – zu lange kein Kontakt.`, 'crm'); } }
  if (!isWeekend(S.day)) rollEvent();
  if (S.day % 30 === 0) monthly();
  checkMiles();
  if (S.cash < -500 && !S.over) { S.over = true; notify('Zahlungsunfähig – das Unternehmen ist insolvent.', '', 'bad'); }
}
const FN = { sec_info(x) { cs(x.co).known.api = { v: x.api, vague: 0, src: 'IT-Dienstleister', lic: x.lic, d: S.day, txt: x.txt }; } };
function monthly() {
  ledger('exp', 'Software', 39, 'Software-Abos (IDE, Domain, Postfach, Notizen)'); ledger('exp', 'Versicherung', 29, 'Berufshaftpflicht');
  for (const p of S.projects) if (['build', 'demo', 'live'].includes(p.status) && !p.churn) {
    const c = sum(p.comps, k => COMP[k].c) + p.extraCost; if (c > 0) ledger('exp', 'Hosting & APIs', Math.round(c), `Betrieb ${getCo(p.co).n}`, p.co);
    if (p.status === 'live' && p.mt > 0) { const b = { id: uid('b'), label: `Wartung ${fmtDate(S.day, { month: 'long', year: 'numeric' })}`, amt: p.mt, ready: 1, sent: 0, rec: 1 }; p.bill.push(b); issueInvoice(p.id, b.id); }
  }
  notify('Monatsabschluss: laufende Kosten gebucht, Wartungsrechnungen gestellt.', 'finance');
}

// ---------- Ereignisse ----------
const NEWS = {
  log: ['Dieselpreis steigt – Speditionen suchen Effizienz.', 'Fahrermangel verschärft sich weiter.'], ecom: ['Black-Friday-Vorbereitung: Shops frieren Änderungen ein.', 'Retourenquoten im Onlinehandel steigen.'], man: ['Lieferketten angespannt – Betriebe digitalisieren Einkauf.', 'Neue Förderprogramme für Mittelstandsdigitalisierung.'],
  prop: ['Neue Nebenkostenregeln erhöhen den Dokumentationsaufwand.', 'Mieterportale werden Standard.'], rec: ['Fachkräftemangel: Time-to-Hire wird zum Wettbewerbsfaktor.', 'Debatte um KI im Recruiting verschärft die Rechtslage.'], con: ['Baubranche flaut ab – Betriebe sparen.', 'Neue Dokumentationspflichten auf Baustellen.'],
  prof: ['E-Rechnungspflicht erhöht Druck auf Kanzleien.', 'Fachkräftemangel in Steuerkanzleien.'], mob: ['Wintersaison startet früh – Anfragen steigen.', 'Autohäuser kämpfen um Online-Leads.'], trade: ['Preisdruck im Großhandel nimmt zu.', 'EDI wird bei Großkunden Pflicht.'] };
const EV = [
  { w: 3, ok: () => S.gen.length < 14, run() { const c = genCompany(); if (c) notify(`Neu im Verzeichnis: ${c.n} (${c.city})`, 'directory'); } },
  { w: 3, ok: () => true, run() { inbound(); } },
  { w: 2, ok: () => leads().length > 0, run() { const co = pick(leads()), c = cs(co.id), m = c.mod; const nw = pick(['rest', 'csv', 'none'].filter(x => x !== wf(co).api)); m.api = nw; m.lic = 0; if (c.known.api) c.known.api.stale = 1; notify(`${co.n} hat sein Hauptsystem gewechselt (Schnittstellenlage kann sich geändert haben).`, 'crm', 'warn'); hist(co.id, 'Software gewechselt'); } },
  { w: 1.5, ok: () => leads().length > 0, run() { const co = pick(leads()); addTrust(co.id, -8); cs(co.id).mod.dm = 1; notify(`${co.n}: Neue Entscheiderin im Haus – Beziehung muss neu aufgebaut werden.`, 'crm', 'warn'); hist(co.id, 'Neuer Entscheider'); } },
  { w: 2, ok: () => leads().length > 0, run() { const co = pick(leads()), up = chance(.5), m = cs(co.id).mod; m.bud = (m.bud || 1) * (up ? 1.25 : .7); notify(`${co.n}: Budgetlage ${up ? 'hat sich verbessert' : 'hat sich verschlechtert'}.`, 'crm', up ? 'good' : 'warn'); hist(co.id, up ? 'Budget erhöht' : 'Budget gekürzt'); } },
  { w: 2, ok: () => true, run() { const k = pick(Object.keys(CAMP)), t = pick(NEWS[k]); S.camp[k] = { until: S.day + 20, bud: /spar|abflau|Preisdruck/.test(t) ? .85 : 1.12 }; notify(`Branchen-News ${CAMP[k].n}: ${t}`, 'directory'); logAct(`Branchen-News: ${t}`); } },
  { w: 2, ok: () => leads(['angebot', 'verhandlung', 'discovery']).length > 0, run() { const co = pick(leads(['angebot', 'verhandlung', 'discovery'])), ct = dm(co); cs(co.id).int = Math.max(0, cs(co.id).int - 15); queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: 'Anderes Angebot eingegangen', body: `Guten Tag,\n\nes hat sich ein Anbieter bei uns gemeldet, der uns eine fertige „KI-Plattform“ für ${co.i.toLowerCase()} angeboten hat – deutlich günstiger. Was unterscheidet Ihren Ansatz davon?\n\n${ct.name}`, co: co.id, ct: ct.i, ask: 'what', kind: 'ask' }); hist(co.id, 'Wettbewerber meldet sich'); } },
  { w: 2.5, ok: () => S.projects.some(p => p.status === 'live' && p.sat >= 70) && STATIC.some(c => c.lock === 'ref' && !cs(c.id).seen), run() { const from = pick(S.projects.filter(p => p.status === 'live' && p.sat >= 70)), tgt = pick(STATIC.filter(c => c.lock === 'ref' && !cs(c.id).seen)), src = getCo(from.co), ct = dm(src); cs(tgt.id).seen = 1; cs(tgt.id).trust = 62; makeLead(tgt.id); addRep(2); S.mil.ref ||= S.day; queueMail(0, { fn: ct.name, from: addrOf(src, ct), to: 'ich', subj: `Empfehlung: ${tgt.n}`, body: `Guten Tag,\n\nich habe mit ${dm(tgt).name} von ${tgt.n} gesprochen und Sie empfohlen – dort gibt es ähnliche Themen. Sie werden sich sicher bald melden.\n\n${ct.name}`, co: from.co, ct: ct.i }); notify(`Weiterempfehlung: ${tgt.n} ist jetzt im Verzeichnis.`, 'directory', 'good'); } },
  { w: 1.5, ok: () => S.projects.some(p => p.status === 'live' && !p.churn), run() { P.liveOutage(pick(S.projects.filter(p => p.status === 'live' && !p.churn))); } },
  { w: 1, ok: () => S.projects.some(p => p.status === 'live' && p.sat < 40 && !p.churn), run() { const p = pick(S.projects.filter(p => p.status === 'live' && p.sat < 40 && !p.churn)); p.churn = 1; addRep(-3); notify(`${getCo(p.co).n} kündigt den Wartungsvertrag – unzufrieden.`, 'projects', 'bad'); lesson(`${getCo(p.co).n} ist gegangen: Schlechte Qualität und unbeantwortete Probleme kosten wiederkehrende Umsätze.`); } },
];
const leads = st => allCo().filter(c => { const k = S.co[c.id]; return k && k.lead && !['gewonnen', 'verloren', 'ruhend'].includes(k.stage) && (!st || st.includes(k.stage)); });
function rollEvent() {
  const lowCash = S.cash < 700 && !S.projects.some(p => ['kickoff', 'build', 'demo'].includes(p.status)) && !S.inv.some(i => !i.paid);
  if (lowCash && chance(.35)) return inbound(true);
  if (!chance(.38)) return;
  const el = EV.filter(e => e.ok()), tot = sum(el, e => e.w); let r = rnd() * tot;
  for (const e of el) { if ((r -= e.w) <= 0) return e.run(); }
}
export function campMod(k) { const m = S.camp[k]; return m && m.until > S.day ? m.bud : 1; }
const GIGS = [
  ['Kleiner Datenabgleich', 'Wir müssen jede Woche zwei Excel-Listen zusammenführen. Können Sie dafür ein kleines Skript bauen?', 'rules sched', 420, 9], ['Automatischer Mail-Export', 'Wir brauchen einen täglichen Export unserer Bestell-Mails als CSV für die Buchhaltung.', 'mail csv', 780, 14], ['Prozess-Check', 'Können Sie sich einmal anschauen, wo bei uns Zeit verloren geht? Ein kleiner Überblick genügt.', 'rules', 500, 8]];
function inbound(rescue) {
  const hotel = STATIC.find(c => c.lock === 'inbound' && !cs(c.id).seen), cands = allCo().filter(c => !c.lock || cs(c.id).seen);
  if (hotel && S.day > 6 && chance(.6)) { const co = hotel, ct = co.cn[0]; cs(co.id).seen = 1; makeLead(co.id); cs(co.id).int = 25; queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: 'Anfrage: Unterstützung bei Gruppenanfragen', body: `Guten Tag,\n\nein Bekannter hat mir von Ihrer Beratung erzählt. Bei uns stapeln sich Gruppen- und Zimmeranfragen im Postfach. Könnten wir uns einmal unterhalten?\n\n${ct.name}, ${ct.role}`, co: co.id, ct: 0, act: [{ t: 'Discovery-Call vereinbaren', a: 'book' }], kind: 'interest' }); notify(`Inbound-Anfrage von ${co.n}!`, 'mail', 'good'); return; }
  const co = pick(cands), ct = co.cn[0], bad = !rescue && chance(.35);
  if (bad) queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: 'KI für alles – dringend, Budget 300 €', body: `Hallo,\n\nwir wollen unser ganzes Unternehmen mit KI automatisieren und ein Chatbot soll alles beantworten. Budget haben wir 300 €, bis nächste Woche. Geht das?\n\n${ct.name}`, co: co.id, ct: 0, act: [{ t: 'Höflich absagen', a: 'gigno' }, { t: 'Trotzdem annehmen (300 €)', a: 'gigbad', pay: 300, h: 30 }], kind: 'gig' });
  else { const g = pick(GIGS); queueMail(0, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: `Kleinauftrag: ${g[0]}`, body: `Guten Tag,\n\n${g[1]}\n\nBudget: ${eur(g[3])} netto, Dauer ca. ${g[4]} Stunden.\n\n${ct.name}`, co: co.id, ct: 0, act: [{ t: `Auftrag annehmen (${eur(g[3])})`, a: 'gigyes', pay: g[3], h: g[4], comps: g[2], title: g[0] }, { t: 'Ablehnen', a: 'gigno' }], kind: 'gig' }); }
  notify(rescue ? 'Eine Anfrage ist eingegangen.' : 'Neue Anfrage im Postfach.', 'mail');
}

// ---------- Meilensteine ----------
export function checkMiles() {
  const st = stats(), M = S.mil, set = (k, c) => { if (c && !M[k]) { M[k] = S.day; const m = MILES.find(x => x[0] === k); notify(`Meilenstein: ${m[1]}`, 'profile', 'good'); logAct(`Meilenstein erreicht: ${m[1]}`); } };
  set('lead', allCo().some(c => ['interessiert', 'discovery', 'angebot', 'verhandlung', 'gewonnen'].includes(S.co[c.id]?.stage)));
  set('call', S.meetings.some(m => m.done && !m.missed && m.type === 'discovery'));
  set('pilot', S.projects.length > 0); set('impl', S.projects.some(p => ['live', 'done'].includes(p.status)));
  set('recur', S.projects.some(p => p.status === 'live' && p.mt > 0 && !p.churn));
  set('m1k', st.rev >= 1000); set('m5k', st.rev >= 5000);
  set('spec', Object.values(S.skills).some(v => v >= 60));
  set('est', S.projects.filter(p => ['live', 'done'].includes(p.status)).length >= 3 && S.rep >= 60);
  const n = Object.keys(M).length; S.me.exp = n >= 9 ? 'Etablierte Beratung' : n >= 7 ? 'Spezialist:in' : n >= 4 ? 'Berater:in' : n >= 2 ? 'Junior-Berater:in' : 'Einsteiger';
}
export function openTasks() {
  const t = [];
  S.projects.filter(p => p.pend.length).forEach(p => t.push({ t: `Vorfall im Projekt ${getCo(p.co).n}: ${INC[p.pend[0]].n}`, app: 'projects', id: p.id }));
  S.emails.filter(m => m.f === 'in' && !m.rd).slice(-5).forEach(m => t.push({ t: `Ungelesen: ${m.subj}`, app: 'mail', id: m.id }));
  S.meetings.filter(m => !m.done && m.d <= S.day + 1).forEach(m => t.push({ t: `${m.d === S.day ? 'Heute' : m.d < S.day ? 'Überfällig' : 'Morgen'}: Termin mit ${getCo(m.co).n}`, app: 'calendar', id: m.id }));
  for (const p of S.projects.filter(p => ['kickoff', 'build', 'demo'].includes(p.status))) { t.push({ t: `Projekt ${getCo(p.co).n}: ${P.pct(p)} % – Frist ${fmtDate(p.dl)}`, app: 'projects', id: p.id }); p.bill.filter(b => b.ready && !b.sent).forEach(b => t.push({ t: `Rechnung stellen: ${b.label} (${eur(b.amt)})`, app: 'finance', id: p.id })); }
  S.projects.filter(p => p.status === 'live').forEach(p => p.bill.filter(b => b.ready && !b.sent).forEach(b => t.push({ t: `Rechnung stellen: ${b.label} (${eur(b.amt)})`, app: 'finance', id: p.id })));
  S.inv.filter(i => !i.paid && i.due < S.day).forEach(i => t.push({ t: `Überfällig: ${i.no} (${eur(i.amt)})`, app: 'finance', id: i.id }));
  allCo().forEach(co => { const c = S.co[co.id]; if (c && c.fu && c.fu <= S.day && c.lead && !['gewonnen', 'verloren'].includes(c.stage)) t.push({ t: `Follow-up: ${co.n}`, app: 'crm', id: co.id }); });
  return t;
}
export { lesson };
