// Einstieg: Onboarding, Desktop-Shell (Leiste, Dock, Benachrichtigungen, Einstellungen)
import * as store from './store.js';
import { S, load, init, wipe, hooks, emit, notify } from './store.js';
import { endDay, makeLead, deliver } from './sim.js';
import { getCo, STATIC, allCo } from './companies.js';
import { BG, CAMP } from './arch.js';
import { esc, ic, eur, fmtLong, fmtDate, initials } from './util.js';
import { APPS, registerApp, openApp, modal, toast, bind, $, refreshDock, alertBox, appApi } from './ui.js';
import dashboard from './apps/dashboard.js'; import browser from './apps/browser.js'; import directory from './apps/directory.js'; import mail from './apps/mail.js'; import crm from './apps/crm.js';
import calendar from './apps/calendar.js'; import projects from './apps/projects.js'; import finance from './apps/finance.js'; import kb from './apps/kb.js'; import profile from './apps/profile.js'; import call from './apps/call.js'; import proposal from './apps/proposal.js';
[dashboard, browser, directory, mail, crm, calendar, projects, finance, kb, profile, call, proposal].forEach(registerApp);
const DOCK = ['dashboard', 'browser', 'directory', 'mail', 'crm', 'calendar', 'projects', 'finance', 'kb', 'profile'];
hooks.toast = (t, k) => toast(t, k === 'good' ? 'good' : k === 'bad' ? 'bad' : k === 'warn' ? 'warn' : '');
window.__game = { store, openApp };

