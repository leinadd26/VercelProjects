// Prozedurale, individuell gestaltete Unternehmenswebsites (7 Stile, Layout- und Qualitätsvarianten) + Suchmaschine/Jobportal
import { S, cs } from './store.js';
import { ARCH, CAMP, API_TXT } from './arch.js';
import { allCo, getCo, wf, addrOf, visible } from './companies.js';
import { esc, hash, mul32, fmtDate, ic } from './util.js';

const G = {
  log: { svc: ['Stückgut & Teilladungen', 'Lagerung & Umschlag', 'Expressverkehre', 'Zollabwicklung'], refs: ['Baustoffhandel Lenz', 'Möbelwerke Brückner', 'Chemie Vertrieb Nord', 'Bio-Frischedienst'] },
  ecom: { svc: ['Versand innerhalb von 24 h', 'Geschenkservice', 'Newsletter & Aktionen', 'Gutscheine'], refs: ['Presse: Regionalzeitung', 'Bewertungsportal 4,6/5', 'Händlerbund-Mitglied', 'Partner-Marktplatz'] },
  man: { svc: ['Lohnfertigung', 'Prototypen & Kleinserien', 'Montage & Baugruppen', 'Oberflächenveredelung'], refs: ['Maschinenbau Reuter', 'Automotive-Zulieferer Kaiser', 'Medizintechnik Albers', 'Anlagenbau Vogel'] },
  prop: { svc: ['Mietverwaltung', 'WEG-Verwaltung', 'Sondereigentumsverwaltung', 'Immobilienbewertung'], refs: ['WEG Parkallee 12', 'Wohnanlage Lindenhof', 'Eigentümergemeinschaft Mühlenweg', 'Mehrfamilienhaus Gartenstraße'] },
  rec: { svc: ['Direktvermittlung', 'Zeitarbeit', 'Active Sourcing', 'Karriereberatung'], refs: ['Klinikverbund Rhein-Ruhr', 'IT-Mittelständler Nova', 'Handwerkskammer-Partner', 'Pflegeheim-Gruppe'] },
  con: { svc: ['Neubau', 'Sanierung & Umbau', 'Dach & Fassade', 'Bauleitung'], refs: ['Wohnquartier Südpark', 'Schulerweiterung Nord', 'Gewerbehalle Hafen', 'Seniorenresidenz'] },
  prof: { svc: ['Beratung', 'Prüfung & Analyse', 'Mandantenbetreuung', 'Workshops'], refs: ['Mittelstand Region', 'Familienunternehmen', 'Start-ups', 'Öffentliche Hand'] },
  mob: { svc: ['Beratung & Verkauf', 'Service & Wartung', 'Finanzierung', 'Events & Feiern'], refs: ['Stammkunden seit 20 Jahren', 'Firmenkundenpartner', 'Hochzeitsgesellschaften', 'Vereine & Verbände'] },
  trade: { svc: ['Frischelieferung', 'Sortimentsberatung', 'Rahmenverträge', 'Express-Nachlieferung'], refs: ['Gastronomie Rheinblick', 'Wochenmarkthändler', 'Kantine Stadtwerke', 'Biomarkt-Gruppe'] },
};
const THEMES = [
  ['agency', '#0e0f13', '#f3f3f1', 'Inter,system-ui,sans-serif', 'dark'],
  ['corp', '#ffffff', '#16233a', 'Inter,system-ui,sans-serif', 'corp'],
  ['old', '#e8e4d8', '#222', '"Times New Roman",Times,serif', 'old'],
  ['craft', '#fff', '#111', 'Impact,"Arial Black",Arial,sans-serif', 'craft'],
  ['edit', '#faf6ee', '#2a2622', 'Georgia,"Times New Roman",serif', 'edit'],
  ['start', '#f6fbf8', '#12251d', 'Inter,system-ui,sans-serif', 'start'],
  ['side', '#f3f1ed', '#222', 'Inter,system-ui,sans-serif', 'side'],
];
const css = (co, T) => {
  const h = co.hue, ac = `hsl(${h} 62% ${T[4] === 'dark' ? 62 : 38}%)`, base = `.s{background:${T[1]};color:${T[2]};font-family:${T[3]};line-height:1.55;min-height:100%}.s *{box-sizing:border-box}.s a{color:inherit;cursor:pointer}.s img{max-width:100%}.s h1,.s h2,.s h3{margin:0 0 .4em}.s p{margin:0 0 .9em}.s .w{max-width:960px;margin:0 auto;padding:0 22px}.s .btn{display:inline-block;padding:9px 16px;background:${ac};color:#fff;text-decoration:none;border:0;font:inherit;cursor:pointer}.s .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.s .card{padding:16px;border:1px solid #8883}.s footer{padding:24px 0;font-size:12px;opacity:.7;margin-top:30px}.s ul{padding-left:1.1em}.s small{opacity:.7}.s .logo{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 8px;background:${ac};color:#fff;font-weight:700}.s hr{border:0;border-top:1px solid #8883;margin:20px 0}`;
  const v = {
    dark: `.s header{border-bottom:1px solid #fff2;padding:16px 0}.s nav a{margin-left:18px;opacity:.75;text-decoration:none;font-size:14px}.s .hero{padding:70px 0 40px}.s h1{font-size:38px;letter-spacing:-.03em}.s .card{border-radius:6px;background:#ffffff08}.s .logo{border-radius:6px}`,
    corp: `.s header{padding:16px 0;border-bottom:3px solid ${ac}}.s nav a{margin-left:16px;text-decoration:none;font-size:14px;color:#456}.s .hero{padding:56px 0;background:linear-gradient(120deg,hsl(${h} 50% 94%),#fff)}.s h1{font-size:34px}.s .card{background:#fff;box-shadow:0 1px 6px #0001;border-radius:3px}`,
    old: `.s{font-size:15px}.s header{background:#c9c2a8;padding:10px 0;border-bottom:2px solid #666;text-align:center}.s nav a{margin:0 10px;color:#00e;font-size:14px}.s .hero{padding:24px 0;text-align:center}.s h1{font-size:28px;color:#800}.s .card{background:#f4f1e4;border:1px solid #666}.s .btn{background:#ddd;color:#000;border:2px outset #aaa}.s .w{max-width:760px}.s footer{text-align:center}`,
    craft: `.s header{background:#111;color:#ffd400;padding:14px 0}.s nav a{margin-left:14px;text-transform:uppercase;font-size:13px;text-decoration:none;letter-spacing:.06em;color:#ffd400}.s .hero{padding:50px 0;background:#ffd400}.s h1{font-size:46px;text-transform:uppercase;line-height:1}.s .card{border:3px solid #111;background:#fff}.s .btn{background:#111;color:#ffd400;text-transform:uppercase}.s .logo{background:#ffd400;color:#111;border:3px solid #111}`,
    edit: `.s header{padding:28px 0;text-align:center;border-bottom:1px solid #8886}.s nav a{margin:0 12px;font-style:italic;text-decoration:none;font-size:15px}.s .w{max-width:680px}.s .hero{padding:40px 0 10px;text-align:center}.s h1{font-size:40px;font-weight:400}.s .card{border:0;border-top:1px solid #8886;padding:12px 0}.s .logo{background:transparent;color:inherit;border:1px solid}`,
    start: `.s header{padding:16px 0}.s nav a{margin-left:14px;font-weight:600;text-decoration:none;font-size:14px;padding:6px 10px;border-radius:20px}.s .hero{padding:60px 0 30px}.s h1{font-size:44px;letter-spacing:-.04em;line-height:1.05}.s .card{border-radius:18px;background:#fff;border:0;box-shadow:0 2px 14px #0001}.s .btn{border-radius:30px}.s .logo{border-radius:50%}`,
    side: `.s{display:flex}.s aside{width:190px;flex:none;padding:22px 16px;background:#e5e0d6;min-height:100%}.s aside a{display:block;padding:6px 0;text-decoration:none;font-size:14px}.s main{flex:1}.s .hero{padding:44px 0 20px}.s h1{font-size:32px}.s .card{background:#fff}`,
  }[T[4]];
  return base + v;
};
const NAV = [['home', 'Start'], ['about', 'Über uns'], ['services', 'Leistungen'], ['refs', 'Referenzen'], ['news', 'Aktuelles'], ['careers', 'Karriere'], ['contact', 'Kontakt'], ['impressum', 'Impressum']];
const inc = (co, p) => co.mat <= 1 && ['refs', 'news'].includes(p) && (hash(co.id + p) % 2 === 0);
const dates = (n, k) => { const r = mul32(hash(k)); return Array.from({ length: n }, (_, i) => fmtDate(-20 - Math.floor(r() * 300) - i * 40, { day: '2-digit', month: 'long', year: 'numeric' })); };

