// UI-Infrastruktur: Fenstermanager, Modals, Toasts, Event-Bindung, Feedback-Dialog
import { S, on, takeGained } from './store.js';
import { esc, ic } from './util.js';

export const APPS = {};
export const registerApp = a => { APPS[a.id] = a; };
const wins = new Map(); let z = 10, cascade = 0;
export const $ = (s, r = document) => r.querySelector(s);
export const isOpen = id => wins.has(id);

// Klick-Delegation: <button data-a="name" data-x="..."> → map.name(dataset, el, event)
export function bind(root, map) {
  root.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (!t || !root.contains(t)) return; const f = map[t.dataset.a]; if (f) { e.preventDefault(); withState(root, () => f(t.dataset, t, e)); root.dispatchEvent(new Event('ui:changed')); } });
  root.addEventListener('input', e => { const t = e.target.closest('[data-i]'); if (t && map[t.dataset.i]) { let r; withState(root, () => { r = map[t.dataset.i](t.value, t, e); }); if (r === true) root.dispatchEvent(new Event('ui:changed')); } });
  root.addEventListener('change', e => { const t = e.target.closest('[data-c]'); if (t && map[t.dataset.c]) { withState(root, () => map[t.dataset.c](t.type === 'checkbox' ? t.checked : t.value, t, e)); root.dispatchEvent(new Event('ui:changed')); } });
}
function withState(root, fn) {
  if (root.__busy) { fn(); return; }
  root.__busy = 1; try { withState2(root, fn); } finally { root.__busy = 0; }
}
function withState2(root, fn) {
  const sc = {}; root.querySelectorAll('[data-sc]').forEach(e => { sc[e.dataset.sc] = e.scrollTop; });
  const ae = document.activeElement, k = ae && root.contains(ae) ? ae.dataset.k : null, ss = k ? [ae.selectionStart, ae.selectionEnd] : null, top = root.scrollTop;
  fn();
  root.scrollTop = top; root.querySelectorAll('[data-sc]').forEach(e => { if (sc[e.dataset.sc] != null) e.scrollTop = sc[e.dataset.sc]; });
  if (k) { const n = root.querySelector(`[data-k="${k}"]`); if (n) { n.focus(); try { n.setSelectionRange(...ss); } catch (e) { /* ignore */ } } }
}
export function openApp(id, arg) {
  const A = APPS[id]; if (!A) return; let w = wins.get(id);
  if (!w) {
    const desk = $('.desk'), el = document.createElement('div'), vw = desk.clientWidth, vh = desk.clientHeight, ww = Math.min(A.w || 900, vw - 20), hh = Math.min(A.h || 600, vh - 20);
    el.className = 'win'; el.dataset.app = id; el.style.cssText = `left:${Math.max(6, Math.min(40 + (cascade % 6) * 28, vw - ww - 6))}px;top:${Math.max(6, Math.min(24 + (cascade % 6) * 24, vh - hh - 6))}px;width:${ww}px;height:${hh}px`; cascade++;
    el.innerHTML = `<div class="wh"><span class="t">${ic(A.ic, 15)} ${esc(A.n)}</span><span class="sp"></span><button class="wc mx" title="Maximieren" data-w="max">${ic('max', 13)}</button><button class="wc" title="Minimieren" data-w="min">${ic('min', 14)}</button><button class="wc x" title="Schließen" data-w="x">${ic('x', 14)}</button></div><div class="wb ${A.nopad ? 'nopad' : ''}"></div>`;
    desk.appendChild(el); const root = el.querySelector('.wb'), api = A.create(root, { close: () => closeApp(id) }) || {}; const raw = api.render || (() => { }); api.render = () => withState(root, raw);
    w = { el, root, api, id }; wins.set(id, w); root.addEventListener('ui:changed', () => { const run = () => { try { api.render(); } catch (e) { console.error(id, e); } }; if (root.__busy) requestAnimationFrame(run); else run(); });
    el.addEventListener('pointerdown', () => focus(id), true);
    el.querySelector('.wh').addEventListener('dblclick', e => { if (!e.target.closest('.wc')) el.classList.toggle('max'); });
    el.querySelectorAll('.wc').forEach(b => b.addEventListener('click', () => { const a = b.dataset.w; if (a === 'x') closeApp(id); else if (a === 'min') { el.classList.add('hide'); refreshDock(); } else el.classList.toggle('max'); }));
    drag(el);
  }
  w.el.classList.remove('hide'); focus(id);
  if (arg !== undefined && w.api.go) w.api.go(arg);
  w.api.render(); refreshDock(); return w.api;
}
export function closeApp(id) { const w = wins.get(id); if (!w) return; w.api.destroy && w.api.destroy(); w.el.remove(); wins.delete(id); refreshDock(); }
function focus(id) { const w = wins.get(id); if (!w) return; z++; w.el.style.zIndex = z; wins.forEach(x => x.el.classList.toggle('f', x === w)); document.body.dataset.focus = id; refreshDock(); }
function drag(el) {
  const h = el.querySelector('.wh'); let sx, sy, ox, oy, on_ = false;
  h.addEventListener('pointerdown', e => { if (e.target.closest('.wc') || el.classList.contains('max') || innerWidth < 820) return; on_ = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => { if (!on_) return; const d = $('.desk'); el.style.left = Math.max(-200, Math.min(d.clientWidth - 80, ox + e.clientX - sx)) + 'px'; el.style.top = Math.max(0, Math.min(d.clientHeight - 36, oy + e.clientY - sy)) + 'px'; });
  h.addEventListener('pointerup', () => { on_ = false; });
}
export function refreshDock() { document.querySelectorAll('.dk[data-app]').forEach(b => { const w = wins.get(b.dataset.app); b.classList.toggle('run', !!w); b.classList.toggle('act', !!w && !w.el.classList.contains('hide') && document.body.dataset.focus === b.dataset.app); }); }
export function renderAll() { wins.forEach(w => { if (w.el.classList.contains('hide')) return; if (w.api.busy && w.api.busy()) return; try { w.api.render(); } catch (e) { console.error(w.id, e); } }); }
let raf = 0; on(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderAll(); document.dispatchEvent(new Event('shell:update')); }); });
export const appApi = id => wins.get(id)?.api;

