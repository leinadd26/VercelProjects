import { S, cs, emit, uid, notify, gain, addRep, addTrust, lesson } from '../store.js';
import { getCo, allCo, addrOf, dm, wf } from '../companies.js';
import { sendMail, slotsFor, bookMeeting, makeLead, qAdd } from '../sim.js';
import { handleOutreach, handleAnswer, techReply, evalOutreach, startFromMail, negotiate, hint, evalAnswer } from '../sales.js';
import { createProject } from '../proj.js';
import { TPL, PERS } from '../arch.js';
import { esc, ic, fmtDate, fmtLong, eur, clamp } from '../util.js';
import { bind, modal, toast, feedback, alertBox, openApp, appApi } from '../ui.js';

const ATT = ['Leistungsportfolio.pdf', 'Datenschutzkonzept.pdf', 'Prozess-Check-Ablauf.pdf'];
export default { id: 'mail', n: 'E-Mail', ic: 'mail', w: 1080, h: 680, nopad: true, create(root) {
  let folder = 'in', sel = null, q = '', cmp = null, hintOn = false;
  const FN = { in: 'Posteingang', sent: 'Gesendet', draft: 'Entwürfe', arch: 'Archiv' };
  const list = () => S.emails.filter(m => m.f === folder && (!q || `${m.subj} ${m.body} ${m.fn}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.n - a.n);
  const book = m => { const co = getCo(m.co), ct = co.cn[m.ct], sl = slotsFor(co, ct);
    modal({ title: `Termin mit ${esc(ct.name)}`, html: `<p class="mut sm">Verfügbare Zeiten (${esc(PERS[ct.p].n)}). Das Gespräch dauert voraussichtlich ca. ${Math.max(20, Math.round(45 * PERS[ct.p].time / 5) * 5)} Minuten.</p><div class="row w">${sl.map((s, i) => `<span class="chip" data-s="${i}">${fmtLong(s.d)} · ${s.h}:00</span>`).join('')}</div>`,
      init(ov, close) { ov.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { const s = sl[+c.dataset.s], r = bookMeeting({ co: m.co, ct: m.ct, d: s.d, h: s.h }); if (!r) return toast('Zeit bereits belegt.', 'warn'); const a = m.act.find(x => x.a === 'book'); if (a) a.done = 1; close(); emit(); toast(`Termin gebucht: ${fmtLong(s.d)}, ${s.h}:00`, 'good'); }); } }); };
  const actions = {
    book: m => book(m),
    start: (m, a) => { const p = startFromMail(m); if (!p) return toast('Projekt bereits gestartet.', 'warn'); a.done = 1; emit(); modal({ title: 'Projekt gestartet', html: `<p><b>${esc(p.name)}</b> bei ${esc(getCo(p.co).n)} – ${eur(p.price)}, Frist ${fmtDate(p.dl)}.</p><p class="mut sm">Die Anzahlungsrechnung kannst du unter Finanzen/Projekte stellen. Plane deine Stunden und halte den Kunden informiert.</p>`, actions: [{ t: 'Projekte öffnen', cls: 'p', fn() { openApp('projects', p.id); } }] }); },
    neg_accept: (m, a) => neg(m, a, 'neg_accept'), neg_pilot: (m, a) => neg(m, a, 'neg_pilot'), neg_hold: (m, a) => neg(m, a, 'neg_hold'), neg_drop: (m, a) => neg(m, a, 'neg_drop'),
    neg_counter: (m, a) => modal({ title: 'Gegenvorschlag', html: `<p class="mut sm">Aktuelles Angebot: ${eur(m.prop.price)}. Kunde bietet bis ${eur(m.neg.max)}.</p><label class="f"><span>Dein Preis (€ netto)</span><input id="cp" type="number" value="${Math.round((m.prop.price + m.neg.max) / 2)}"></label>`, actions: [{ t: 'Abbrechen' }, { t: 'Senden', cls: 'p', fn: ov => neg(m, a, 'neg_counter', +ov.querySelector('#cp').value) }] }),
    gigyes: (m, a) => { const co = getCo(m.co); const p = createProject(co, { comps: a.comps.split(' '), weeks: 2, price: a.pay, terms: 0, pilot: 0 }, { gig: 1, title: a.title, h: a.h }); a.done = 1; m.done = 1; emit(); toast(`Kleinauftrag angenommen: ${eur(a.pay)}`, 'good'); openApp('projects', p.id); },
    gigbad: (m, a) => { const co = getCo(m.co); const p = createProject(co, { comps: ['rules'], weeks: 1, price: 300, terms: 0 }, { gig: 1, title: 'KI für alles', h: 30 }); p.sat = 40; a.done = 1; m.done = 1; lesson('Unrealistischer Auftrag (300 € für „KI für alles“) angenommen: Scope und Preis vorher klären.'); emit(); },
    gigno: (m, a) => { a.done = 1; m.done = 1; gain('Kommunikation', .3); emit(); toast('Höflich abgesagt. Gute Entscheidung bei unrealistischen Anfragen.'); },
  };
  function neg(m, a, move, val) { const r = negotiate(m, move, val); a.done = 1; emit(); if (r) feedback({ title: 'Verhandlung', real: [r.f], next: 'Warte auf die Antwort des Kunden im Posteingang.' }); }
  function ctxFrom(addr) {
    addr = addr.trim().toLowerCase(); for (const co of allCo()) { if (addr === `info@${co.mail}`) return { co: co.id, ct: null }; for (const ct of co.cn) if (addr === addrOf(co, ct)) return { co: co.id, ct: ct.i }; } return null;
  }
  const hasAddr = () => { const r = []; for (const co of allCo()) { const c = S.co[co.id]; if (!c) continue; if (c.seen || c.lead) { r.push([`info@${co.mail}`, `${co.n} (Sammeladresse)`]); (c.knownC || []).forEach(i => r.push([addrOf(co, co.cn[i]), `${co.cn[i].name}, ${co.n}`])); } } return r; };
  function compose(o = {}) { cmp = { to: o.to || '', subj: o.subj || '', body: o.body || '', att: [], replyTo: o.replyTo || null, th: o.th || null, kind: o.kind || '' }; sel = null; folder = 'in'; render(); }
  function sendNow() {
    const m = cmp, tgt = ctxFrom(m.to); if (!m.to.trim() || !m.subj.trim() || !m.body.trim()) return toast('Empfänger, Betreff und Text ausfüllen.', 'warn');
    if (!tgt) { sendMail({ co: null, to: m.to, subj: m.subj, body: m.body, th: m.th, att: m.att }); cmp = null; emit(); return toast('Die Adresse gehört zu keinem Unternehmen in der Simulation – die Mail verhallt.', 'warn'); }
    const co = getCo(tgt.co), ct = tgt.ct != null ? co.cn[tgt.ct] : null, orig = m.replyTo && S.emails.find(x => x.id === m.replyTo), sent = sendMail({ co: co.id, ct: tgt.ct, to: m.to, subj: m.subj, body: m.body, th: m.th, att: m.att });
    if (m.att.includes('Datenschutzkonzept.pdf') && orig?.ask === 'sec') sent.body += ' (Anhang: AVV, EU-Hosting, Verschlüsselung, Secrets-Vault, Löschfristen, Datenschutz)';
    cmp = null; let fb = null;
    if (orig && orig.ask && orig.f === 'in' && !orig.ans) { orig.ans = 1; const r = handleAnswer(sent, orig); fb = { title: 'Antwort auf Rückfrage', good: r.ok >= .5 ? [r.note] : [], miss: r.ok < .5 ? [r.note] : [], real: ['Rückfragen sind Kaufsignale – aber auch Prüfungen deiner Glaubwürdigkeit.'] }; }
    else if (orig?.kind === 'complaint') { const L = m.body.toLowerCase(), n = [/entschuldig|bedauer|leid/, /ursache|grund/, /maßnahme|lösung|beheb|korrigier/, /zeitplan|bis (zum )?\d|morgen|heute|termin/].filter(r => r.test(L)).length, p = S.projects.find(x => x.id === orig.pid); if (p) { p.sat = clamp(p.sat + n * 2.5 - 1, 0, 100); gain('Kommunikation', n * .4); } fb = { title: 'Reaktion auf Beschwerde', good: n >= 3 ? ['Entschuldigung, Ursache, Maßnahme und Zeitplan – so beruhigt man Kunden.'] : [], miss: n < 3 ? ['Eine gute Antwort enthält: Entschuldigung, Ursache, konkrete Maßnahme und verbindlichen Zeitplan.'] : [] }; }
    else if (ct && techReply(sent, co, ct)) { toast('Der technische Ansprechpartner antwortet morgen.', 'good'); }
    else if (['interessiert', 'discovery', 'angebot', 'verhandlung', 'gewonnen'].includes(cs(co.id).stage) && cs(co.id).replied) { addTrust(co.id, m.body.length > 200 ? 2 : 0); gain('Kommunikation', .2); }
    else { const ev = handleOutreach(sent, co, ct); fb = { title: 'Qualität deiner Ansprache', score: ev.sc, sum: ev.sc >= 70 ? 'Gute Chancen auf eine Antwort.' : ev.sc >= 50 ? 'Durchschnittlich – eine Antwort ist möglich.' : 'Schwach – die Mail wird wahrscheinlich ignoriert.', good: ev.pts.filter(p => p.ok && p.t).map(p => p.t), miss: ev.pts.filter(p => !p.ok).map(p => p.t), next: 'Antworten kommen in den nächsten Tagen. Nutze die Zeit für weitere Recherche.' }; }
    emit(); if (fb) feedback(fb);
  }
  bind(root, {
    folder(d) { folder = d.f; sel = null; cmp = null; render(); }, sel(d) { sel = d.id; cmp = null; const m = S.emails.find(x => x.id === d.id); if (m) m.rd = 1; emit(); },
    q(v) { q = v; render(); }, new() { compose(); }, hint() { hintOn = !hintOn; render(); },
    reply(d) { const m = S.emails.find(x => x.id === d.id); compose({ to: m.f === 'sent' ? m.to : m.from, subj: m.subj.startsWith('Re:') ? m.subj : 'Re: ' + m.subj, body: `\n\n\n— Am ${fmtDate(m.d)} schrieb ${m.fn}:\n${m.body.split('\n').map(l => '> ' + l).join('\n')}`, replyTo: m.id, th: m.th }); },
    fwd(d) { const m = S.emails.find(x => x.id === d.id); compose({ subj: 'Fwd: ' + m.subj, body: `\n\n— Weitergeleitet:\n${m.body}` }); },
    arch(d) { const m = S.emails.find(x => x.id === d.id); m.f = m.f === 'arch' ? 'in' : 'arch'; sel = null; emit(); },
    fu(d) { const m = S.emails.find(x => x.id === d.id); if (m.co) { cs(m.co).fu = S.day + 3; emit(); toast('Wiedervorlage in 3 Tagen im CRM gesetzt.', 'good'); } },
    act(d) { const m = S.emails.find(x => x.id === d.id), a = m.act[+d.i]; if (a.done) return; actions[a.a] ? actions[a.a](m, a) : null; },
    tpl(v) { if (!v) return; const t = TPL.find(x => x.id === v), co = cmp.to && ctxFrom(cmp.to), c = co && getCo(co.co), ct = c && co.ct != null ? c.cn[co.ct] : null; const fill = s => s.replace('{anrede}', ct ? `${ct.f ? 'Frau' : 'Herr'} ${ct.name.split(' ').pop()}` : 'Damen und Herren').replace('{name}', S.me.name).replace('{firma}', S.me.co.name).replace('{beobachtung}', '… [hier deine konkrete Beobachtung einfügen]'); cmp.subj = cmp.subj || fill(t.s); cmp.body = fill(t.b); render(); },
    to(v) { cmp.to = v; }, subj(v) { cmp.subj = v; }, body(v) { cmp.body = v; }, att(v, el) { const a = el.dataset.n; cmp.att = el.checked ? [...new Set([...cmp.att, a])] : cmp.att.filter(x => x !== a); },
    send() { sendNow(); }, draft() { const m = sendMail; S.emails.push({ id: uid('m'), n: S.uid, f: 'draft', fn: S.me.name, to: cmp.to, subj: cmp.subj || '(ohne Betreff)', body: cmp.body, d: S.day, rd: 1, att: cmp.att, act: [] }); cmp = null; folder = 'draft'; emit(); }, discard() { cmp = null; render(); },
    open_draft(d) { const m = S.emails.find(x => x.id === d.id); S.emails.splice(S.emails.indexOf(m), 1); compose({ to: m.to, subj: m.subj, body: m.body }); },
  });
  function render() {
    const L = list(), thread = sel ? S.emails.filter(x => x.th && x.th === S.emails.find(y => y.id === sel)?.th).sort((a, b) => a.n - b.n) : [], cur = sel && S.emails.find(x => x.id === sel);
    const cnt = f => S.emails.filter(m => m.f === f && (f !== 'in' || !m.rd)).length;
    root.innerHTML = `<div class="split" style="grid-template-columns:168px 310px 1fr"><div class="sb nav" style="padding:10px 8px"><button class="btn p" data-a="new" style="width:100%;justify-content:center;margin-bottom:8px">${ic('plus', 15)} Neue E-Mail</button>${Object.entries(FN).map(([k, n]) => `<button class="${folder === k ? 'on' : ''}" data-a="folder" data-f="${k}">${ic(k === 'in' ? 'inbox' : k === 'sent' ? 'send' : k === 'draft' ? 'file' : 'folder', 16)} ${n}<span class="sp"></span>${k === 'in' && cnt('in') ? `<span class="tag ac">${cnt('in')}</span>` : ''}</button>`).join('')}</div>
    <div class="sb"><div style="padding:8px"><input data-i="q" data-k="q" value="${esc(q)}" placeholder="Suchen …"></div><div class="list" data-sc="l">${L.map(m => `<div class="it ${m.id === sel ? 'sel' : ''} ${m.f === 'in' && !m.rd ? 'un' : ''}" data-a="${m.f === 'draft' ? 'open_draft' : 'sel'}" data-id="${m.id}"><div class="sp" style="min-width:0"><div class="row"><span class="tt tr sp">${esc(m.f === 'sent' || m.f === 'draft' ? 'An: ' + (getCtxName(m.to)) : m.fn)}</span><span class="xs mut3">${fmtDate(m.d, { day: '2-digit', month: '2-digit' })}</span></div><div class="tr sm">${esc(m.subj)}</div><div class="tr xs mut3">${esc(m.body.replace(/\s+/g, ' ').slice(0, 70))}</div></div></div>`).join('') || `<div class="empty">Keine Nachrichten.</div>`}</div></div>
    <div data-sc="r" style="padding:16px">${cmp ? composeView() : cur ? readView(thread, cur) : '<div class="empty">Wähle eine Nachricht oder schreibe eine neue E-Mail.</div>'}</div></div>`;
  }
  const getCtxName = a => { const c = ctxFrom(a || ''); if (!c) return a; const co = getCo(c.co); return c.ct != null ? co.cn[c.ct].name : co.n; };
  function readView(thread, cur) {
    const last = [...thread].reverse().find(m => m.f === 'in'), acts = last && last.act.length && !last.done ? last.act.map((a, i) => ({ a, i })).filter(x => !x.a.done) : [];
    return `<div class="row mb"><h2 class="sp">${esc(cur.subj)}</h2><button class="btn s" data-a="reply" data-id="${cur.id}">${ic('send', 13)} Antworten</button><button class="btn s" data-a="fwd" data-id="${cur.id}">Weiterleiten</button>${cur.co ? `<button class="btn s" data-a="fu" data-id="${cur.id}" title="Follow-up in 3 Tagen">${ic('clock', 13)} Wiedervorlage</button>` : ''}<button class="btn s g" data-a="arch" data-id="${cur.id}">${cur.f === 'arch' ? 'Zurück' : 'Archivieren'}</button></div>
    ${thread.map(m => `<div class="msg ${m.f === 'sent' ? 'me' : ''}"><div class="row sm mut mb" style="margin-bottom:6px"><b>${esc(m.fn)}</b><span class="mut3 xs">&lt;${esc(m.from || m.to)}&gt;</span><span class="sp"></span><span class="xs">${fmtDate(m.d)}</span></div>${esc(m.body)}${m.att?.length ? `<div class="row w mt">${m.att.map(a => `<span class="tag">${ic('clip', 11)} ${esc(a)}</span>`).join('')}</div>` : ''}</div>`).join('')}
    ${acts.length ? `<div class="row w mt">${acts.map(({ a, i }) => `<button class="btn p" data-a="act" data-id="${last.id}" data-i="${i}">${esc(a.t)}</button>`).join('')}</div>` : ''}`;
  }
  function composeView() {
    return `<div class="row mb"><h2 class="sp">${cmp.replyTo ? 'Antwort verfassen' : 'Neue E-Mail'}</h2>${S.hints ? `<button class="btn s g" data-a="hint">${ic('bulb', 14)} Tipp</button>` : ''}<select data-c="tpl" style="width:190px"><option value="">Vorlage einfügen …</option>${TPL.map(t => `<option value="${t.id}">${t.n}</option>`).join('')}</select></div>${hintOn ? `<div class="card mb sm">${esc(hint('mail'))}</div>` : ''}
    <label class="f"><span>An</span><input data-i="to" data-k="to" list="addr" value="${esc(cmp.to)}" placeholder="Adresse (nur bekannte Kontakte oder Sammeladressen)"><datalist id="addr">${hasAddr().map(([a, n]) => `<option value="${a}">${esc(n)}</option>`).join('')}</datalist></label>
    <label class="f"><span>Betreff</span><input data-i="subj" data-k="subj" value="${esc(cmp.subj)}"></label><label class="f"><span>Nachricht</span><textarea data-i="body" data-k="body" style="min-height:260px">${esc(cmp.body)}</textarea></label>
    <div class="row w mb"><span class="mut sm">Anhänge:</span>${ATT.map(a => `<label class="row sm"><input type="checkbox" data-c="att" data-n="${a}" ${cmp.att.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div>
    <div class="row"><button class="btn p" data-a="send">${ic('send', 14)} Senden</button><button class="btn" data-a="draft">Entwurf speichern</button><button class="btn g" data-a="discard">Verwerfen</button><span class="sp"></span><span class="xs mut3">${cmp.body.length} Zeichen</span></div>`;
  }
  return { render, busy: () => !!cmp, go(a) { if (a?.compose) compose(a.compose); else if (a?.to) compose({ to: a.to, subj: a.subj || '' }); else if (a && a !== 'first') { folder = 'in'; sel = a; const m = S.emails.find(x => x.id === a); if (m) m.rd = 1; } }, destroy() { } };
} };
