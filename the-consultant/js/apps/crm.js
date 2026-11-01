import { S, cs, emit, uid, hist, logAct } from '../store.js';
import { allCo, getCo, wf, addrOf } from '../companies.js';
import { STAGES, STAGE_N, calcProb, setStage, makeLead } from '../sim.js';
import { CAMP, PERS, KEYQ } from '../arch.js';
import { esc, ic, eur, fmtDate, fmtShort } from '../util.js';
import { bind, openApp, appApi, toast, bar, sc, modal } from '../ui.js';
import { factsTable, processMap, trustLbl } from '../viz.js';

export default { id: 'crm', n: 'CRM', ic: 'users', w: 1100, h: 700, nopad: true, create(root) {
  let sel = null;
  const leads = () => allCo().filter(c => S.co[c.id]?.lead);
  bind(root, {
    sel(d) { sel = d.id; }, back() { sel = null; }, web(d) { openApp('browser', { co: d.id }); }, mail(d) { const co = getCo(d.id), k = cs(d.id), ct = co.cn.find(c => k.knownC.includes(c.i)); openApp('mail', { to: ct ? addrOf(co, ct) : `info@${co.mail}` }); },
    prop(d) { openApp('proposal', d.id); },
    stage(v, el) { setStage(el.dataset.id, v, true); emit(); },
    fu(v, el) { cs(el.dataset.id).fu = v ? Math.round((Date.parse(v) - Date.UTC(2026, 10, 2)) / 864e5) : null; emit(); },
    deal(v, el) { cs(el.dataset.id).deal = +v || 0; emit(); },
    note() { const t = root.querySelector('#cn'); if (!t.value.trim()) return; S.notes.unshift({ id: uid('o'), co: sel, kind: root.querySelector('#ck').value, t: t.value.trim(), d: S.day }); emit(); },
    lose(d) { setStage(d.id, 'verloren', true); cs(d.id).status = 'lost'; emit(); }, rest(d) { setStage(d.id, 'ruhend', true); emit(); },
  });
  function render() {
    const L = leads();
    if (sel && !L.find(c => c.id === sel)) sel = null;
    root.innerHTML = `<div class="split" style="grid-template-columns:${sel ? '1fr 440px' : '1fr'}"><div data-sc="k"><div class="row pad" style="padding-bottom:0"><h2>Pipeline</h2><span class="tag">${L.length} Leads</span><span class="sp"></span><span class="mut sm">Wahrscheinlichkeit = Einschätzung aus beobachtbaren Signalen, keine Garantie.</span></div>
    ${L.length ? `<div class="kan" style="height:auto;min-height:calc(100% - 50px)">${STAGES.filter(s => s !== 'neu').map(st => { const cs_ = L.filter(c => S.co[c.id].stage === st || (st === 'recherche' && S.co[c.id].stage === 'neu')); return `<div class="kc"><h4>${STAGE_N[st]} · ${cs_.length}</h4>${cs_.map(c => { const k = S.co[c.id]; return `<div class="kd" data-a="sel" data-id="${c.id}"><div class="b sm tr">${esc(c.n)}</div><div class="xs mut3">${esc(c.city)} · ${CAMP[c.camp].n}</div><div class="row xs mt" style="margin-top:6px"><span class="tag ${calcProb(c.id) >= 50 ? 'ok' : ''}">${calcProb(c.id)} %</span>${k.deal ? `<span class="tag">${eur(k.deal)}</span>` : ''}${k.fu != null && k.fu <= S.day ? '<span class="tag warn">Follow-up</span>' : ''}</div></div>`; }).join('')}</div>`; }).join('')}</div>` : '<div class="empty" style="padding:60px">Noch keine Leads. Öffne im Browser eine Firma und klicke „Lead“, oder schreibe eine Firma an.</div>'}</div>
    ${sel ? `<div class="sb" style="border-left:1px solid var(--line);border-right:0" data-sc="d">${detail(getCo(sel))}</div>` : ''}</div>`;
  }
  function detail(co) {
    const k = cs(co.id), w = wf(co), prob = calcProb(co.id), notes = S.notes.filter(n => n.co === co.id), known = co.cn.filter(c => k.knownC.includes(c.i)), unk = co.cn.length - known.length;
    const fuv = k.fu != null ? new Date(Date.UTC(2026, 10, 2) + k.fu * 864e5).toISOString().slice(0, 10) : '';
    return `<div class="pad col"><div class="row"><button class="btn g s" data-a="back">${ic('back', 14)}</button><h2 class="sp tr">${esc(co.n)}</h2></div>
    <div class="row w"><span class="tag ac">${CAMP[co.camp].n}</span><span class="tag">${esc(co.i)}</span><span class="tag">${esc(co.city)}</span><span class="tag">${co.e} MA</span><span class="tag">Digital ${co.mat}/5</span><span class="tag">${co.fin}</span></div>
    <div class="row w"><button class="btn s" data-a="web" data-id="${co.id}">${ic('globe', 13)} Website</button><button class="btn s" data-a="mail" data-id="${co.id}">${ic('mail', 13)} E-Mail</button><button class="btn s p" data-a="prop" data-id="${co.id}">${ic('file', 13)} Angebot erstellen</button></div>
    <div class="g2"><label class="f"><span>Phase</span><select data-c="stage" data-id="${co.id}">${STAGES.map(s => `<option value="${s}" ${k.stage === s ? 'selected' : ''}>${STAGE_N[s]}</option>`).join('')}</select></label><label class="f"><span>Dealwert (€)</span><input type="number" data-c="deal" data-id="${co.id}" value="${k.deal || ''}"></label></div>
    <label class="f"><span>Follow-up am</span><input type="date" data-c="fu" data-id="${co.id}" value="${fuv}"></label>
    <div class="card"><div class="row"><span class="mut sm">Abschlusswahrscheinlichkeit (Einschätzung)</span><span class="sp"></span><b>${prob} %</b></div>${bar(prob, sc(prob, 50, 25))}<div class="row mt" style="margin-top:8px"><span class="mut sm">Beziehung: ${trustLbl(k.trust)}</span><span class="sp"></span><span class="mut sm">Interesse: ${k.int < 20 ? 'gering' : k.int < 50 ? 'mittel' : 'hoch'}</span></div></div>
    <div class="card"><h3>Kontakte</h3>${known.map(c => `<div class="row sm" style="padding:3px 0"><b>${esc(c.name)}</b><span class="mut">${esc(c.role)}</span>${k.calls ? `<span class="tag">${esc(PERS[c.p].n)}</span>` : ''}</div><div class="xs mut3">${esc(addrOf(co, c))}</div>`).join('') || '<p class="mut sm">Noch keine Ansprechperson bekannt – prüfe Impressum, Team, Karriere.</p>'}${unk > 0 ? `<p class="xs mut3 mt">+ ${unk} weitere Person(en) noch unbekannt</p>` : ''}</div>
    <div class="card"><h3>Prozesslandkarte (aus Erkenntnissen)</h3>${processMap(co)}</div>
    <div class="card"><h3>Erkenntnisse (${KEYQ.filter(q => k.known[q]).length}/${KEYQ.length} Kernfakten)</h3>${factsTable(co.id)}</div>
    <div class="card"><h3>Notizen</h3><div class="row"><input id="cn" data-k="cn" placeholder="Notiz …"><select id="ck" style="width:110px"><option value="beleg">Beleg</option><option value="annahme">Annahme</option></select><button class="btn s" data-a="note">+</button></div>${notes.map(n => `<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="tag ${n.kind === 'beleg' ? 'ok' : 'warn'}">${n.kind}</span> ${esc(n.t)} <span class="xs mut3">${fmtShort(n.d)}</span></div>`).join('')}</div>
    <div class="card"><h3>Beziehungsverlauf</h3>${k.hist.slice(0, 12).map(h => `<div class="row sm" style="padding:2px 0"><span class="mono xs mut3" style="width:42px">${fmtShort(h.d)}</span>${esc(h.t)}</div>`).join('') || '<p class="mut sm">–</p>'}</div>
    <div class="row"><button class="btn s d" data-a="lose" data-id="${co.id}">Als verloren markieren</button><button class="btn s" data-a="rest" data-id="${co.id}">Ruhend</button></div></div>`;
  }
  return { render, go(id) { if (id) { makeLead(id); sel = id; } } };
} };