// Modals
export function modal(o) {
  const ov = document.createElement('div'); ov.className = 'ovl';
  ov.innerHTML = `<div class="mod ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="mh"><h2>${o.title || ''}</h2><span class="sp"></span>${o.noX ? '' : `<button class="wc" data-m="x" aria-label="Schließen">${ic('x', 14)}</button>`}</div><div class="mb2">${o.html || ''}</div>${o.actions ? `<div class="mf">${o.actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-m="${i}">${a.t}</button>`).join('')}</div>` : ''}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc_); }, esc_ = e => { if (e.key === 'Escape' && !o.noX) close(); };
  document.addEventListener('keydown', esc_);
  ov.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (e.target === ov && !o.noX) return close(); if (!b) return; if (b.dataset.m === 'x') return close(); const a = o.actions[+b.dataset.m]; const r = a.fn ? a.fn(ov, close) : undefined; if (r !== false) close(); });
  document.body.appendChild(ov); o.init && o.init(ov, close); return { el: ov, close };
}
export const alertBox = (title, html) => modal({ title, html, actions: [{ t: 'OK', cls: 'p' }] });
export function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + (kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 5200);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
const li = a => a && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
export function feedback(o) { // {title, score, good[], miss[], real[], next, extra}
  const g = takeGained(), gs = Object.entries(g).filter(([, v]) => v >= .05);
  return modal({ title: o.title, wide: true, html: `${o.score != null ? `<div class="row mb"><div class="kpi" style="min-width:110px"><div class="l">Bewertung</div><div class="v ${o.score >= 70 ? 'ok' : o.score >= 45 ? 'warn' : 'bad'}">${o.score}/100</div></div><div class="sp mut">${esc(o.sum || '')}</div></div>` : ''}${o.good?.length ? `<div class="fbs g"><h4>Gut gemacht</h4>${li(o.good)}</div>` : ''}${o.miss?.length ? `<div class="fbs m"><h4>Übersehen</h4>${li(o.miss)}</div>` : ''}${o.real?.length ? `<div class="fbs"><h4>Praxis-Implikation</h4>${li(o.real)}</div>` : ''}${o.pro ? `<div class="fbs r"><h4>Was ein Profi bedenkt</h4>${li(o.pro)}</div>` : ''}${o.next ? `<div class="fbs r"><h4>Als Nächstes lernen</h4><p class="mb0">${esc(o.next)}</p></div>` : ''}${o.extra || ''}${gs.length ? `<div class="row w mt">${gs.map(([k, v]) => `<span class="tag ok">+${v.toFixed(1)} ${esc(k)}</span>`).join('')}</div>` : ''}`, actions: [{ t: 'Weiter', cls: 'p' }] });
}
export const sc = (v, a = 70, b = 45) => v >= a ? 'ok' : v >= b ? 'warn' : 'bad';
export const bar = (v, cls = '') => `<div class="bar2 ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