export function sitePage(co, page) {
  const T = THEMES[co.st % 7], ar = ARCH[co.ca], ar2 = ARCH[co.a], g = G[co.camp], dsc = mul32(hash(co.id));
  const nav = NAV.filter(([k]) => !(co.mat <= 1 && k === 'news' && inc(co, 'news')) && !(co.mat <= 1 && k === 'refs' && inc(co, 'refs')));
  const link = ([k, n]) => `<a data-p="${k}">${n}</a>`;
  const logo = `<span class="logo">${esc(co.n.split(' ').filter(w => /^[A-ZÄÖÜ]/.test(w)).slice(0, 2).map(w => w[0]).join(''))}</span>`;
  const head = T[4] === 'side' ? `<aside><div style="margin-bottom:14px">${logo} <b>${esc(co.n.split(' ').slice(0, 2).join(' '))}</b></div>${nav.map(link).join('')}</aside>` : `<header><div class="w" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap${T[4] === 'edit' || T[4] === 'old' ? ';flex-direction:column' : ''}"><a data-p="home" style="text-decoration:none;display:flex;align-items:center;gap:10px">${logo}<b>${esc(co.n)}</b></a><nav>${nav.map(link).join('')}</nav></div></header>`;
  const fm = co.mat <= 2 ? `Letzte Aktualisierung: ${fmtDate(-420 - hash(co.id) % 700)}` : `© ${2026} ${esc(co.n)}`;
  const foot = `<footer><div class="w">${fm} · <a data-p="impressum">Impressum</a> · <a data-p="contact">Kontakt</a>${co.mat <= 1 ? '<br>Besucherzähler: ' + String(100000 + hash(co.id) % 99999) : ''}<br><i>Simulierte Website – alle Inhalte frei erfunden (Planspiel „THE CONSULTANT“).</i></div></footer>`;
  const svc = [...g.svc]; svc.splice(1 + hash(co.id) % 3, 0, ar.svc);
  const jobs = [ar.job, ...(co.mat >= 3 ? ['Ausbildung zum/zur Kaufmann/-frau (m/w/d)'] : []), 'Initiativbewerbung – wir freuen uns über Ihre Unterlagen'];
  const ctJob = co.cn.find(c => c.vis === 'j'), ctNews = co.cn.find(c => c.vis === 'n');
  let body = '';
  const wrap = x => `<div class="w">${x}</div>`;
  if (page === 'home') {
    const intro = { log: `Als zuverlässiger Partner organisieren wir Ihre Transporte und Lagerprozesse in der Region ${co.city} und darüber hinaus.`, ecom: `Bei uns bestellen Kundinnen und Kunden bequem online – mit persönlichem Service aus ${co.city}.`, man: `Seit ${co.f} fertigen wir in ${co.city} Teile und Baugruppen für anspruchsvolle Kunden.`, prop: `Wir verwalten Immobilien in ${co.city} mit Erfahrung, Augenmaß und kurzen Wegen.`, rec: `Wir bringen Fachkräfte und Unternehmen zusammen – diskret, schnell und mit Gespür.`, con: `Handwerk mit Verantwortung: Wir bauen, sanieren und begleiten Ihr Projekt in und um ${co.city}.`, prof: `Wir beraten Mandanten in ${co.city} und Umgebung verlässlich und persönlich.`, mob: `Willkommen bei uns in ${co.city}! Wir freuen uns auf Ihren Besuch.`, trade: `Wir beliefern Gastronomie und Handel in der Region ${co.city} zuverlässig und frisch.` }[co.camp];
    body = `<section class="hero">${wrap(`<h1>${esc(co.tag)}</h1><p>${intro}</p><a class="btn" data-p="contact">Kontakt aufnehmen</a>`)}</section>${wrap(`<div class="grid" style="margin-top:20px">${svc.slice(0, 3).map(s => `<div class="card"><b>${esc(s.split(' – ')[0].slice(0, 60))}</b><p><small>${esc(s.length > 60 ? s : 'Persönlich und zuverlässig – sprechen Sie uns an.')}</small></p></div>`).join('')}</div><hr><h3>Aktuelles</h3><p>${esc(ar.news)} <a data-p="news">Mehr…</a></p>`)}`;
  } else if (page === 'about') {
    body = wrap(`<h1>Über uns</h1><p>${esc(co.n)} wurde ${co.f} in ${esc(co.city)} gegründet. Heute arbeiten rund ${co.e} Mitarbeitende für unsere Kundinnen und Kunden. ${co.fin === 'wachsend' ? 'Wir wachsen seit Jahren – und suchen weiter engagierte Menschen.' : co.fin === 'angespannt' ? 'Wir sind ein kleines Team und kümmern uns persönlich um jeden Auftrag.' : 'Verlässlichkeit ist für uns kein Schlagwort, sondern Alltag.'}</p><p>${co.mat >= 4 ? 'Wir setzen auf moderne Werkzeuge und kurze Entscheidungswege.' : co.mat <= 2 ? 'Bei uns gilt: Das haben wir immer so gemacht – und es hat sich bewährt.' : 'Wir kombinieren bewährte Abläufe mit sinnvoller Technik.'}</p><h3>Team</h3><div class="grid">${co.cn.filter(c => c.vis === 's').map(c => `<div class="card"><b>${esc(c.name)}</b><br><small>${esc(c.role)}</small></div>`).join('')}</div>`);
  } else if (page === 'services') body = wrap(`<h1>Leistungen</h1><ul>${svc.map(s => `<li>${esc(s)}</li>`).join('')}</ul><p><a class="btn" data-p="contact">Anfrage senden</a></p>`);
  else if (page === 'refs') body = inc(co, 'refs') ? wrap('<h1>Referenzen</h1><p><i>Diese Seite befindet sich im Aufbau.</i></p>') : wrap(`<h1>Referenzen</h1><div class="grid">${g.refs.map(r => `<div class="card">${esc(r)}</div>`).join('')}</div><hr><p>${esc(ar.ref)}</p><p><i>„Wir arbeiten seit Jahren vertrauensvoll zusammen.“</i> – Kundenstimme</p>`);
  else if (page === 'news') { const d = dates(3, co.id + 'n'); body = inc(co, 'news') ? wrap('<h1>Aktuelles</h1><p><i>Diese Seite befindet sich im Aufbau.</i></p>') : wrap(`<h1>Aktuelles</h1>${[ar.news, `Neue Öffnungszeiten und Ansprechpartner ab Januar.`, co.fin === 'wachsend' ? 'Wir suchen Verstärkung für unser Team!' : 'Jahresrückblick: Danke an alle Kunden.'].map((n, i) => `<div class="card" style="margin-bottom:12px"><small>${d[i]}</small><br>${esc(n)}${i === 0 && ctNews ? `<br><small>Ansprechpartner: ${esc(ctNews.name)}, ${esc(ctNews.role)}</small>` : ''}</div>`).join('')}`); }
  else if (page === 'careers') body = wrap(`<h1>Karriere</h1><p>${co.mat >= 4 ? 'Werde Teil unseres Teams – bewirb dich online!' : 'Bewerbungen bitte per Post oder E-Mail.'}</p>${jobs.map(j => `<div class="card" style="margin-bottom:12px"><b>${esc(j.split(':')[0])}</b><br><small>${esc(j.includes(':') ? j.split(':').slice(1).join(':').trim() : '')}</small></div>`).join('')}<p>Ansprechpartner: ${ctJob ? `${esc(ctJob.name)}, ${esc(ctJob.role)} – <a>${esc(addrOf(co, ctJob))}</a>` : `<a>karriere@${co.mail}</a>`}</p>`);
  else if (page === 'contact') body = wrap(`<h1>Kontakt</h1><p>${esc(co.n)}<br>Musterstraße ${1 + hash(co.id) % 80}, ${co.zip} ${esc(co.city)}<br>Tel. ${co.ph}<br>E-Mail: <a>info@${co.mail}</a></p><p>${esc(ar.chan)}</p>${co.cn.filter(c => c.vis === 's' && co.mat >= 3).map(c => `<p><b>${esc(c.name)}</b>, ${esc(c.role)}<br><a>${esc(addrOf(co, c))}</a></p>`).join('')}<div class="card"><b>Kontaktformular</b><p><small>Nachricht an uns (in dieser Simulation nicht aktiv – schreibe über das E-Mail-Programm).</small></p></div>`);
  else if (page === 'impressum') { const gf = co.cn.find(c => c.dm) || co.cn[0]; body = wrap(`<h1>Impressum</h1><p>${esc(co.n)}<br>Musterstraße ${1 + hash(co.id) % 80}, ${co.zip} ${esc(co.city)}</p><p>Vertretungsberechtigt: ${esc(gf.name)}, ${esc(gf.role)}<br>Handelsregister: HRB ${10000 + hash(co.id) % 80000} (fiktiv)<br>USt-IdNr.: DE000000000 (fiktiv)</p><p><i>Alle Angaben sind frei erfunden und dienen ausschließlich der Simulation „THE CONSULTANT“.</i></p>`); }
  else body = wrap('<h1>Seite nicht gefunden</h1>');
  const inner = T[4] === 'side' ? `${head}<main>${body}${foot}</main>` : `${head}${body}${foot}`;
  return { title: `${co.n} – ${page === 'home' ? 'Startseite' : NAV.find(n => n[0] === page)?.[1] || ''}`, html: `<style>${css(co, T)}</style><div class="s">${inner}</div>`, url: `${co.url}/${page === 'home' ? '' : page}` };
}

