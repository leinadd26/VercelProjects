// Vertrieb: Ansprache-Bewertung, Kundenantworten, Discovery-Gespräch, ROI, Angebotsbewertung, Verhandlung
import { S, cs, rnd, pick, chance, between, uid, notify, logAct, hist, gain, addRep, addTrust, useHours, lesson } from './store.js';
import { getCo, wf, addrOf, sal, dm } from './companies.js';
import { ARCH, CAMP, PERS, COMP, QS, KEYQ, API_TXT } from './arch.js';
import { clamp, sum, eur, fmtDate, nextWorkday } from './util.js';
import { queueMail, sendMail, setStage, makeLead, knowContact, qAdd, campMod, checkMiles } from './sim.js';
import { createProject, effort } from './proj.js';

const ownHit = (ar, L) => ar.kw.filter(x => L.includes(x)).length;
// ---------- Ansprache ----------
export function evalOutreach(co, ct, subj, body, prev) {
  const w = wf(co), ar = w.ar, L = (subj + ' ' + body).toLowerCase(), pts = [], P = ct ? PERS[ct.p] : null, c0 = cs(co.id), c = prev ? { mail: prev.mail, lastMail: prev.last, replied: c0.replied, trust: c0.trust } : c0; let sc = 34;
  const add = (v, t) => { sc += v; if (t) pts.push({ ok: v >= 0, t }); };
  const len = body.trim().length;
  if (ct) { const ln = ct.name.split(' ').pop().toLowerCase(); add(L.includes(ln) ? 7 : -6, L.includes(ln) ? 'Persönliche Anrede mit korrektem Namen.' : 'Keine persönliche Anrede – wirkt wie ein Serienbrief.'); }
  else add(-8, 'Sammeladresse statt Ansprechperson: Die Mail landet selten beim Entscheider.');
  const nm = co.n.toLowerCase(); add(L.includes(nm) || L.includes(nm.split(' ')[0]) ? 5 : -4, L.includes(nm) || L.includes(nm.split(' ')[0]) ? 'Unternehmen konkret genannt.' : 'Das Unternehmen wird nicht genannt – austauschbar.');
  const own = ownHit(ar, L), dec = co.ca !== co.a ? ownHit(ARCH[co.ca], L) : 0; let other = 0; for (const k in ARCH) if (k !== co.a && k !== co.ca) other = Math.max(other, ownHit(ARCH[k], L));
  if (own >= 2) add(24, 'Konkrete Beobachtung zum Ablauf – zeigt echte Recherche.'); else if (own === 1 || dec >= 2) add(13, 'Ein Prozessbezug ist erkennbar, könnte aber konkreter sein.'); else if (other >= 2) add(-10, 'Das beschriebene Problem passt nicht erkennbar zu diesem Unternehmen.'); else add(-8, 'Keine konkrete Beobachtung zu diesem Unternehmen – generisch.');
  if (/(mir ist aufgefallen|ich habe (gesehen|gelesen|entdeckt)|stellenanzeige|auf ihrer (website|seite)|ihrer website|laut ihrer)/.test(L)) add(5, 'Beobachtung als Beobachtung formuliert, nicht als Behauptung.');
  if (/(sie haben (bestimmt|sicher|vermutlich)|ihr problem ist|sie verschwenden|sie verlieren)/.test(L)) add(-6, 'Annahmen werden als Tatsachen formuliert – du kennst die Fakten noch nicht.');
  add(/(gespräch|telefonat|austausch|termin|15 minuten|20 minuten|kurz sprechen|call)/.test(L) ? 8 : -5, /(gespräch|telefonat|austausch|termin|15 minuten|20 minuten|kurz sprechen|call)/.test(L) ? 'Klarer, kleiner nächster Schritt.' : 'Kein klarer nächster Schritt (z. B. 20-Minuten-Gespräch).');
  if (len < 140) add(-14, 'Zu kurz, um Substanz zu zeigen.'); else if (len <= 1000) add(8, 'Gute Länge.'); else if (len > 1500) add(-10, 'Zu lang für eine Erstansprache.');
  const buzz = (L.match(/(revolution|bahnbrechend|ki-lösung|führend|ganzheitlich|disruptiv|synerg|game.?changer|zukunftsweisend|next level|innovativ)/g) || []).length; if (buzz) add(-Math.min(15, buzz * 5), 'Buzzwords ohne Inhalt.');
  if (/(garantier|100 ?%|sicher sparen|auf jeden fall sparen)/.test(L)) add(-14, 'Garantien für Einsparungen sind unseriös.');
  if (/(über \d+ (kunden|projekte)|zahlreiche referenzen|jahrelange erfahrung|erfahrenes team|marktführer)/.test(L)) add(-12, 'Behauptungen ohne Beleg – du hast noch keine Kunden.');
  if (/(pilot|festpreis|klein|unverbindlich|bestandsaufnahme)/.test(L)) add(4, 'Kleiner, begrenzter Einstieg senkt die Hürde.');
  if (body.includes(S.me.name.split(' ').pop())) add(3, '');
  if (subj.trim().length < 6) add(-3, 'Betreff zu dünn.'); else if (/!!|gratis|sparen|jetzt|angebot/i.test(subj)) add(-5, 'Betreff wirkt wie Werbung.');
  if (c.mail > 0 && S.day - c.lastMail < 3) add(-18, 'Zu schnell nachgefasst.');
  if (c.mail >= 3 && !c.replied) add(-20, 'Dritte Mail ohne Reaktion – das nervt.');
  if (P) { if (ct.p === 'busy' && len > 900) add(-6, 'Für vielbeschäftigte Menschen zu lang.'); if (ct.p === 'curious' && own >= 1) add(4, ''); if (ct.p === 'tech' && /(api|webhook|oauth|schnittstelle)/.test(L)) add(4, 'Technischer Bezug passt zur Zielperson.'); }
  sc += (co.att - 3) * 3 + S.rep / 10 + (S.skills.Kommunikation - 15) / 8;
  const p = clamp((sc - 25) / 65, .03, .9) * (ct ? 1 : .75) + (P ? P.mail : 0) + (c.trust - 40) / 400;
  return { sc: Math.round(sc), pts, p: clamp(p, .02, .92), own };
}
const who = (ct, co) => ct ? `${ct.f ? 'Frau' : 'Herr'} ${ct.name.split(' ').pop()}` : 'Damen und Herren';
const sg = (ct) => ct ? `${PERS[ct.p].pre[Math.floor(rnd() * PERS[ct.p].pre.length)]}` : '';
export function handleOutreach(m, co, ct) { // wird nach sendMail aufgerufen
  const ev = evalOutreach(co, ct, m.subj, m.body), c = cs(co.id), P = ct ? PERS[ct.p] : PERS.busy; const r = rnd(), p = ev.p; let out = 'ignore';
  if (c.mail >= 4 && !c.replied) out = 'ignore'; else if (r < p * .5) out = 'interest'; else if (r < p * .85) out = 'ask'; else if (r < p + (1 - p) * .4) out = 'decline';
  const delay = Math.round((1 + P.delay + Math.floor(rnd() * 2)) * CAMP[co.camp].slow);
  const who2 = ct || dm(co), from = addrOf(co, ct), fn = ct ? ct.name : 'Zentrale / Sekretariat';
  if (out === 'ignore') { c.ignored++; hist(co.id, 'Keine Reaktion auf E-Mail'); gain('Kommunikation', ev.sc > 50 ? .4 : .15); return ev; }
  c.replied = 1; gain('Kommunikation', .5); gain('Kundenentdeckung', .3);
  const base = { fn, from, to: 'ich', co: co.id, ct: who2.i, th: m.th };
  if (out === 'interest') queueMail(delay, { ...base, subj: 'Re: ' + m.subj, body: `${sg(ct)} Guten Tag,\n\nvielen Dank für Ihre Nachricht. ${ev.own ? 'Das Thema „' + ARCH[co.a].n + '“ beschäftigt uns tatsächlich.' : 'Ihre Nachricht kam zu einem guten Zeitpunkt.'} Ein kurzes Gespräch wäre in Ordnung. Schlagen Sie mir gern einen Termin vor.\n\nFreundliche Grüße\n${fn}`, act: [{ t: 'Discovery-Call vereinbaren', a: 'book' }], kind: 'interest' });
  else if (out === 'ask') { const ask = ct && P.refs ? 'refs' : ct && P.sec ? 'sec' : 'what'; const Q = { refs: 'Haben Sie Referenzen aus unserer Branche? Mit wem haben Sie so etwas schon umgesetzt?', sec: 'Wie gehen Sie mit Datenschutz und Datensicherheit um? Wo liegen die Daten, was passiert mit Zugangsdaten?', what: 'Was genau haben Sie bei uns konkret gesehen? Ich kann mir unter Ihrem Angebot noch nichts Konkretes vorstellen.' }[ask];
    queueMail(delay, { ...base, subj: 'Re: ' + m.subj, body: `${sg(ct)} Guten Tag,\n\nbevor ich Zeit einplane, habe ich eine Rückfrage: ${Q}\n\nFreundliche Grüße\n${fn}`, ask, kind: 'ask' }); }
  else queueMail(delay, { ...base, subj: 'Re: ' + m.subj, body: `Guten Tag,\n\nvielen Dank für Ihre Nachricht. ${pick(['Aktuell haben wir dafür keinen Bedarf.', 'Wir haben dafür derzeit weder Zeit noch Budget.', 'Wir arbeiten bereits mit einer eigenen Lösung.'])} Wir melden uns, falls sich das ändert.\n\nFreundliche Grüße\n${fn}`, kind: 'decline' });
  if (out === 'decline') c.int = Math.max(0, c.int - 5);
  return ev;
}
export function evalAnswer(orig, body) {
  const L = body.toLowerCase(), co = getCo(orig.co), ct = co.cn[orig.ct]; let ok = 0, note = '';
  if (orig.ask === 'refs') { const hon = /(erst|gerade|noch keine|am anfang|selbstständig|neu|keine referenz)/.test(L), pil = /(pilot|festpreis|begrenzt|klein|messbar)/.test(L), fake = /(über \d+|zahlreiche|viele kunden|jahrelang)/.test(L); ok = fake ? 0 : hon && pil ? .85 : hon ? .5 : .2; note = fake ? 'Behauptete Referenzen ohne Beleg verbrennen Vertrauen.' : hon && pil ? 'Ehrlich und mit risikoarmem Pilot-Angebot – genau richtig.' : 'Ehrlichkeit plus kleiner, messbarer Pilot wäre überzeugender gewesen.'; }
  if (orig.ask === 'sec') { const n = [/avv|auftragsverarbeitung/, /(eu|deutschland|europa).{0,20}(hosting|rechenzentrum|server)|hosting.{0,20}(eu|deutschland)/, /verschlüssel|tls|https/, /secret|vault|schlüssel|credentials|zugangsdaten/, /minimier|löschung|löschfrist|datensparsam/, /dsgvo|datenschutz/, /mandant|rollen|berechtigung/].filter(r => r.test(L)).length; ok = n >= 4 ? .9 : n >= 3 ? .7 : n >= 2 ? .4 : .1; note = n >= 3 ? 'Konkrete Sicherheitsmaßnahmen statt Floskeln.' : 'Nenne konkrete Maßnahmen: AVV, EU-Hosting, Verschlüsselung, Secrets-Management, Löschfristen.'; }
  if (orig.ask === 'what') { const n = ownHit(ARCH[co.a], L) + ownHit(ARCH[co.ca], L); ok = n >= 2 ? .85 : n === 1 ? .55 : body.length > 300 ? .3 : .1; note = n >= 1 ? 'Konkret auf den Ablauf des Unternehmens bezogen.' : 'Zu vage – nenne eine konkrete Beobachtung, z. B. aus Stellenanzeigen oder Kontaktseiten.'; }
  if (/(garantier|100 ?%)/.test(L)) { ok -= .3; note += ' Garantien wirken unseriös.'; }
  ok += S.skills.Kommunikation / 600; return { ok: clamp(ok, 0, .95), note };
}
export function handleAnswer(m, orig) {
  const co = getCo(orig.co), ct = co.cn[orig.ct], r = evalAnswer(orig, m.body), P = PERS[ct.p], base = { fn: ct.name, from: addrOf(co, ct), to: 'ich', co: co.id, ct: ct.i, th: m.th };
  const delay = Math.round((1 + P.delay) * CAMP[co.camp].slow);
  if (chance(r.ok)) { addTrust(co.id, 8); queueMail(delay, { ...base, subj: 'Re: ' + m.subj, body: `Guten Tag,\n\ndanke, das hilft. Dann lassen Sie uns kurz sprechen.\n\n${ct.name}`, act: [{ t: 'Discovery-Call vereinbaren', a: 'book' }], kind: 'interest' }); }
  else { addTrust(co.id, -5); queueMail(delay, { ...base, subj: 'Re: ' + m.subj, body: `Guten Tag,\n\nich bin nicht überzeugt. Wir melden uns, falls sich etwas ändert.\n\n${ct.name}`, kind: 'decline' }); }
  return r;
}
// Technische Rückfrage an die IT-Kontaktperson
export function techReply(m, co, ct) {
  const L = (m.subj + ' ' + m.body).toLowerCase(); if (ct.p !== 'tech' || !/(api|schnittstelle|export|import|csv|webhook|rest|anbindung)/.test(L)) return false;
  const w = wf(co), txt = apiText(co, w, true); queueMail(1, { fn: ct.name, from: addrOf(co, ct), to: 'ich', subj: 'Re: ' + m.subj, body: `Hallo,\n\n${txt}\n\n${ct.name}`, co: co.id, ct: ct.i, th: m.th });
  cs(co.id).known.api = { v: w.api, lic: w.lic, vague: 0, src: 'IT-Kontakt', d: S.day + 1, txt }; addTrust(co.id, 4); gain('REST APIs', .4); return true;
}
function apiText(co, w, full) {
  const s = { rest: `Ja, ${w.sys.split(' (')[0]} hat eine REST-API (OAuth 2.0, ca. 60 Anfragen/Minute).${w.lic && full ? ' Allerdings ist das Schnittstellenmodul bei uns nicht lizenziert – das kostet ca. 2.400 € im Jahr extra.' : ''}`, csv: 'Keine echte API. Das System kann CSV/XML-Dateien aus einem überwachten Ordner importieren und exportieren, SFTP wäre möglich.', none: 'Nein, keine Schnittstelle. Der Hersteller bietet nur Individualentwicklung gegen Aufpreis an; alles andere läuft über die Oberfläche.' };
  return s[w.api];
}

