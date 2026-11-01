import { S, cs, emit, uid } from '../store.js';
import { allCo, getCo } from '../companies.js';
import { DOCS, TPL, ARCH } from '../arch.js';
import { esc, ic, fmtDate, fmtShort } from '../util.js';
import { bind, openApp } from '../ui.js';
import { processMap, archDiagram } from '../viz.js';

export default { id: 'kb', n: 'Wissen', ic: 'book', w: 1000, h: 680, nopad: true, create(root) {
  let tab = 'docs', doc = 0, nf = 'all';
  bind(root, { tab(d) { tab = d.t; }, doc(d) { doc = +d.i; }, nf(v) { nf = v; }, add() { const t = root.querySelector('#nt').value.trim(); if (!t) return; S.notes.unshift({ id: uid('o'), co: null, kind: root.querySelector('#nk').value, t, d: S.day }); emit(); },
    del(d) { S.notes = S.notes.filter(n => n.id !== d.id); emit(); }, tpl(d) { const t = TPL.find(x => x.id === d.id); openApp('mail', { compose: { subj: t.s, body: t.b.replace('{name}', S.me.name).replace('{firma}', S.me.co.name) } }); } });
  function render() {
    const notes = S.notes.filter(n => nf === 'all' || (nf === 'free' ? !n.co : n.co === nf)), cos = allCo().filter(c => S.co[c.id]?.calls > 0), prj = S.projects.filter(p => p.comps.length);
    root.innerHTML = `<div class="tabs">${[['docs', 'Dokumentation'], ['notes', 'Recherche & Notizen'], ['maps', 'Prozesslandkarten'], ['arch', 'Architekturen'], ['tpl', 'Vorlagen'], ['les', 'Lessons Learned']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-t="${k}">${n}</button>`).join('')}</div><div style="height:calc(100% - 38px);overflow:auto" data-sc="k">
    ${tab === 'docs' ? `<div class="split" style="grid-template-columns:260px 1fr;height:100%"><div class="sb list">${DOCS.map((d, i) => `<div class="it ${i === doc ? 'sel' : ''}" data-a="doc" data-i="${i}"><span class="sm">${esc(d[0])}</span></div>`).join('')}</div><div class="pad"><h2 class="mb">${esc(DOCS[doc][0])}</h2><p style="line-height:1.7;max-width:640px">${esc(DOCS[doc][1])}</p></div></div>` : ''}
    ${tab === 'notes' ? `<div class="pad"><div class="row mb"><input id="nt" data-k="nt" placeholder="Neue Notiz (z. B. Hypothese oder Beobachtung) …"><select id="nk" style="width:120px"><option value="beleg">Beleg</option><option value="annahme">Annahme</option></select><button class="btn p" data-a="add">Speichern</button></div><div class="row mb"><span class="mut sm">Filter:</span><select data-c="nf" style="width:230px"><option value="all">Alle</option><option value="free" ${nf === 'free' ? 'selected' : ''}>Allgemein</option>${allCo().filter(c => S.notes.some(n => n.co === c.id)).map(c => `<option value="${c.id}" ${nf === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>${notes.map(n => `<div class="card" style="margin-bottom:8px"><div class="row"><span class="tag ${n.kind === 'beleg' ? 'ok' : 'warn'}">${n.kind === 'beleg' ? 'Beleg' : 'Annahme'}</span>${n.co ? `<span class="tag">${esc(getCo(n.co).n)}</span>` : ''}<span class="xs mut3">${fmtDate(n.d)}</span><span class="sp"></span><button class="btn s g" data-a="del" data-id="${n.id}">${ic('x', 12)}</button></div><p class="sm" style="margin:6px 0 0">${esc(n.t)}</p></div>`).join('') || '<div class="empty">Keine Notizen. Trenne Belege (was du gesehen hast) von Annahmen (was du vermutest).</div>'}</div>` : ''}
    ${tab === 'maps' ? `<div class="pad col">${cos.map(c => `<div class="card"><h3>${esc(c.n)}</h3>${processMap(c)}</div>`).join('') || '<div class="empty">Prozesslandkarten entstehen aus deinen Discovery-Gesprächen.</div>'}</div>` : ''}
    ${tab === 'arch' ? `<div class="pad col">${prj.map(p => `<div class="card"><h3>${esc(getCo(p.co).n)} – ${esc(p.name)}</h3>${archDiagram(p.comps)}</div>`).join('') || '<div class="empty">Architekturdiagramme entstehen aus deinen Projekten.</div>'}</div>` : ''}
    ${tab === 'tpl' ? `<div class="pad col">${TPL.map(t => `<div class="card"><div class="row"><b class="sp">${esc(t.n)}</b><button class="btn s" data-a="tpl" data-id="${t.id}">In E-Mail öffnen</button></div><pre class="sm mut" style="white-space:pre-wrap;font-family:inherit;margin:8px 0 0">${esc(t.b)}</pre></div>`).join('')}</div>` : ''}
    ${tab === 'les' ? `<div class="pad col">${S.lessons.map(l => `<div class="card sm"><span class="xs mut3">${fmtDate(l.d)}</span><br>${esc(l.t)}</div>`).join('') || '<div class="empty">Lessons Learned entstehen aus Fehlern und Erfolgen im Spiel.</div>'}</div>` : ''}</div>`;
  }
  return { render, busy() { return document.activeElement?.id === 'nt'; }, go() { } };
} };