// ---------- Suchmaschine, Jobportal, Herstellerdoku ----------
const SCSS = `<style>.k{font-family:Inter,system-ui,sans-serif;color:#202124;background:#fff;min-height:100%;padding:24px 28px}.k h1{font-size:30px;letter-spacing:-.04em;margin:30px 0 10px}.k .r{margin:0 0 18px;max-width:640px}.k .r a{color:#1a0dab;font-size:18px;cursor:pointer;text-decoration:none}.k .r small{color:#188038;display:block}.k p{margin:2px 0;color:#4d5156;font-size:14px}.k .t{display:inline-block;padding:2px 8px;background:#eef;border-radius:4px;font-size:12px;margin-right:4px}</style>`;
export function searchHome() { return { title: 'Suchfuchs', url: 'https://suchfuchs.example', html: `${SCSS}<div class="k"><h1>Suchfuchs</h1><p>Die Suchmaschine dieser Simulation. Suche nach Unternehmen, Orten, Branchen, Systemen oder Stellenanzeigen.</p><p style="margin-top:14px"><a data-go="https://stellenfuchs.example" style="color:#1a0dab;cursor:pointer">Stellenfuchs – Jobportal</a></p></div>` }; }
export function searchResults(q) {
  const t = q.toLowerCase().split(/\s+/).filter(Boolean), rs = [];
  for (const co of allCo()) {
    if (!visible(co)) continue; const hay = `${co.n} ${co.i} ${co.city} ${co.tag} ${CAMP[co.camp].n}`.toLowerCase(); const sc = t.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    if (sc > 0) rs.push({ co, sc });
    if (t.some(w => w.length > 3 && co.sysn.toLowerCase().includes(w))) rs.push({ doc: co, sc: .8 });
  }
  rs.sort((a, b) => b.sc - a.sc); const out = rs.slice(0, 12).map(r => r.doc ? `<div class="r"><a data-go="https://docs.${hash(r.doc.sysn) % 9000}.example/${encodeURIComponent(r.doc.sysn)}">${esc(r.doc.sysn)} – Produkt- und Entwicklerdokumentation</a><small>docs.hersteller.example</small><p>Schnittstellen, Datenformate, Lizenzmodule und Systemanforderungen.</p></div>` : `<div class="r"><a data-co="${r.co.id}">${esc(r.co.n)} – ${esc(r.co.tag)}</a><small>${esc(r.co.url)}</small><p>${esc(r.co.i)} in ${esc(r.co.city)} · ${r.co.e} Mitarbeitende</p></div>`).join('');
  return { title: `Suche: ${q}`, url: `https://suchfuchs.example/?q=${encodeURIComponent(q)}`, html: `${SCSS}<div class="k"><p>Ergebnisse für „${esc(q)}“</p>${out || '<p>Keine Treffer.</p>'}</div>` };
}
export function jobBoard(q) {
  const t = (q || '').toLowerCase().split(/\s+/).filter(Boolean), items = [];
  for (const co of allCo()) { if (co.lock && co.lock !== 'job' && !cs(co.id).seen) continue; const ar = ARCH[co.ca]; const txt = `${ar.job} ${co.n} ${co.city} ${co.i}`.toLowerCase(); if (!t.length || t.every(w => txt.includes(w))) items.push({ co, ar }); }
  return { title: 'Stellenfuchs', url: 'https://stellenfuchs.example' + (q ? `/?q=${encodeURIComponent(q)}` : ''), html: `${SCSS}<div class="k"><h1>Stellenfuchs</h1><p>Aktuelle Stellenanzeigen. Tipp: Anzeigen verraten manchmal mehr über Abläufe als die Startseite.</p><p>${items.length} Anzeigen${q ? ` für „${esc(q)}“` : ''}</p><br>${items.map(({ co, ar }) => `<div class="r"><a data-co="${co.id}" data-pg="careers">${esc(ar.job.split(':')[0])}</a><small>${esc(co.n)} · ${esc(co.city)}</small><p>${esc(ar.job.split(':').slice(1).join(':').trim() || 'Ihre Aufgaben: vielfältig und verantwortungsvoll.')}</p></div>`).join('')}</div>` };
}
export function vendorDoc(name) {
  const co = allCo().find(c => c.sysn === name); if (!co) return { title: 'Nicht gefunden', url: '', html: `${SCSS}<div class="k"><h1>404</h1></div>` };
  const w = wf(co), t = { rest: 'REST-API (OpenAPI 3) mit OAuth 2.0, Rate-Limit ca. 60 Anfragen/Minute und Webhooks bei Statusänderungen. Das Schnittstellenmodul ist optional und lizenzpflichtig.', csv: 'Datenaustausch über CSV/XML-Import und -Export aus einem überwachten Ordner (SFTP möglich). Keine öffentliche Web-API.', none: 'Keine offene Schnittstelle. Anbindungen sind nur als Individualentwicklung durch den Hersteller oder über die Benutzeroberfläche möglich.' }[w.api];
  const c = cs(co.id); c.known.api ||= { v: w.api, vague: 0, src: 'doku', d: S.day, txt: t };
  return { title: `${name} – Doku`, url: `https://docs.hersteller.example/${encodeURIComponent(name)}`, html: `${SCSS}<div class="k"><h1>${esc(name)}</h1><p><b>Schnittstellen</b></p><p>${esc(t)}</p><p style="margin-top:14px"><i>Hinweis: Öffentliche Herstellerinformation. Funktionsumfang und Lizenzen der konkreten Installation eines Kunden können abweichen.</i></p></div>` };
}