// ---------- Discovery-Gespräch ----------
export function startCall(mid) {
  const m = S.meetings.find(x => x.id === mid), co = getCo(m.co), ct = co.cn[m.ct], P = PERS[ct.p], c = cs(co.id);
  if (chance(P.ghost * (c.trust < 45 ? 1.6 : .8)) && !m.rs) { m.rs = 1; m.d = nextWorkday(S.day + 3); m.h = 11; notify(`${ct.name} ist kurzfristig verhindert – Termin verschoben auf ${fmtDate(m.d)}.`, 'calendar', 'warn'); hist(co.id, 'Gesprächspartner:in abgetaucht/verhindert'); return { noshow: true }; }
  S.call = { mid, co: co.id, ct: m.ct, left: m.dur, tot: m.dur, asked: [], tx: [{ w: 'c', t: `${P.pre[0]} Guten Tag, schön, dass es klappt. Wir haben etwa ${m.dur} Minuten.` }], pitched: 0, sum: 0, first: null, clar: {}, ended: 0, prem: 0 };
  c.calls++; c.lastContact = S.day; setStage(co.id, 'discovery'); makeLead(co.id); useHours(m.dur / 60); return { ok: true };
}
const num = (v, vague) => vague ? Math.round(v * between(.65, 1.4)) : v;
function answer(qid, co, ct, w, vague) {
  const ar = w.ar, camp = CAMP[co.camp], P = PERS[ct.p], c = cs(co.id), isT = ct.p === 'tech', pre = pick(P.pre);
  const stackTxt = co.stack.join(', ');
  switch (qid) {
    case 'trigger': return { t: ar.trig + (co.ca !== co.a && !c.reveal ? ` Aber ehrlich gesagt: ${ARCH[co.ca].n.toLowerCase()} ist bei uns gar nicht das große Thema – das läuft. Was uns wirklich Zeit kostet, ist ${ar.n.toLowerCase()}.` : ''), reveal: co.ca !== co.a };
    case 'who': return { t: `${pre} Das machen hauptsächlich ${co.cn[1]?.name.split(' ')[0] || 'das Büro'} und etwa ${Math.max(1, Math.round(w.hours / 120))} weitere Kolleg:innen. Ablauf: ${ar.steps.join(' → ')}.` };
    case 'systems': return { t: `Wir nutzen ${stackTxt}. Der Kern ist ${w.sys}.` };
    case 'volume': { const v = num(w.vol, vague); return { t: vague ? `${pre} So ungefähr ${v} im Monat, würde ich sagen – genau weiß ich es nicht.` : `Im Schnitt ${w.vol} pro Monat, das haben wir neulich gezählt.`, v, vague }; }
    case 'duration': { const v = Math.max(1, Math.round(num(w.min, vague) * 10) / 10); return { t: vague ? `${pre} So fünf bis zehn Minuten, je nachdem – grob ${v}.` : `Mit allem Drum und Dran ${w.min} Minuten.`, v, vague }; }
    case 'errors': { const v = Math.round(num(w.err, vague) * 1000) / 1000; return { t: vague ? `Gar nicht so oft, vielleicht ${Math.round(v * 100)} von 100. ${ar.errT}` : `Etwa ${Math.round(w.err * 1000) / 10} % der Vorgänge. ${ar.errT}`, v, vague }; }
    case 'failure': return { t: camp.cd.fail };
    case 'storage': return { t: camp.cd.store };
    case 'api': { if (!isT && ct.p !== 'accountant') return { t: `${pre} Das müsste ich die IT fragen. Ich glaube, da gibt es bestimmt irgendeine Schnittstelle.`, v: 'unbekannt', vague: 1, guess: 1 }; return { t: apiText(co, w, isT), v: w.api, lic: isT ? w.lic : 0, vague: isT ? 0 : 1 }; }
    case 'judgment': return { t: ar.judg };
    case 'cost': { const known = ['cost', 'accountant', 'tech', 'procure'].includes(ct.p); return known ? { t: `Eine Fachkraft kostet uns etwa ${vague ? Math.round(w.wage * 1.2) : w.wage} € pro Stunde inklusive Nebenkosten. Ein Fehler kostet uns im Schnitt rund ${vague ? Math.round(w.ec * .7) : w.ec} €.`, v: { wage: vague ? Math.round(w.wage * 1.2) : w.wage, ec: vague ? Math.round(w.ec * .7) : w.ec }, vague } : { t: `${pre} Das haben wir nie ausgerechnet. Eine Kraft kostet vielleicht ${Math.round(w.wage * 1.25)} € die Stunde? Fehlerkosten – schwer zu sagen.`, v: { wage: Math.round(w.wage * 1.25), ec: null }, vague: 1 }; }
    case 'success': return { t: camp.cd.succ };
    case 'priorities': return { t: co.pr + '.' };
    case 'tried': return { t: co.tr || 'Bisher nichts Konkretes versucht.' };
    case 'team': return { t: co.rs };
    case 'decision': { const d = dm(co); knowContact(co.id, d.i); return { t: `${d.i === ct.i ? 'Das entscheide ich im Wesentlichen selbst' : 'Entscheiden tut ' + d.name + ' (' + d.role + ')'}. ${camp.refs ? 'Dazu kommen Einkauf, IT-Sicherheitsfragebogen und der Wunsch nach Referenzen.' : w.budget > 15000 ? 'Ab einer gewissen Summe muss noch ein Gremium zustimmen.' : 'Das geht auf dem kurzen Dienstweg.'}` }; }
    case 'budget': { const v = Math.round(w.budget * between(.55, .9) * (P.price < .8 ? .85 : 1) / 100) * 100; return { t: `${pre} Für einen sinnvollen Start können wir uns bis etwa ${eur(v)} vorstellen. Wenn es sich in einem Jahr rechnet, auch mehr.`, v }; }
    case 'security': return { t: camp.cd.sec };
    case 'it': { const t = co.cn.find(x => x.p === 'tech' && x.i !== ct.i); if (t) { knowContact(co.id, t.i); return { t: `Am besten sprechen Sie direkt mit ${t.name} (${t.role}). Er kennt die Systeme.`, v: 'kontakt' }; }
      const w2 = wf(co); qAdd(nextWorkday(S.day + 3), 'fn', { fn: 'sec_info', co: co.id, api: w2.api, lic: w2.lic, txt: `IT-Dienstleister meldet: ${apiText(co, w2, true)}` }); queueMail(3, { fn: 'IT-Dienstleister', from: `service@it-partner-${co.id}.example`, to: 'ich', subj: 'Technische Auskunft zu ' + co.sysn, body: `Hallo,\n\n${ct.name} hat mich gebeten, Ihnen kurz zu antworten.\n\n${apiText(co, w2, true)}\n\nGrüße vom IT-Service`, co: co.id, ct: ct.i }); return { t: 'Das macht unser externer IT-Dienstleister. Ich frage dort nach und melde mich in ein paar Tagen.', v: 'kontakt' }; }
  }
}
export function callAsk(qid, free) {
  const c = S.call, co = getCo(c.co), ct = co.cn[c.ct], P = PERS[ct.p], k = cs(co.id), q = QS.find(x => x.id === qid), w = wf(co); if (c.ended || c.left <= 0) return;
  c.tx.push({ w: 'me', t: free || q.t }); c.left -= q.min;
  if (c.asked.includes(qid)) { c.tx.push({ w: 'c', t: 'Das hatte ich Ihnen schon gesagt.' }); addTrust(co.id, -2); return endIfDone(); }
  if (k.trust < q.need) { c.tx.push({ w: 'c', t: pick(['Dazu müsste ich Sie erst besser kennenlernen.', 'Das ist mir zu früh – lassen Sie uns erst über den Ablauf sprechen.', 'Darüber möchte ich im Moment nicht sprechen.']) }); addTrust(co.id, -1); if (qid === 'budget' && !c.asked.length) { addTrust(co.id, -6); c.prem = 1; } return endIfDone(); }
  c.asked.push(qid); if (c.first === null) c.first = qid;
  const vague = ['volume', 'duration', 'errors', 'cost', 'api'].includes(qid) && rnd() > P.open + (k.trust - 50) / 200;
  const a = answer(qid, co, ct, w, vague); c.tx.push({ w: 'c', t: a.t, q: qid, vague: a.vague });
  k.known[qid] = { v: a.v ?? a.t, vague: a.vague ? 1 : 0, lic: a.lic, guess: a.guess, d: S.day, src: 'Gespräch', txt: a.t };
  if (a.reveal) { k.reveal = 1; hist(co.id, 'Eigentliches Problem im Gespräch offengelegt'); }
  if (qid === 'budget' && !c.asked.slice(0, -1).length) { addTrust(co.id, -6); c.prem = 1; } else addTrust(co.id, (q.key ? 3 : 2) * P.tg * (c.asked.length <= 3 && ['trigger', 'who', 'systems'].includes(qid) ? 1.4 : 1));
  k.int = clamp(k.int + 2, 0, 100); endIfDone();
}
function endIfDone() { const c = S.call; if (c.left <= 0 && !c.ended) { c.tx.push({ w: 'c', t: 'Entschuldigung, ich muss weiter – die Zeit ist um.' }); c.ended = 1; c.left = 0; } }
export function callClarify(qid) {
  const c = S.call, co = getCo(c.co), k = cs(co.id), f = k.known[qid], w = wf(co); if (!f || !f.vague || c.left <= 0) return; c.left -= 3; c.tx.push({ w: 'me', t: 'Können Sie das etwas präzisieren?' });
  if (k.trust >= 45 && chance(.75)) { const a = answer(qid, co, co.cn[c.ct], w, false); c.tx.push({ w: 'c', t: 'Moment, ich schau nach… ' + a.t, q: qid }); k.known[qid] = { v: a.v ?? a.t, vague: 0, lic: a.lic, d: S.day, src: 'Gespräch (präzisiert)', txt: a.t }; addTrust(co.id, 1); } else c.tx.push({ w: 'c', t: 'Genauer kann ich es Ihnen leider nicht sagen.' });
  endIfDone();
}
export function callSummarize() {
  const c = S.call; if (c.sum || c.asked.length < 3) return; c.left -= 2; c.sum = 1; c.tx.push({ w: 'me', t: 'Darf ich kurz zusammenfassen, was ich verstanden habe? …' }); c.tx.push({ w: 'c', t: pick(['Ja, genau so ist es.', 'Im Wesentlichen richtig – danke, dass Sie nachfragen.']) }); addTrust(c.co, 5); gain('Kommunikation', .6); endIfDone();
}
export const keysKnown = id => KEYQ.filter(q => cs(id).known[q]).length;
export function callPitch() {
  const c = S.call, k = cs(c.co); if (c.pitched) return; c.pitched = 1; c.left -= 4; const n = keysKnown(c.co); c.tx.push({ w: 'me', t: 'Ich würde gern eine erste Lösungsidee skizzieren…' });
  if (n < 6) { addTrust(c.co, -12); c.prem = 1; c.tx.push({ w: 'c', t: pick(['Moment – Sie kennen unseren Ablauf doch noch gar nicht richtig.', 'Das klingt wie von der Stange. Haben Sie überhaupt verstanden, wie wir arbeiten?']) }); }
  else { addTrust(c.co, 4); k.int = clamp(k.int + 8, 0, 100); c.tx.push({ w: 'c', t: pick(['Das klingt nachvollziehbar. Schicken Sie mir gern ein konkretes Angebot.', 'Interessant, und auch vorsichtig formuliert. Erstellen Sie mir einen Vorschlag.']) }); }
  endIfDone();
}
export function callEnd() {
  const c = S.call, co = getCo(c.co), k = cs(c.co), P = PERS[co.cn[c.ct].p], m = S.meetings.find(x => x.id === c.mid); if (!c.ended) c.ended = 1;
  const keys = KEYQ.filter(q => k.known[q]), prec = keys.filter(q => !k.known[q].vague).length; let score = Math.round(100 * (prec + (keys.length - prec) * .5) / KEYQ.length) + (c.sum ? 6 : 0) - (c.prem ? 10 : 0) - (c.asked.length < 4 ? 8 : 0);
  score = clamp(score, 0, 100); m.done = 1; k.lastContact = S.day; k.int = clamp(k.int + 10, 0, 100); hist(co.id, `Discovery-Gespräch (Score ${score})`);
  const good = [], miss = [], real = [];
  if (prec >= 6) good.push(`${prec} belastbare Kernfakten erhoben.`); if (c.sum) good.push('Verständnis zusammengefasst und bestätigt – das schafft Vertrauen.'); if (!c.prem) good.push('Gesprächsreihenfolge ohne grobe Fehler.');
  KEYQ.filter(q => !k.known[q]).forEach(q => miss.push(QS.find(x => x.id === q).t)); keys.filter(q => k.known[q].vague).forEach(q => miss.push(`Zu „${QS.find(x => x.id === q).cat}“ nur ungefähre Angaben (${q}) – nachfassen, bevor du rechnest.`));
  if (c.prem) real.push('Zu früh nach Budget gefragt bzw. Lösung vorgeschlagen: In der Praxis verlierst du damit Vertrauen, bevor du den Prozess verstanden hast.');
  if (k.known.api?.guess) real.push('Die Schnittstellenlage ist nur eine Vermutung des Gesprächspartners. Prüfe sie mit der IT oder der Herstellerdokumentation.');
  if (co.ca !== co.a && k.reveal) good.push('Du hast herausgefunden, dass das eigentliche Problem nicht das sichtbare war – Website-Hinweise sind Hypothesen.');
  gain('Prozessanalyse', score / 100 * 2.4); gain('Kundenentdeckung', score / 100 * 2.2); gain('Kommunikation', .6 + (c.sum ? .5 : 0)); if (keys.includes('api')) gain('REST APIs', .4); if (keys.includes('security')) gain('Security', .4);
  S.call = null; checkMiles();
  return { score, good, miss: miss.slice(0, 5), real, next: score >= 55 ? 'Rechne ROI mit den erhobenen Zahlen und erstelle ein passendes Angebot – oder empfiehl ehrlich, nichts zu bauen, wenn es sich nicht lohnt.' : 'Plane ein Follow-up, um offene Kernfragen (Zahlen, Schnittstellen, Entscheider) zu klären, bevor du ein Angebot machst.' };
}

