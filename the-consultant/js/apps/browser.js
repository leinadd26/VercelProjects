import { S, cs, emit, uid, useHours } from '../store.js';
import { getCo, allCo, visible } from '../companies.js';
import { visitPage, makeLead } from '../sim.js';
import { sitePage, searchHome, searchResults, jobBoard, vendorDoc } from '../sites.js';
import { hint } from '../sales.js';
import { esc, ic } from '../util.js';
import { bind, alertBox, toast } from '../ui.js';

export default { id: 'browser', n: 'Browser', ic: 'globe', w: 1000, h: 680, nopad: true, create(root) {
  let hist = [{ k: 'search' }], ix = 0, cur = null;
  root.innerHTML = `<div class="br"><div class="url"><button class="btn g s" data-a="back" title="Zurück">${ic('back', 15)}</button><button class="btn g s" data-a="fwd" title="Vorwärts">${ic('arrow', 15)}</button><button class="btn g s" data-a="home" title="Suchmaschine">${ic('globe', 15)}</button><input id="u" data-k="u" placeholder="Suchbegriff oder Adresse eingeben (z. B. Spedition Duisburg)" spellcheck="false"><button class="btn s" data-a="star" title="Lesezeichen">${ic('bookmark', 15)}</button><button class="btn s" data-a="lead" title="Als Lead anlegen">${ic('users', 15)} Lead</button><button class="btn g s" data-a="hint" title="Hinweis">${ic('bulb', 15)}</button></div><div class="view" id="v"></div><div class="nt"><input id="nt" data-k="nt" placeholder="Notiz zu dieser Firma …"><select id="nk" style="width:110px"><option value="beleg">Beleg</option><option value="annahme">Annahme</option></select><button class="btn s" data-a="note">Speichern</button></div></div>`;
  const v = root.querySelector('#v'), sh = v.attachShadow({ mode: 'open' }), u = root.querySelector('#u');
  const parse = s => { s = s.trim(); if (!s) return { k: 'search' }; const m = s.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9]+)\.example(?:\/([a-z]*))?/i);
    if (m) { if (m[1] === 'suchfuchs') return { k: 'search' }; if (m[1] === 'stellenfuchs') return { k: 'jobs', q: '' }; const co = allCo().find(c => c.id === m[1]); if (co) return { k: 'co', id: co.id, p: m[2] || 'home' }; return { k: '404' }; }
    return { k: 'q', q: s }; };
  function load(spec) {
    let pg;
    if (spec.k === 'search') pg = searchHome(); else if (spec.k === 'q') pg = searchResults(spec.q); else if (spec.k === 'jobs') pg = jobBoard(spec.q); else if (spec.k === 'doc') pg = vendorDoc(spec.name);
    else if (spec.k === 'co') { const co = getCo(spec.id); if (!co || !visible(co)) pg = { title: '404', url: '', html: '<div style="padding:30px;font-family:sans-serif">Server nicht gefunden.</div>' }; else { pg = sitePage(co, spec.p); const first = visitPage(co.id, spec.p); if (first) { useHours(.05); emit(); } } }
    else pg = { title: '404', url: '', html: '<div style="padding:30px;font-family:sans-serif">Server nicht gefunden.</div>' };
    cur = { spec, pg }; sh.innerHTML = pg.html + '<style>:host{display:block}</style>'; u.value = pg.url || ''; v.scrollTop = 0; root.querySelector('[data-a=star]').classList.toggle('p', !!S.bm.find(b => b.u === pg.url));
  }
  sh.addEventListener('click', e => {
    const a = e.target.closest('[data-p],[data-go],[data-co]'); if (!a) return; e.preventDefault();
    if (a.dataset.p && cur.spec.k === 'co') go({ k: 'co', id: cur.spec.id, p: a.dataset.p });
    else if (a.dataset.co) { cs(a.dataset.co).seen = 1; go({ k: 'co', id: a.dataset.co, p: a.dataset.pg || 'home' }); }
    else if (a.dataset.go) go(parse(a.dataset.go).k === '404' ? { k: 'doc', name: decodeURIComponent(a.dataset.go.split('/').pop()) } : parse(a.dataset.go));
  });
  function go(spec) { hist = hist.slice(0, ix + 1); hist.push(spec); ix = hist.length - 1; load(spec); }
  u.addEventListener('keydown', e => { if (e.key === 'Enter') go(parse(u.value)); });
  bind(root, { back() { if (ix > 0) load(hist[--ix]); }, fwd() { if (ix < hist.length - 1) load(hist[++ix]); }, home() { go({ k: 'search' }); },
    star() { const i = S.bm.findIndex(b => b.u === cur.pg.url); if (i >= 0) S.bm.splice(i, 1); else if (cur.pg.url) S.bm.push({ u: cur.pg.url, t: cur.pg.title }); emit(); root.querySelector('[data-a=star]').classList.toggle('p', i < 0); },
    lead() { if (cur.spec.k !== 'co') return toast('Öffne zuerst die Website eines Unternehmens.', 'warn'); makeLead(cur.spec.id); emit(); toast(`${getCo(cur.spec.id).n} als Lead gespeichert (CRM).`, 'good'); },
    hint() { alertBox('Hinweis', `<p>${esc(hint('browser'))}</p>`); },
    note() { const t = root.querySelector('#nt'); if (!t.value.trim()) return; const co = cur.spec.k === 'co' ? cur.spec.id : null; S.notes.unshift({ id: uid('o'), co, kind: root.querySelector('#nk').value, t: t.value.trim(), d: S.day }); if (co) makeLead(co); t.value = ''; emit(); toast(co ? `Notiz bei ${getCo(co).n} gespeichert (Wissen & CRM).` : 'Notiz gespeichert (Wissen).', 'good'); } });
  load(hist[0]);
  return { render() { }, busy: () => true, go(a) { if (a?.co) go({ k: 'co', id: a.co, p: a.page || 'home' }); else if (a?.q) go({ k: 'q', q: a.q }); else if (a?.jobs) go({ k: 'jobs', q: '' }); } };
} };