function shell() {
  $('#root').innerHTML = `<div class="bar"><div class="brand"><span class="mark" id="mk"></span><span class="hide-s" id="bn"></span></div><span class="sp"></span><span class="pill hide-s" id="pd"></span><span class="pill" id="ph" title="Verbleibende Arbeitsstunden heute"></span><span class="pill" id="pc" title="Kontostand"></span><button class="btn p" id="eod">${ic('clock', 15)}<span class="hide-s">Tag beenden</span><span class="show-s">Tag</span></button><button class="btn g" id="bell" aria-label="Benachrichtigungen">${ic('bell', 17)}<span class="tag bad" id="bb" style="display:none"></span></button><button class="btn g" id="menu" aria-label="Menü">${ic('cog', 17)}</button></div>
  <nav class="dock">${DOCK.map(id => `<button class="dk" data-app="${id}" data-tip="${APPS[id].n}" aria-label="${APPS[id].n}">${ic(APPS[id].ic, 20)}<span class="bd" id="b-${id}" style="display:none"></span></button>`).join('')}</nav><main class="desk"></main>`;
  $('.dock').addEventListener('click', e => { const b = e.target.closest('.dk'); if (b) openApp(b.dataset.app); });
  $('#eod').onclick = endDayUI; $('#bell').onclick = e => { e.stopPropagation(); togglePop(notifPop); }; $('#menu').onclick = e => { e.stopPropagation(); togglePop(menuPop); };
  document.addEventListener('click', () => $('.pop')?.remove());
  document.addEventListener('shell:update', update); update();
}
function update() {
  if (!S) return; const co = S.me.co; $('#mk').textContent = initials(co.name).slice(0, 2); $('#mk').style.background = S.me.logo; $('#bn').textContent = `${co.name} · ${S.me.name}`;
  $('#pd').innerHTML = `${ic('cal', 13)} <b>${fmtLong(S.day)}</b> · Tag ${S.day + 1}`; $('#ph').innerHTML = `${ic('clock', 13)} <b>${S.hours.toFixed(1).replace('.', ',')} h</b><span class="hbar"><i style="width:${Math.max(0, Math.min(100, S.hours / 8 * 100))}%"></i></span>`; $('#pc').innerHTML = `${ic('euro', 13)} <b class="${S.cash < 0 ? 'bad' : ''}">${eur(S.cash)}</b>`;
  const un = S.notif.filter(n => !n.read).length; const bb = $('#bb'); bb.style.display = un ? '' : 'none'; bb.textContent = un;
  const badge = (id, n) => { const e = $('#b-' + id); if (e) { e.style.display = n ? '' : 'none'; e.textContent = n; } };
  badge('mail', S.emails.filter(m => m.f === 'in' && !m.rd).length); badge('calendar', S.meetings.filter(m => m.d === S.day && !m.done).length); badge('projects', S.projects.reduce((s, p) => s + p.pend.length, 0));
  refreshDock(); if (S.over && !document.querySelector('[data-over]')) showOver();
}
function togglePop(fn) { const ex = $('.pop'); if (ex) { ex.remove(); return; } const d = document.createElement('div'); d.className = 'pop'; d.onclick = e => e.stopPropagation(); fn(d); $('.desk').appendChild(d); }
function notifPop(d) {
  S.notif.forEach(n => n.read = 1); const items = S.notif.slice(0, 30); emit();
  d.innerHTML = `<div class="pad b">Benachrichtigungen</div>${items.length ? `<div class="list">${items.map((n, i) => `<div class="it" data-i="${i}"><div class="sp"><div class="sm">${esc(n.t)}</div><div class="xs mut3">${fmtDate(n.d)}</div></div></div>`).join('')}</div>` : '<div class="empty">Noch nichts.</div>'}`;
  d.onclick = e => { const it = e.target.closest('.it'); if (it) { const n = items[+it.dataset.i]; if (n.app && APPS[n.app]) openApp(n.app); d.remove(); } e.stopPropagation(); };
}
function menuPop(d) {
  d.style.width = '260px'; d.innerHTML = `<div class="nav" style="padding:6px"><button data-a="hints">${ic('bulb', 16)} Hinweise ${S.hints ? 'ausblenden' : 'anzeigen'}</button><button data-a="exp">${ic('file', 16)} Spielstand exportieren</button><button data-a="imp">${ic('folder', 16)} Spielstand importieren</button><button data-a="about">${ic('shield', 16)} Über die Simulation</button><button data-a="reset" class="bad">${ic('refresh', 16)} Neu starten</button></div>`;
  bind(d, { hints() { S.hints = !S.hints; emit(); d.remove(); }, exp() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = `the-consultant-tag${S.day + 1}.json`; a.click(); d.remove(); },
    imp() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async () => { try { store.importSave(await i.files[0].text()); location.reload(); } catch (e) { alertBox('Fehler', 'Datei ungültig.'); } }; i.click(); d.remove(); },
    about() { d.remove(); alertBox('Über THE CONSULTANT', '<p>Business-Simulation für angehende KI- & Automatisierungsberater:innen. <b>Alle Unternehmen, Personen, Systeme, Domains (.example) und Zahlen sind frei erfunden</b> und stellen keine realen Informationen dar. Kein echter Kontakt zu realen Unternehmen findet statt. Spielstand wird lokal im Browser gespeichert.</p><p class="mut">Zahlen sind netto, ohne Steuern. Einsparungen werden nie garantiert.</p>'); },
    reset() { d.remove(); modal({ title: 'Neu starten?', html: '<p>Der aktuelle Spielstand wird gelöscht.</p>', actions: [{ t: 'Abbrechen' }, { t: 'Löschen & neu starten', cls: 'd', fn() { wipe(); location.reload(); } }] }); } });
}
function endDayUI() {
  const go = () => { endDay(); toast(`Neuer Tag: ${fmtLong(S.day)}`); };
  const open = S.meetings.filter(m => m.d === S.day && !m.done);
  if (open.length) modal({ title: 'Termin heute offen', html: `<p>Du hast heute noch ${open.length} Termin(e) nicht wahrgenommen: ${open.map(m => esc(getCo(m.co).n)).join(', ')}. Wenn du den Tag beendest, gilt das als Nichterscheinen (Vertrauens- und Reputationsverlust).</p>`, actions: [{ t: 'Abbrechen' }, { t: 'Trotzdem beenden', cls: 'd', fn: go }] });
  else go();
}
function showOver() {
  const m = modal({ title: 'Insolvenz', noX: true, html: `<p>Dein Konto ist tief im Minus (${eur(S.cash)}), das Unternehmen ist zahlungsunfähig. Das passiert vielen Gründungen – meist, weil Einnahmen zu spät kommen oder Kosten unterschätzt werden.</p><div class="fbs m"><h4>Lessons Learned</h4><ul>${S.lessons.slice(0, 5).map(l => `<li>${esc(l.t)}</li>`).join('') || '<li>Zu wenig Umsatz in der Anfangsphase – kleine, bezahlte Piloten früher abschließen.</li>'}</ul></div>`, actions: [{ t: 'Neu starten', cls: 'p', fn() { wipe(); location.reload(); } }] }); m.el.dataset.over = 1;
}