// ---------- ROI ----------
export function roiCalc(r) { // r: vol, min, err, ec, wage, auto, cash, run, price, mt
  const freedH = r.vol * r.min / 60 * r.auto, timeVal = freedH * r.wage, cashT = timeVal * r.cash, errS = r.vol * r.err * (r.ec || 0) * .6, gross = cashT + errS, net = gross - (r.mt || 0);
  return { freedH, timeVal, cashT, errS, gross, net, year: net * 12, payback: net > 0 ? r.price / net : Infinity };
}
export function suggestPrice(comps, pilot) { const h = effort(comps); return Math.round(h * S.me.rate * (pilot ? 1 : 1.12) / 50) * 50; }
export function coverage(co, comps) {
  const w = wf(co), ar = w.ar, ch = new Set(comps); let hit = 0, tot = ar.need.length, note = [];
  for (const n of ar.need) { if (n === 'conn') { const has = ['rest', 'csv', 'rpa'].filter(x => ch.has(x)); const f = w.api === 'rest' ? { rest: 1, csv: .6, rpa: .5 } : w.api === 'csv' ? { csv: 1, rpa: .6, rest: 0 } : { rpa: .8, csv: .4, rest: 0 }; hit += Math.max(0, ...has.map(x => f[x])); if (!has.length) note.push('Keine Anbindung an das Zielsystem vorgesehen.'); else if (w.api !== 'rest' && ch.has('rest') && !ch.has('csv') && !ch.has('rpa')) note.push('REST-Connector geplant, obwohl keine REST-API belegt ist.'); } else if (ch.has(n)) hit++; else note.push(`Es fehlt: ${COMP[n].n}.`); }
  const waste = comps.filter(k => !ar.need.includes(k) && !ar.nice.includes(k) && !COMP[k].conn && !['sec', 'gdpr', 'bak', 'mon'].includes(k));
  waste.forEach(k => note.push(`Überdimensioniert: ${COMP[k].n} wird hier kaum gebraucht.`));
  return { cov: hit / tot, waste, note };
}

