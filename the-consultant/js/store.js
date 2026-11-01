// Zentraler Simulationszustand, Persistenz (localStorage hinter einer Abstraktion), Zufall, Hilfsfunktionen
import { clamp } from './util.js';
import { SKILLS, BG } from './arch.js';
export let S = null;
let rev = 0, timer = null;
const KEY = 'the-consultant-save-v1';
const subs = new Set();
export const hooks = { toast: null };
export const getRev = () => rev;
export const on = f => { subs.add(f); return () => subs.delete(f); };
export const emit = () => { rev++; subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); save(); };

// Persistenz-Adapter: kann später durch ein Backend ersetzt werden
export const adapter = {
  get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* voll/blockiert */ } },
  del() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};
export function save() { if (!S) return; clearTimeout(timer); timer = setTimeout(() => adapter.set(JSON.stringify(S)), 150); }
export function load() { const j = adapter.get(); if (!j) return false; try { S = JSON.parse(j); return S && S.v === 1; } catch (e) { return false; } }
export function wipe() { adapter.del(); S = null; }
export function importSave(json) { const o = JSON.parse(json); if (o.v !== 1) throw new Error('Ungültiger Spielstand'); S = o; emit(); }

export function init(o) {
  const skills = {};
  for (const g of Object.values(SKILLS)) for (const k of g) skills[k] = 8 + (k === 'Python' || k === 'JavaScript / Node.js' || k === 'REST APIs' ? 8 : 0);
  Object.assign(skills, BG[o.bg].s);
  S = {
    v: 1, day: 0, hours: 8, seed: (o.seed ?? Date.now()) % 1e9, uid: 1, over: false, started: false,
    me: { name: o.name, age: o.age, title: 'Freiberuflicher KI- & Automatisierungsberater', exp: 'Einsteiger', bg: o.bg, rate: 65, logo: '#4c8dff',
      co: { name: o.company, desc: 'Wir vereinfachen wiederkehrende Abläufe im Mittelstand durch maßgeschneiderte Software, KI-Integrationen und Workflow-Automatisierung – erst verstehen, dann bauen.', spec: 'Alle Branchen', svc: [
        { n: 'Prozess-Check (Analyse + Empfehlung)', p: 480 }, { n: 'Pilot-Automatisierung (Festpreis)', p: 2400 }, { n: 'Individuelle Integration', p: 6500 }, { n: 'Wartung & Betrieb (monatlich)', p: 290 }] } },
    cash: 1500, start: 1500, rep: 10, skills, sx: {}, gained: {},
    co: {}, gen: [], emails: [], meetings: [], projects: [], inv: [], led: [], notes: [], q: [], notif: [], act: [], bm: [], mil: {}, lessons: [],
    cashH: [[0, 1500]], call: null, ev: {}, mods: {}, camp: {}, searchLog: [], lastNet: -99, hist: [],
  };
  return S;
}

export const cs = id => S.co[id] || (S.co[id] = { seen: 0, lead: 0, stage: 'neu', trust: 40, int: 0, known: {}, visited: {}, mail: 0, lastMail: -99, lastContact: -99, fu: null, deal: 0, status: 'open', sat: null, calls: 0, props: 0, price: 0, noted: 0, knownC: [], ignored: 0, mod: {}, hist: [] });
export function rnd() { let t = (S.seed = (S.seed + 0x6D2B79F5) | 0); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export const pick = a => a[Math.floor(rnd() * a.length)];
export const chance = p => rnd() < p;
export const between = (a, b) => a + rnd() * (b - a);
export const uid = p => p + (S.uid++);

export function notify(t, app = '', kind = 'info') {
  S.notif.unshift({ id: uid('n'), d: S.day, t, app, kind, read: 0 }); if (S.notif.length > 80) S.notif.length = 80;
  hooks.toast && hooks.toast(t, kind);
}
export function logAct(t, co) { S.act.unshift({ d: S.day, t, co }); if (S.act.length > 120) S.act.length = 120; }
export function hist(id, t) { const c = cs(id); c.hist.unshift({ d: S.day, t }); if (c.hist.length > 60) c.hist.length = 60; }
export function ledger(type, cat, a, memo, co) {
  S.led.push({ d: S.day, t: type, cat, a, m: memo, co }); S.cash += type === 'rev' ? a : -a;
  const last = S.cashH[S.cashH.length - 1]; if (last[0] === S.day) last[1] = S.cash; else S.cashH.push([S.day, S.cash]);
}
export function gain(sk, amt) {
  if (!(sk in S.skills) || !amt) return;
  const add = amt * (1 - S.skills[sk] / 130); S.skills[sk] = Math.min(100, S.skills[sk] + add);
  S.gained[sk] = (S.gained[sk] || 0) + add;
}
export function takeGained() { const g = S.gained; S.gained = {}; return g; }
export const addRep = n => { S.rep = clamp(S.rep + n, 0, 100); };
export const addTrust = (id, n) => { const c = cs(id); c.trust = clamp(c.trust + n, 0, 100); };
export function lesson(t) { S.lessons.unshift({ d: S.day, t }); if (S.lessons.length > 80) S.lessons.length = 80; }
export function useHours(h) { S.hours = Math.max(-4, S.hours - h); }
