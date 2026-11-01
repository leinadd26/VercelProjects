import { S, cs, emit, notify, ledger, useHours, gain, pick, rnd, chance } from '../store.js';
import { allCo, isLocked, visible, getCo } from '../companies.js';
import { STAGE_N, makeLead } from '../sim.js';
import { CAMP } from '../arch.js';
import { esc, ic } from '../util.js';
import { bind, openApp, appApi, toast, alertBox } from '../ui.js';

export default { id: 'directory', n: 'Verzeichnis', ic: 'building', w: 1020, h: 660, create(root) {
  let tab = 'dir', f = { q: '', camp: '', size: '', mat: '' };
  const dots = n => '●'.repeat(n) + '<span class="mut3">' + '●'.repeat(5 - n) + '</span>';
  const list = () => allCo().filter(c => visible(c)).filter(c => (!f.q || `${c.n} ${c.i} ${c.city}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.camp || c.camp === f.camp) && (!f.size || (f.size === 's' ? c.e <= 20 : f.size === 'm' ? c.e > 20 && c.e <= 60 : c.e > 60)) && (!f.mat || c.mat === +f.mat));
  bind(root, {
    tab(d) { tab = d.t; render(); }, q(v) { f.q = v; render(); }, camp(v) { f.camp = v; render(); }, size(v) { f.size = v; render(); }, mat(v) { f.mat = v; render(); },
    web(d) { openApp('browser', { co: d.id }); }, lead(d) { makeLead(d.id); emit(); toast('Als Lead gespeichert.', 'good'); }, crm(d) { openApp('crm', d.id); },
    pcamp(d) { f.camp = d.k; tab = 'dir'; render(); }, jobs() { openApp('browser', { jobs: 1 }); },
    net() {
      if (S.day - S.lastNet < 7) return alertBox('Zu früh', '<p>Du warst erst kürzlich auf einer Veranstaltung. Vernetzen braucht Kontinuität – aber nicht jeden Tag. Nächster Termin in ' + (7 - (S.day - S.lastNet)) + ' Tagen.</p>');
      if (S.cash < 25) return toast('Nicht genug Geld.', 'warn');
      ledger('exp', 'Networking', 25, 'Unternehmerstammtisch'); useHours(3); S.lastNet = S.day; gain('Vertrieb', .8); gain('Kommunikation', .5);
      const lk = allCo().filter(c => c.lock === 'net' && !cs(c.id).seen); let msg = 'Netter Abend, aber keine konkreten Kontakte.';
      if (lk.length && chance(.75)) { const c = pick(lk); cs(c.id).seen = 1; msg = `Du hast ${c.n} (${c.city}) kennengelernt – jetzt im Verzeichnis.`; notify(msg, 'directory', 'good'); }
      emit(); alertBox('Unternehmerstammtisch', `<p>${esc(msg)}</p><p class="mut sm">−25 €, −3 Stunden.</p>`);
    } });
  function render() {
    const rows = list(), cn = Object.keys(CAMP);
    root.innerHTML = `<div class="tabs"><button class="${tab === 'dir' ? 'on' : ''}" data-a="tab" data-t="dir">Verzeichnis (${allCo().filter(visible).length})</button><button class="${tab === 'camp' ? 'on' : ''}" data-a="tab" data-t="camp">Kampagnen</button><button class="${tab === 'net' ? 'on' : ''}" data-a="tab" data-t="net">Entdecken & Netzwerk</button></div>
    ${tab === 'dir' ? `<div class="row w pad" style="padding-bottom:8px"><div style="flex:1;min-width:180px"><input data-i="q" data-k="q" value="${esc(f.q)}" placeholder="Suche: Name, Branche, Ort …"></div><select data-c="camp" style="width:190px"><option value="">Alle Kampagnen</option>${cn.map(k => `<option value="${k}" ${f.camp === k ? 'selected' : ''}>${CAMP[k].n}</option>`).join('')}</select><select data-c="size" style="width:130px"><option value="">Alle Größen</option><option value="s" ${f.size === 's' ? 'selected' : ''}>bis 20 MA</option><option value="m" ${f.size === 'm' ? 'selected' : ''}>21–60 MA</option><option value="l" ${f.size === 'l' ? 'selected' : ''}>über 60 MA</option></select><select data-c="mat" style="width:150px"><option value="">Digitalreife</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${f.mat == n ? 'selected' : ''}>Stufe ${n}</option>`).join('')}</select></div>
    <div data-sc="t" style="overflow:auto;height:calc(100% - 100px)"><table class="tbl"><thead><tr><th>Unternehmen</th><th>Branche</th><th>Ort</th><th>MA</th><th title="Öffentlich geschätzte Digitalreife">Digital</th><th>Phase</th><th></th></tr></thead><tbody>${rows.map(c => { const k = S.co[c.id]; return `<tr><td><b>${esc(c.n)}</b><div class="xs mut3">${CAMP[c.camp].n}</div></td><td class="sm">${esc(c.i)}</td><td class="sm">${esc(c.city)}</td><td class="sm">${c.e}</td><td class="xs" style="color:var(--ac);letter-spacing:1px">${dots(c.mat)}</td><td>${k?.lead ? `<span class="tag ac">${STAGE_N[k.stage]}</span>` : '<span class="mut3 xs">–</span>'}</td><td class="r" style="white-space:nowrap"><button class="btn s" data-a="web" data-id="${c.id}">${ic('globe', 13)} Website</button> ${k?.lead ? `<button class="btn s g" data-a="crm" data-id="${c.id}">CRM</button>` : `<button class="btn s g" data-a="lead" data-id="${c.id}">+ Lead</button>`}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Keine Treffer.</td></tr>'}</tbody></table></div>` : ''}
    ${tab === 'camp' ? `<div class="pad gA" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${cn.map(k => { const cs_ = allCo().filter(c => c.camp === k && visible(c)); return `<div class="card"><div class="row"><h3 style="color:var(--tx);text-transform:none;font-size:14px;letter-spacing:0">${CAMP[k].n}</h3><span class="sp"></span><span class="tag">${cs_.length} Firmen</span></div><p class="mut sm mt">${CAMP[k].tw}</p><div class="row"><span class="xs mut3">${cs_.filter(c => S.co[c.id]?.lead).length} Leads · ${cs_.filter(c => S.co[c.id]?.status === 'won').length} Kunden</span><span class="sp"></span><button class="btn s" data-a="pcamp" data-k="${k}">Anzeigen</button></div></div>`; }).join('')}</div>` : ''}
    ${tab === 'net' ? `<div class="pad col" style="max-width:760px"><p class="mut">Nicht jedes Unternehmen steht im Verzeichnis. Neue Gelegenheiten entstehen über verschiedene Wege – du musst sie finden.</p>
    <div class="card"><h3>Unternehmerstammtisch</h3><p class="sm mut">Persönliche Kontakte knüpfen. 25 €, 3 Stunden, einmal pro Woche. Kann Unternehmen freischalten, die online kaum sichtbar sind.</p><button class="btn p" data-a="net">${ic('users', 15)} Teilnehmen</button></div>
    <div class="card"><h3>Stellenanzeigen</h3><p class="sm mut">Anzeigen verraten manuelle Abläufe und Wachstum. Manche Firmen sind nur dort sichtbar.</p><button class="btn" data-a="jobs">${ic('search', 15)} Stellenfuchs öffnen</button></div>
    <div class="card"><h3>Empfehlungen & Inbound</h3><p class="sm mut">Zufriedene Kunden empfehlen dich weiter, manche Firmen melden sich selbst. Das passiert nur bei guter Arbeit und Reputation (aktuell ${Math.round(S.rep)}).</p></div>
    <div class="card"><h3>Neu im Markt</h3><p class="sm mut">Im Spielverlauf entstehen neue Unternehmen, Softwarewechsel, neue Entscheider und Branchenentwicklungen. Beobachte die Benachrichtigungen.</p></div></div>` : ''}`;
  }
  return { render, go(a) { if (a) { f.q = ''; } } };
} };