// ---------- Angebotsbewertung ----------
export function evalProposal(co, p) {
  const w = wf(co), c = cs(co.id), camp = CAMP[co.camp], ct = dm(co), P = PERS[ct.p], ar = w.ar, ob = [], good = [];
  if (p.target === 'none') { // ehrliche Absage
    if (!w.viable) return { res: 'honest', good: ['Du hast ehrlich empfohlen, nichts zu bauen – weil sich der Fall nicht rechnet.'] };
    return { res: 'reject', ob: ['Sie empfehlen keine Lösung, obwohl hier ein wirtschaftlicher Hebel vorhanden gewesen wäre.'], reason: 'wrong' };
  }
  const known = KEYQ.filter(q => c.known[q] && !c.known[q].vague).length, und = clamp(known / KEYQ.length * 1.15, 0, 1), cv = coverage(co, p.comps);
  if (p.target !== co.a) { ob.push('Ihr Angebot adressiert nicht das Problem, das uns tatsächlich Zeit kostet.'); }
  let fit = p.target === co.a ? cv.cov : cv.cov * .25; fit = clamp(fit - cv.waste.length * .07, 0, 1); cv.note.forEach(n => ob.push(n));
  if (camp.human && !p.comps.includes('human')) ob.push('Rechtlich nicht tragbar: Entscheidungen über Bewerber müssen von Menschen getroffen werden (Freigabe-Schritt fehlt).');
  if (camp.gdpr && !p.comps.includes('gdpr')) ob.push('Datenschutzkonzept fehlt (AVV, EU-Hosting, Löschkonzept).');
  if (camp.bak && !p.comps.includes('bak')) ob.push('Für uns Pflicht: Backups und revisionssichere Protokolle (GoBD).');
  if (camp.sec && !p.comps.includes('sec')) ob.push('Unsere IT verlangt ein Sicherheitskonzept (Authentifizierung, Secrets, Rollen).');
  const hard = ob.filter(x => /Rechtlich|Datenschutzkonzept|Backups|Sicherheitskonzept/.test(x)).length;
  const fz = camp.freeze; if (fz && S.day + p.weeks * 7 >= fz[0] && S.day + p.weeks * 7 < fz[1]) { ob.push('Ein Go-live im Code-Freeze der Hochsaison ist ausgeschlossen.'); fit -= .2; }
  const roi = p.roi ? roiCalc({ ...p.roi, price: p.price, mt: p.mt }) : null; let overs = 1, lie = false;
  if (roi) { overs = roi.gross / Math.max(1, w.cashT + w.errS); if (overs > 1.6) { lie = true; ob.push('Die versprochenen Einsparungen halten einer Plausibilitätsprüfung unserer Seite nicht stand.'); } else if (overs <= 1.25 && roi.gross > 0) good.push('ROI-Rechnung liegt im plausiblen Bereich.'); }
  else ob.push('Es liegt keine nachvollziehbare ROI-Rechnung bei.');
  const eff = (.35 + .65 * clamp(cv.cov, 0, 1)) * (p.target === co.a ? 1 : .2), benefit = (w.cashT + w.errS) * eff, netM = benefit - (p.mt || 0);
  const trust = c.trust / 100, mood = campMod(co.camp), rep = S.rep / 100;
  let maxAcc = Math.min(w.budget * mood * (.78 + .5 * trust) * P.price * (camp.pm || 1) * (c.upsell ? 1.25 : 1), Math.max(0, netM) * 12 * .85) * (p.pilot ? .55 : 1);
  if (p.pilot) maxAcc = Math.min(maxAcc + w.budget * .1, w.budget * .55);
  const pr = maxAcc > 0 ? p.price / maxAcc : 99, base = .45 * fit + .25 * und + .22 * trust + .08 * rep + (p.pilot ? .06 : 0) + (c.upsell ? .08 : 0);
  if (!c.known.api || c.known.api.guess || c.known.api.vague) if (p.comps.includes('rest')) { ob.push('Sie setzen eine API voraus, die Sie nicht belegt haben.'); }
  if (camp.refs && p.price > 6000 && !p.pilot && S.rep < 45 && !c.upsell) { return { res: 'counter', kind: 'pilot', max: Math.round(Math.min(maxAcc * .5, w.budget * .45) / 100) * 100, ob: [...ob, 'Ohne Referenzen starten wir nur mit einem Pilot.'], good, und, fit, pr, delay: 3 }; }
  if (hard || lie || fit < .35 || base < .38 || !w.viable) return { res: 'reject', ob: ob.length ? ob : ['Das Angebot überzeugt uns nicht.'], reason: !w.viable ? 'roi' : hard ? 'compliance' : 'weak', und, fit, pr };
  if (pr <= .95 && base >= .52) { good.push('Preis liegt im Rahmen dessen, was sich für den Kunden rechnet.'); return { res: 'accept', good, ob, und, fit, pr }; }
  if (pr <= 1.4 && base >= .44) return { res: 'counter', kind: 'price', max: Math.round(maxAcc * 1.04 / 10) * 10, ob: [...ob, pr > 1 ? 'Der Preis liegt über unserem Rahmen.' : ''].filter(Boolean), good, und, fit, pr, round: 0 };
  return { res: 'reject', ob: [...ob, 'Der Preis steht nicht im Verhältnis zum erwartbaren Nutzen.'], reason: 'price', und, fit, pr };
}
export function sendProposal(co, p, mailOpts) {
  const ct = dm(co), c = cs(co.id); p.id = uid('pr'); c.props++; c.deal = p.price; setStage(co.id, 'angebot'); hist(co.id, `Angebot gesendet: ${eur(p.price)}${p.pilot ? ' (Pilot)' : ''}`);
  const m = sendMail({ co: co.id, ct: ct.i, to: addrOf(co, ct), subj: mailOpts.subj, body: mailOpts.body, att: ['Angebot.pdf'], kind: 'proposal' }); m.prop = p;
  const r = evalProposal(co, p); const delay = Math.round((2 + PERS[ct.p].delay + Math.floor(rnd() * 3)) * CAMP[co.camp].slow); const base = { fn: ct.name, from: addrOf(co, ct), to: 'ich', co: co.id, ct: ct.i, th: m.th, subj: 'Re: ' + mailOpts.subj, prop: p };
  gain('Vertrieb', 1.2); gain('ROI-Berechnung', p.roi ? 1 : .2); gain('Finanzplanung', .4);
  if (r.res === 'honest') { addRep(2); addTrust(co.id, 12); c.status = 'beraten'; queueMail(delay, { ...base, subj: 'Re: ' + mailOpts.subj, body: `Guten Tag,\n\nvielen Dank für Ihre ehrliche Einschätzung. Das ist selten – und erspart uns Geld. Wir empfehlen Sie gern weiter.\n\n${ct.name}`, kind: 'honest' }); lesson(`${co.n}: Ehrlich von der Automatisierung abgeraten – das baut langfristig Vertrauen und Reputation auf.`); S.pendFeedback = { co: co.id, r }; return r; }
  if (r.res === 'accept') queueMail(delay, { ...base, body: `Guten Tag,\n\nIhr Angebot (${eur(p.price)}) überzeugt uns. Wir beauftragen Sie hiermit.\n\n${ct.name}`, act: [{ t: 'Auftrag bestätigen & Projekt starten', a: 'start' }], kind: 'accept' });
  else if (r.res === 'counter') queueMail(delay, { ...base, body: `Guten Tag,\n\ndanke für das Angebot. ${r.kind === 'pilot' ? 'Wir würden gern erst mit einem begrenzten Pilot starten, bevor wir uns binden.' : 'Der Preis liegt über unserem Rahmen.'} ${r.kind === 'price' ? `Bis ${eur(r.max)} könnten wir mitgehen.` : `Für einen Pilot haben wir etwa ${eur(r.max)} eingeplant.`}\n\n${(r.ob || []).slice(0, 2).join(' ')}\n\n${ct.name}`, neg: { kind: r.kind, max: r.max, round: r.round || 0 }, act: [{ t: `Zu ${eur(r.max)} annehmen`, a: 'neg_accept' }, { t: 'Gegenvorschlag machen', a: 'neg_counter' }, { t: 'Mit Nutzen argumentieren (Preis halten)', a: 'neg_hold' }, { t: 'Pilot anbieten', a: 'neg_pilot' }, { t: 'Verhandlung beenden', a: 'neg_drop' }], kind: 'counter' });
  else queueMail(delay, { ...base, body: `Guten Tag,\n\nleider müssen wir absagen. ${(r.ob || []).slice(0, 3).join(' ')}\n\n${ct.name}`, kind: 'reject' });
  S.pendFeedback = { co: co.id, r }; return r;
}
export function startFromMail(m) { // Auftrag bestätigen
  const co = getCo(m.co), p = m.prop; if (!p || S.projects.some(x => x.sig === m.id)) return null;
  const pr = createProject(co, p); pr.sig = m.id; addTrust(co.id, 5); gain('Vertrieb', 1.5); addRep(1); checkMiles(); return pr;
}
export function negotiate(m, move, val) {
  const co = getCo(m.co), ct = dm(co), c = cs(co.id), P = PERS[ct.p], p = m.prop, n = m.neg, base = { fn: ct.name, from: addrOf(co, ct), to: 'ich', co: co.id, ct: ct.i, th: m.th, prop: p }; let out = '', f = '';
  if (m.done) return null; m.done = 1; setStage(co.id, 'verhandlung'); gain('Verhandlung', 1.2);
  const win = (price, txt) => { p.price = price; queueMail(1, { ...base, subj: 'Re: ' + m.subj, body: `Guten Tag,\n\neinverstanden, ${txt} Bitte starten Sie das Projekt.\n\n${ct.name}`, act: [{ t: 'Auftrag bestätigen & Projekt starten', a: 'start' }], kind: 'accept' }); };
  if (move === 'neg_accept') { win(n.max, `zu ${eur(n.max)}.`); f = 'Du hast ohne Gegenverhandlung akzeptiert – das ist ok, wenn die Marge stimmt. Prüfe immer, ob der Preis deine Kosten (Stunden + Betrieb) deckt.'; }
  else if (move === 'neg_counter') { if (val <= n.max * 1.04) { win(val, `zu ${eur(val)}.`); f = 'Dein Gegenvorschlag lag nahe am Rahmen des Kunden – gut kalibriert.'; } else if (val <= n.max * 1.2 && n.round < 2) { const mid = Math.round((val + n.max) / 2 / 10) * 10; queueMail(2, { ...base, subj: 'Re: ' + m.subj, body: `Guten Tag,\n\nwir können uns in der Mitte treffen: ${eur(mid)}.\n\n${ct.name}`, neg: { kind: n.kind, max: mid, round: n.round + 1 }, act: [{ t: `Zu ${eur(mid)} annehmen`, a: 'neg_accept' }, { t: 'Verhandlung beenden', a: 'neg_drop' }], kind: 'counter' }); f = 'Der Kunde kommt dir entgegen. Nutze die Chance, dich zu einigen, bevor es teurer wird.'; } else { lost(co, base, m, 'Der Abstand ist zu groß für uns.'); f = 'Ein zu hoher Gegenvorschlag beendet die Verhandlung. Begründe den Preis mit Nutzen oder biete Scope-Reduktion/Pilot an.'; } }
  else if (move === 'neg_hold') { const ok = p.roi && S.skills.Verhandlung + S.skills['ROI-Berechnung'] + c.trust > 90 && n.max >= p.price * .8; if (ok || chance(.2)) { win(Math.round(p.price * .96 / 10) * 10, `Ihre Nutzenargumentation ist nachvollziehbar, zu ${eur(Math.round(p.price * .96 / 10) * 10)}.`); f = 'Nutzenargumentation mit belastbarer ROI-Rechnung wirkt – aber nur, wenn die Zahlen plausibel sind.'; } else { lost(co, base, m, 'Der Preis passt nicht zu unserem Budget.'); f = 'Ohne starke ROI-Belege und Vertrauen führt „Preis halten“ meist zum Abbruch. Biete Alternativen an (Pilot, kleinerer Scope).'; } }
  else if (move === 'neg_pilot') { const price = Math.round(Math.min(n.max, p.price * .45) / 10) * 10; const cmp = ['mail', 'ocr', 'llm', 'rules', 'human', 'conn'].length; p.pilot = 1; p.price = price; p.mt = 0; p.comps = p.comps.filter(k => !['dash', 'bot', 'queue', 'db', 'bak', 'mon'].includes(k)).slice(0, 5); if (!p.comps.includes('human') && ARCH[co.a].need.includes('human')) p.comps.push('human'); p.weeks = Math.min(p.weeks, 4); win(price, `als Pilot zu ${eur(price)}.`); f = 'Ein begrenzter Pilot senkt das Risiko des Kunden und öffnet die Tür zum Folgeauftrag.'; }
  else if (move === 'neg_drop') { lost(co, base, m, 'Schade – ein andermal.'); f = 'Rechtzeitig aussteigen ist legitim, wenn der Deal nicht mehr passt.'; }
  return { f };
}
function lost(co, base, m, why) { setStage(co.id, 'verloren', true); cs(co.id).status = 'lost'; queueMail(1, { ...base, subj: 'Re: ' + m.subj, body: `Guten Tag,\n\n${why} Wir sehen derzeit keine Basis.\n\n${base.fn}`, kind: 'reject' }); }

export function hint(ctx) {
  const H = { mail: 'Beziehe dich auf eine konkrete Beobachtung (Karriereseite, Kontaktseite, News), sprich die Person mit Namen an und schlage nur einen kleinen nächsten Schritt vor. Keine Garantien.', call: 'Beginne mit Auslöser und Beteiligten, dann Zahlen (Häufigkeit, Dauer, Fehler), dann Systeme/APIs. Frage Budget erst, wenn Vertrauen da ist. Fasse zusammen, bevor du eine Lösung skizzierst.', proposal: 'Prüfe: Löst du das tatsächlich wichtigste Problem? Ist die Anbindung zur Schnittstellenlage passend? Sind Datenschutz und Freigaben vorgesehen? Passt der Preis zum Nutzen und zum Budgetrahmen?', browser: 'Schau in Karriere, News, Kontakt und Referenzen – Stellenanzeigen verraten manuelle Arbeit, Kontaktseiten verraten Kanäle. Hinweise sind Hypothesen, keine Beweise.', project: 'Plane Puffer, halte den Kunden informiert und entscheide bei Vorfällen nach Ursache, nicht nach Aufwand.' };
  return H[ctx] || '';
}