// ---------- Onboarding ----------
const STARTS = ['rheinfracht', 'kaffeebrenner', 'schmidmetall', 'berger', 'talentbruecke', 'hellmann'];
function onboarding() {
  const ob = document.createElement('div'); ob.className = 'ob'; document.body.appendChild(ob); const f = { name: '', age: 31, company: '', bg: 'mix' }; let step = 0;
  const draw = () => {
    if (step === 0) ob.innerHTML = `<div class="box"><div class="row mb"><span class="mark">TC</span><b>THE CONSULTANT</b></div><h1>Gründe deine KI- & Automatisierungsberatung.</h1><p class="mut" style="max-width:620px;margin-bottom:22px">Du startest als Einzelberater:in in Deutschland – mit 1.500 € Startkapital, ohne Kunden und mit begrenzter Erfahrung. Du recherchierst Unternehmen, sprichst mit Entscheidern, analysierst Prozesse, verkaufst, baust und betreibst Lösungen. Fehler haben Folgen. <b>Alle Unternehmen sind fiktiv.</b></p><div class="g2"><label class="f"><span>Dein Name</span><input id="n" value="${esc(f.name)}" placeholder="z. B. Alex Morgenstern" maxlength="40"></label><label class="f"><span>Alter</span><input id="a" type="number" min="18" max="70" value="${f.age}"></label></div><label class="f"><span>Name deiner Beratung</span><input id="c" value="${esc(f.company)}" placeholder="z. B. Flowwerk Automation" maxlength="40"></label><div class="f"><span class="mut">Dein Hintergrund</span><div class="g3 mt">${Object.entries(BG).map(([k, b]) => `<div class="opt ${f.bg === k ? 'on' : ''}" data-bg="${k}"><b>${b.n}</b><p class="mut sm" style="margin:4px 0 0">${b.d}</p></div>`).join('')}</div></div><div class="row mt"><span class="sp"></span><button class="btn p" id="nx">Weiter ${ic('arrow', 15)}</button></div></div>`;
    if (step === 1) ob.innerHTML = `<div class="box"><h1>Deine Ausgangslage</h1><p class="mut mb">${esc(f.company)} ist gegründet. Das ist deine Situation:</p><div class="g4 mb"><div class="kpi"><div class="l">Startkapital</div><div class="v">1.500 €</div></div><div class="kpi"><div class="l">Fixkosten</div><div class="v">68 €</div><div class="s">pro Monat (Software, Haftpflicht)</div></div><div class="kpi"><div class="l">Kunden</div><div class="v">0</div></div><div class="kpi"><div class="l">Reputation</div><div class="v">10</div><div class="s">von 100</div></div></div><div class="card mb"><h3>Spielregeln in Kürze</h3><ul class="mut" style="margin:0;padding-left:18px;line-height:1.8"><li>Du hast pro Tag <b>8 Arbeitsstunden</b>. Gespräche, E-Mails und Projektarbeit kosten Zeit.</li><li>Websites verraten Hinweise – <b>keine Beweise</b>. Gespräche decken die Wahrheit auf.</li><li>Nicht jedes Unternehmen ist ein guter Kunde. <b>Ehrlich abzuraten ist erlaubt</b> – und manchmal klug.</li><li>Fällt dein Konto unter −500 €, bist du insolvent. Zahlungen kommen oft erst nach 30–60 Tagen.</li><li>Hinweise gibt es nur auf Wunsch (Glühbirnen-Symbole).</li></ul></div><div class="row"><button class="btn" id="bk">Zurück</button><span class="sp"></span><button class="btn p" id="nx">Desktop öffnen ${ic('arrow', 15)}</button></div></div>`;
    if (step === 2) ob.innerHTML = `<div class="box"><h1>Wo möchtest du anfangen?</h1><p class="mut mb">Sechs mögliche Einstiege aus verschiedenen Branchen. Es gibt insgesamt ${STATIC.length} Unternehmen im Verzeichnis – die anderen bleiben verfügbar. Interne Abläufe kennst du noch nicht.</p><div class="gA">${STARTS.map(id => { const c = getCo(id); return `<div class="opt" data-co="${id}"><span class="tag ac">${CAMP[c.camp].n}</span><h3 style="margin:8px 0 2px">${esc(c.n)}</h3><div class="sm mut">${esc(c.i)} · ${esc(c.city)} · ${c.e} Mitarbeitende</div><p class="sm mut3 mt" style="margin:8px 0 0">„${esc(c.tag)}“</p></div>`; }).join('')}</div><div class="row mt"><button class="btn" id="bk">Zurück</button><span class="sp"></span><button class="btn" id="free">Selbst im Verzeichnis suchen</button></div></div>`;
    ob.querySelectorAll('[data-bg]').forEach(e => e.onclick = () => { f.name = $('#n', ob).value; f.company = $('#c', ob).value; f.age = +$('#a', ob).value; f.bg = e.dataset.bg; draw(); });
    const nx = $('#nx', ob), bk = $('#bk', ob);
    if (nx) nx.onclick = () => { if (step === 0) { f.name = $('#n', ob).value.trim(); f.company = $('#c', ob).value.trim(); f.age = clampAge($('#a', ob).value); if (!f.name || !f.company) { toast('Bitte Namen und Firmennamen eingeben.', 'warn'); return; } } step++; draw(); };
    if (bk) bk.onclick = () => { step--; draw(); };
    ob.querySelectorAll('[data-co]').forEach(e => e.onclick = () => finish(e.dataset.co)); const fr = $('#free', ob); if (fr) fr.onclick = () => finish(null);
  };
  const clampAge = v => Math.max(18, Math.min(70, +v || 30));
  const finish = (coId) => {
    init({ ...f }); S.hints = true; S.started = true; ob.remove(); shell();
    deliver({ fn: 'Lena Ostermann (Gründungslotsin)', from: 'lotsin@gruenderhilfe.example', to: 'ich', subj: 'Willkommen – deine ersten Schritte', body: `Hallo ${S.me.name.split(' ')[0]},\n\nherzlichen Glückwunsch zur Gründung von ${S.me.co.name}! Ein paar Gedanken aus meiner Erfahrung:\n\n• Du hast 1.500 € und kein Auftragsbuch. Dein erster Auftrag wird klein sein – ein bezahlter Pilot.\n• Gute Beratung beginnt mit Fragen, nicht mit Lösungen. Schau dir Websites, Karriereseiten und Kontaktwege genau an – aber behandle alles als Hypothese.\n• Nicht jedes Unternehmen braucht dich. Das früh zu erkennen, spart Zeit.\n\nViel Erfolg!\nLena`, kind: 'info' });
    if (coId) { makeLead(coId); S.co[coId].seen = 1; }
    emit(); openApp('dashboard'); openApp('mail'); appApi('mail')?.go?.('first');
    if (coId) openApp('browser', { co: coId }); else openApp('directory');
    notify('Willkommen! Öffne die Website des Unternehmens und recherchiere.', 'browser');
  };
  draw();
}
if (load()) { if (S.started) { shell(); openApp('dashboard'); } else onboarding(); } else onboarding();
