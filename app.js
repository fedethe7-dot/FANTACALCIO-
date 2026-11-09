'use strict';
/* Fanta 26/27 – app personale per la rosa Mantra. Dati nel foglio Google via Apps Script. */

const VERSION = '1.4.0';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } }
};
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
const fmt = (n, d = 2) => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sum = a => a.reduce((x, y) => x + y, 0);

/* ───────── Ruoli e moduli Mantra ───────── */
const RUOLI = {
  P: { l: 'Por', c: 'por' }, DS: { l: 'Ds', c: 'dif' }, DC: { l: 'Dc', c: 'dif' }, DD: { l: 'Dd', c: 'dif' },
  E: { l: 'E', c: 'fas' }, M: { l: 'M', c: 'cen' }, C: { l: 'C', c: 'cen' }, W: { l: 'W', c: 'tre' },
  T: { l: 'T', c: 'tre' }, A: { l: 'A', c: 'att' }, PC: { l: 'Pc', c: 'att' }
};
const ORDINE_RUOLI = ['P', 'DS', 'DC', 'DD', 'E', 'M', 'C', 'W', 'T', 'A', 'PC'];
const RUOLO_NOME = { P: 'Portiere', DS: 'Difensore sinistro', DC: 'Difensore centrale', DD: 'Difensore destro', E: 'Esterno', M: 'Mediano', C: 'Centrocampista', W: 'Ala', T: 'Trequartista', A: 'Attaccante', PC: 'Punta centrale' };
const P = ['P'], DS = ['DS'], DC = ['DC'], DD = ['DD'];
// Ogni modulo: linee dal portiere all'attacco, ogni posto = ruoli ammessi (da sinistra a destra)
const MODULI = {
  '3-4-3': [[P], [DC, DC, DC], [['E'], ['M', 'C'], ['C'], ['E']], [['W', 'A'], ['A', 'PC'], ['W', 'A']]],
  '3-4-1-2': [[P], [DC, DC, DC], [['E'], ['M', 'C'], ['C'], ['E']], [['T']], [['T', 'A', 'PC'], ['A', 'PC']]],
  '3-4-2-1': [[P], [DC, DC, DC], [['E', 'W'], ['M', 'C'], ['C'], ['E', 'W']], [['T'], ['T']], [['A', 'PC']]],
  '3-5-2': [[P], [DC, DC, DC], [['E', 'W'], ['M', 'C'], ['M'], ['C'], ['E', 'W']], [['A', 'PC'], ['A', 'PC']]],
  '3-5-1-1': [[P], [DC, DC, DC], [['E', 'W'], ['M', 'C'], ['M'], ['C'], ['E', 'W']], [['T', 'A']], [['A', 'PC']]],
  '4-3-3': [[P], [DS, DC, DC, DD], [['M', 'C'], ['M'], ['C']], [['W', 'A'], ['A', 'PC'], ['W', 'A']]],
  '4-3-1-2': [[P], [DS, DC, DC, DD], [['M', 'C'], ['M'], ['C']], [['T']], [['T', 'A', 'PC'], ['A', 'PC']]],
  '4-4-2': [[P], [DS, DC, DC, DD], [['E', 'W'], ['M', 'C'], ['C'], ['E', 'W']], [['A', 'PC'], ['A', 'PC']]],
  '4-1-4-1': [[P], [DS, DC, DC, DD], [['M']], [['E', 'W'], ['C', 'T'], ['C', 'T'], ['E', 'W']], [['A', 'PC']]],
  '4-4-1-1': [[P], [DS, DC, DC, DD], [['E', 'W'], ['M', 'C'], ['C'], ['E', 'W']], [['T', 'A']], [['A', 'PC']]],
  '4-2-3-1': [[P], [DS, DC, DC, DD], [['M', 'C'], ['M', 'C']], [['W', 'T'], ['T'], ['W', 'T']], [['A', 'PC']]]
};
const slotsDi = m => (MODULI[m] || MODULI['4-1-4-1']).flat();
const slotLabel = r => r.map(x => RUOLI[x]?.l || x).join('/');
const ruoliDi = p => String(p?.Ruoli || '').toUpperCase().split(/[,/\s]+/).filter(Boolean);
const compat = (p, r) => !!p && ruoliDi(p).some(x => r.includes(x));
const roleBadges = p => `<span class="roles">${ruoliDi(p).map(r => `<span class="role ${RUOLI[r]?.c || ''}">${RUOLI[r]?.l || r}</span>`).join('')}</span>`;
const REPARTI = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };
// Bonus/malus. Il gol può valere diverso per reparto (Mantra); imbattuto e fuori ruolo partono da 0 = come prima.
const DEFAULT_BONUS = { golP: 3, golD: 3, golC: 3, golA: 3, rigore: 3, rigoreSbagliato: -3, rigoreParato: 3, golSubito: -1, autogol: -2, amm: -0.5, esp: -1, assist: 1, imbattuto: 0, fuoriRuolo: 0 };
const BONUS_NOMI = { golP: 'Gol portiere', golD: 'Gol difensore', golC: 'Gol centrocampista', golA: 'Gol attaccante', rigore: 'Rigore segnato', rigoreSbagliato: 'Rigore sbagliato', rigoreParato: 'Rigore parato', golSubito: 'Gol subito', autogol: 'Autogol', amm: 'Ammonizione', esp: 'Espulsione', assist: 'Assist', imbattuto: 'Portiere imbattuto', fuoriRuolo: 'Malus fuori ruolo' };
const attivo = p => !!p && p.Attivo !== false && p.Attivo !== 'FALSE' && p.Attivo !== 'false';
const numOrNull = x => (x === '' || x == null || isNaN(Number(x))) ? null : Number(x);
const fmtPt = n => fmt(n, n % 1 ? 1 : 0);

/* ───────── Stato ───────── */
let S = LS.get('fc_data', null);
let API = LS.get('fc_api', { url: '', key: '' });
let view = LS.get('fc_view', 'squadra');
const ui = { statTab: 'giocatori', sortKey: 'fm', sortDir: -1, rep: 'T', ruolo: 'tutti', formSel: null, editForm: null, theme: LS.get('fc_theme', 'auto') };
let syncState = { busy: false, last: LS.get('fc_last', null), error: null };
let _D = null, _Dkey = null;

applyTheme();

/* ───────── API ───────── */
async function apiGet() {
  const u = API.url + (API.url.includes('?') ? '&' : '?') + 'action=all&key=' + encodeURIComponent(API.key);
  const r = await fetch(u, { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Errore');
  return j.data;
}
async function apiPost(action, payload) {
  const r = await fetch(API.url, { method: 'POST', body: JSON.stringify({ key: API.key, action, payload }), redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Errore');
  return j.data;
}
function setData(d) {
  S = d; LS.set('fc_data', S);
  syncState.last = new Date().toISOString(); LS.set('fc_last', syncState.last);
  _D = null;
}
// Ogni scrittura alza questo contatore: una lettura partita prima di una scrittura non sovrascrive i dati nuovi
let wseq = 0;
async function sync(silent) {
  if (!API.url || !API.key) return;
  const mio = wseq;
  syncState.busy = true; syncState.error = null; renderSync();
  try {
    const d = await apiGet();
    if (mio === wseq) { setData(d); if (!silent) toast('Dati aggiornati'); }
  } catch (e) { syncState.error = e.message; if (!silent) toast('Sincronizzazione non riuscita: ' + e.message); }
  syncState.busy = false; renderSync();
  // non ridisegno mentre si sta scrivendo in un campo (es. il menu modulo): perderebbe il focus
  if (!$('#main').contains(document.activeElement) || document.activeElement === $('#main')) render();
}
async function write(action, payload, okMsg) {
  if (!API.url) { toast('Collega prima il foglio (Altro → Collegamento)'); return false; }
  wseq++;
  syncState.busy = true; renderSync();
  try { setData(await apiPost(action, payload)); syncState.error = null; toast(okMsg || 'Salvato'); return true; }
  catch (e) { toast('Errore: ' + e.message); return false; }
  finally { syncState.busy = false; renderSync(); render(); }
}
// La rosa si salva tutta insieme: prima riscarico quella aggiornata dal foglio (magari cambiata da un altro
// dispositivo) e applico solo la mia modifica, così non cancello quello che hai fatto altrove.
async function salvaRosa(modifica, okMsg) {
  if (!API.url) { toast('Collega prima il foglio (Altro → Collegamento)'); return false; }
  wseq++;
  syncState.busy = true; renderSync();
  try { setData(await apiGet()); }
  catch (e) { syncState.busy = false; renderSync(); toast('Non riesco a leggere il foglio: ' + e.message); return false; }
  return write('saveRosa', modifica(S.rosa || []), okMsg);
}

/* ───────── Calcoli ───────── */
function bonus() {
  const salvati = S?.config?.bonus || {};
  const b = Object.assign({}, DEFAULT_BONUS, salvati);
  // vecchie impostazioni: un solo valore "gol" per tutti
  if (salvati.gol != null) ['golP', 'golD', 'golC', 'golA'].forEach(k => { if (salvati[k] == null) b[k] = Number(salvati.gol); });
  return b;
}
// Fantavoto. rep = reparto del giocatore (P/D/C/A): serve per il bonus gol e il portiere imbattuto.
function fv(v, b = bonus(), rep = 'C') {
  if (isSV(v)) return null;
  const n = k => Number(v[k]) || 0;
  const golB = b['gol' + rep] ?? b.golC;
  const imb = rep === 'P' && n('Gs') === 0 ? b.imbattuto : 0;
  return Number(v.Voto) + golB * n('Gf') + b.rigore * n('Rf') + b.rigoreSbagliato * n('Rs') + b.rigoreParato * n('Rp')
    + b.golSubito * n('Gs') + b.autogol * n('Au') + b.amm * n('Amm') + b.esp * n('Esp') + b.assist * n('Ass') + imb;
}
const isSV = v => v.SV === true || v.SV === 'TRUE' || v.SV === 'true' || String(v.Voto).includes('*') || v.Voto === '' || v.Voto == null || isNaN(Number(v.Voto));
const esitoK = e => { const c = String(e || '').trim()[0]?.toUpperCase(); return ['V', 'P', 'S'].includes(c) ? c : ''; };
// Gol fantacalcio dai punti: sotto la soglia 0 gol, poi uno ogni "fascia" punti (di solito 66 e 6)
function golFanta(pt) {
  const c = S?.config || {}; const soglia = Number(c.soglia) || 66, fascia = Number(c.fascia) || 6;
  return pt == null ? null : pt < soglia ? 0 : Math.floor((pt - soglia) / fascia) + 1;
}
function esitoAuto(pt, pa) {
  if (pt == null || pa == null) return '';
  const a = golFanta(pt), b = golFanta(pa);
  return a > b ? 'V' : a < b ? 'S' : 'P';
}
const parseForm = f => { if (!f) return null; if (typeof f === 'object') return f; try { return JSON.parse(f); } catch (e) { return null; } };

function D() {
  if (_D && _Dkey === S) return _D;
  const b = bonus();
  const rosa = (S?.rosa || []).filter(p => p.Id && attivo(p));
  const tutti = (S?.rosa || []).filter(p => p.Id);
  const byId = Object.fromEntries(tutti.map(p => [p.Id, p]));
  const gA = [...new Set((S?.voti || []).map(v => Number(v.Giornata)).filter(Boolean))].sort((a, b) => a - b);
  const ultimaA = gA[gA.length - 1];
  const votiP = {};
  (S?.voti || []).forEach(v => { (votiP[v.Id] ||= []).push({ ...v, G: Number(v.Giornata), FV: fv(v, b, byId[v.Id]?.Reparto) }); });
  Object.values(votiP).forEach(a => a.sort((x, y) => x.G - y.G));

  const giornate = (S?.giornate || []).map(g => {
    const pt = numOrNull(g.Punteggio), pa = numOrNull(g.PuntiAvv);
    const eMan = esitoK(g.Esito);
    return { ...g, n: Number(g.Giornata), A: numOrNull(g.GiornataA), pt, pa, e: eMan || esitoAuto(pt, pa), eAuto: !eMan && !!esitoAuto(pt, pa), F: parseForm(g.Formazione) };
  }).filter(g => g.n).sort((a, b) => a.n - b.n);

  // statistiche giocatori
  const st = {};
  tutti.forEach(p => {
    const vs = votiP[p.Id] || [];
    const giocate = vs.filter(v => v.FV != null);
    const last3 = giocate.slice(-3).map(v => v.FV);
    st[p.Id] = {
      id: p.Id, pres: giocate.length, sv: vs.length - giocate.length,
      mv: avg(giocate.map(v => Number(v.Voto))), fm: avg(giocate.map(v => v.FV)), forma: avg(last3),
      gol: sum(vs.map(v => (Number(v.Gf) || 0) + (Number(v.Rf) || 0))), ass: sum(vs.map(v => Number(v.Ass) || 0)),
      amm: sum(vs.map(v => Number(v.Amm) || 0)), esp: sum(vs.map(v => Number(v.Esp) || 0)),
      gs: sum(vs.map(v => Number(v.Gs) || 0)), rp: sum(vs.map(v => Number(v.Rp) || 0)), rs: sum(vs.map(v => Number(v.Rs) || 0)),
      bonus: sum(giocate.map(v => v.FV - Number(v.Voto))),
      saltataUltima: ultimaA != null && !vs.some(v => v.G === ultimaA),
      tit: 0, migl: 0, pegg: 0, pos: {}, titFV: [], crediti: Number(p.Crediti) || 0
    };
  });
  const votoDi = (id, A) => (votiP[id] || []).find(v => v.G === A);
  giornate.forEach(g => {
    if (st[g.Migliore]) st[g.Migliore].migl++;
    if (st[g.Peggiore]) st[g.Peggiore].pegg++;
    if (g.F?.slot) {
      const slots = slotsDi(g.F.modulo);
      g.F.slot.forEach((id, i) => {
        if (!st[id]) return;
        st[id].tit++;
        const lab = slots[i] ? slotLabel(slots[i]) : '?';
        const v = g.A != null ? votoDi(id, g.A) : null;
        const e = (st[id].pos[lab] ||= { n: 0, fv: [] }); e.n++;
        if (v && v.FV != null) { e.fv.push(v.FV); st[id].titFV.push(v.FV); }
      });
    }
  });
  const conForm = giornate.filter(g => g.F?.slot).length;
  const ultime3 = gA.slice(-3);
  const IND = S?.config?.indisponibili || {};
  Object.values(st).forEach(s => {
    s.titPct = conForm ? s.tit / conForm : null;
    // assenze nelle ultime 3 giornate caricate (non a referto o senza voto): pesano sul fantavoto previsto
    const vs = votiP[s.id] || [];
    s.assenze3 = ultime3.filter(g => !vs.some(v => v.G === g && v.FV != null)).length;
    s.stato = statoGiocatore(s, vs, ultimaA, IND[s.id]);
    s.score = s.pres ? 0.45 * s.fm + 0.55 * (s.forma ?? s.fm) - 0.4 * s.assenze3 : 4.5;
    if (s.stato.m === 'dub') s.score -= 0.5;
  });

  // squadra
  const conEsito = giornate.filter(g => g.e);
  const rec = { V: 0, P: 0, S: 0 };
  conEsito.forEach(g => rec[g.e]++);
  const punti = giornate.filter(g => g.pt != null).map(g => g.pt);
  const moduli = {};
  giornate.forEach(g => {
    const m = g.F?.modulo || g.Modulo; if (!m) return;
    const x = (moduli[m] ||= { m, n: 0, V: 0, P: 0, S: 0, pt: [] });
    x.n++; if (g.e) x[g.e]++; if (g.pt != null) x.pt.push(g.pt);
  });

  _D = { rosa, tutti, byId, votiP, giornate, st, gA, ultimaA, rec, punti, moduli, votoDi, b, conForm };
  _Dkey = S;
  return _D;
}

/* Disponibilità: segnata a mano (config.indisponibili) o dedotta dai voti dell'ultima giornata */
const STATI = { ok: 'Disponibile', dub: 'In dubbio', inf: 'Infortunato', squ: 'Squalificato' };
const STATO_ICO = { dub: '❓', inf: '🚑', squ: '🟥', diff: '⚠️' };
// Serie A: squalifica alla 5ª, 10ª, 14ª, 17ª ammonizione e poi a ogni ammonizione dalla 19ª
const SQUALIFICA_AMM = n => [5, 10, 14, 17].includes(n) || n >= 19;
const DIFFIDA_AMM = n => [4, 9, 13, 16, 18].includes(n);
function statoGiocatore(s, vs, ultimaA, man) {
  let auto = null;
  const vu = ultimaA != null ? vs.find(v => v.G === ultimaA) : null;
  if (vu && Number(vu.Esp) > 0) auto = { m: 'squ', testo: `Espulso nella ${ultimaA}ª: probabile squalifica` };
  else if (vu && Number(vu.Amm) > 0 && SQUALIFICA_AMM(s.amm)) auto = { m: 'squ', testo: `${s.amm}ª ammonizione nella ${ultimaA}ª: probabile squalifica` };
  else if (DIFFIDA_AMM(s.amm)) auto = { m: 'diff', testo: `Diffidato (${s.amm} gialli)` };
  if (man?.m && man.m !== 'ok') return { m: man.m, testo: STATI[man.m] + (man.nota ? ': ' + man.nota : ''), man: true, escluso: man.m === 'inf' || man.m === 'squ', auto };
  if (auto && auto.m === 'squ' && man?.m !== 'ok') return { ...auto, escluso: true, auto };
  return auto?.m === 'diff' ? { ...auto, escluso: false, auto } : { m: '', testo: '', escluso: false, auto: man?.m === 'ok' ? auto : null };
}
const statoBadge = s => s?.m && STATO_ICO[s.m] ? `<span class="stato ${s.m}" title="${esc(s.testo)}">${STATO_ICO[s.m]}</span>` : '';

/* Formazione migliore: assegnazione ottimale (algoritmo ungherese) */
function hungarian(a) {
  const n = a.length, m = a[0].length, INF = 1e15;
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = Array(m + 1).fill(INF), used = Array(m + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const ans = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}
function bestXI(modulo) {
  const { st } = D();
  const rosa = D().rosa.filter(p => !st[p.Id].stato.escluso); // infortunati e squalificati restano fuori
  const slots = slotsDi(modulo);
  if (!rosa.length) return { slot: slots.map(() => ''), tot: 0, buchi: slots.length, media: null };
  // se i disponibili sono meno degli 11 posti aggiungo "posti vuoti" finti, così schiero comunque chi c'è
  const vuoti = Math.max(0, slots.length - rosa.length);
  const cost = slots.map(r => [...rosa.map(p => compat(p, r) ? 20 - st[p.Id].score : 1000), ...Array(vuoti).fill(1000)]);
  const ass = hungarian(cost);
  let tot = 0, buchi = 0;
  const slot = ass.map((j, i) => {
    if (j < 0 || j >= rosa.length || cost[i][j] >= 1000) { buchi++; return ''; }
    tot += st[rosa[j].Id].score; return rosa[j].Id;
  });
  return { slot, tot, buchi, media: tot / Math.max(1, slots.length - buchi) };
}

/* ───────── UI helpers ───────── */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function openSheet(html, onMount) {
  const s = $('#sheet');
  s.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  s.hidden = false; document.body.style.overflow = 'hidden';
  s.onclick = e => {
    if (e.target === s || e.target.closest('[data-close]')) return closeSheet();
    const f = e.target.closest('[data-foto]'); if (f) cambiaFoto(f.dataset.foto);
  };
  onMount && onMount($('.panel', s));
}
function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; document.body.style.overflow = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
const shortName = n => { const s = String(n || ''); return s.length > 11 ? s.split(' ')[0] : s; };
function heat(x) {
  if (x == null) return 'background:var(--surface-2);color:var(--ink-3)';
  if (x >= 7.5) return 'background:color-mix(in srgb,var(--win) 85%,transparent);color:var(--on-strong)';
  if (x >= 6.75) return 'background:color-mix(in srgb,var(--win) 35%,transparent)';
  if (x >= 6) return 'background:var(--surface-2)';
  if (x >= 5.5) return 'background:color-mix(in srgb,var(--loss) 30%,transparent)';
  return 'background:color-mix(in srgb,var(--loss) 80%,transparent);color:var(--on-strong)';
}
const resBadge = (e, cls = '') => e ? `<span class="res ${e} ${cls}" title="${{ V: 'Vittoria', P: 'Pareggio', S: 'Sconfitta' }[e]}">${e}</span>` : '';
const ICON = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>',
  sync: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></svg>',
  wand: '<svg viewBox="0 0 24 24"><path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM4 20l11-11M18 13l.7 1.3L20 15l-1.3.7L18 17l-.7-1.3L16 15l1.3-.7z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5zM8 4v5h7M8 20v-6h8v6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
};

/* ───────── Router ───────── */
function go(v) { view = v; LS.set('fc_view', v); render(); window.scrollTo(0, 0); }
$$('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

function render() {
  $$('.tab').forEach(b => b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const main = $('#main');
  if (!S && view !== 'altro') { main.innerHTML = vuoto(); bind(main); return; }
  main.innerHTML = ({ squadra: vSquadra, formazione: vFormazione, giornate: vGiornate, giocatori: vStatistiche, altro: vAltro }[view] || vSquadra)();
  bind(main);
  renderSync();
  caricaFoto();
}
function renderSync() {
  const el = $('#sync'); if (!el) return;
  if (syncState.busy) el.innerHTML = '<span class="spin"></span> Sincronizzo…';
  else if (syncState.error) el.textContent = 'Offline · ' + syncState.error;
  else if (syncState.last) el.textContent = 'Aggiornato ' + new Date(syncState.last).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  else el.textContent = '';
}
function vuoto() {
  return `<div class="card empty-state" style="margin-top:40px"><b>Collega il tuo foglio</b>
    Inserisci l'indirizzo dello script e la chiave per vedere rosa, partite e statistiche.<br><br>
    <button class="btn primary" data-go="altro">Vai al collegamento</button></div>`;
}

/* ───────── Foto giocatori (Wikipedia, con link manuale) ───────── */
const FOTO = LS.get('fc_foto', {});
const REP_C = { P: 'por', D: 'dif', C: 'cen', A: 'att' };
const cognome = n => String(n || '').split(/\s+/).filter(w => !/^\p{L}{1,2}\.$/u.test(w)).join(' ') || String(n || '');
const iniziali = n => cognome(n).split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fotoDi = p => p?.Foto || FOTO[p?.Id]?.u || '';
const imgTag = u => `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
function avatar(p, cls = '') {
  if (!p) return `<span class="av ${cls}"><i>?</i></span>`;
  const u = fotoDi(p);
  return `<span class="av ${cls}" data-av="${esc(p.Id)}" style="--rc:var(--r-${REP_C[p.Reparto] || 'cen'})">${u ? imgTag(u) : ''}<i>${esc(iniziali(p.Nome))}</i></span>`;
}
async function cercaFoto(p) {
  if (!p) return '';
  const cg = cognome(p.Nome); const key = norm(cg).split(' ').pop();
  const prove = [['it', `${cg} calciatore ${p.Squadra || ''}`], ['it', `${cg} calciatore`], ['en', `${cg} footballer ${p.Squadra || ''}`]];
  for (const [lang, q] of prove) {
    const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=400&gsrsearch=${encodeURIComponent(q)}`);
    if (!r.ok) continue;
    const j = await r.json();
    const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
    const hit = pages.find(pg => pg.thumbnail && norm(pg.title).includes(key) && !/stagione|season/i.test(pg.title) && !/\.svg/i.test(pg.thumbnail.source));
    if (hit) return hit.thumbnail.source;
  }
  return '';
}
const fotoCoda = new Set(), fotoInCorso = new Set(); let fotoAttivi = 0;
function caricaFoto() {
  if (!S) return;
  const now = Date.now();
  (S.rosa || []).forEach(p => {
    if (!p.Id || p.Foto || fotoInCorso.has(p.Id)) return;
    const c = FOTO[p.Id];
    if (c && c.n === p.Nome && (c.u || now - c.t < 7 * 864e5)) return;
    fotoCoda.add(p.Id);
  });
  pompaFoto();
}
function pompaFoto() {
  while (fotoAttivi < 3 && fotoCoda.size) {
    const id = fotoCoda.values().next().value; fotoCoda.delete(id); fotoAttivi++; fotoInCorso.add(id);
    const p = D().byId[id];
    cercaFoto(p).then(u => { FOTO[id] = { u, t: Date.now(), n: p?.Nome }; LS.set('fc_foto', FOTO); if (u) mostraFoto(id, u); })
      .catch(() => {}).finally(() => { fotoAttivi--; fotoInCorso.delete(id); pompaFoto(); });
  }
}
function mostraFoto(id, u) {
  $$('[data-av]').filter(el => el.dataset.av === id).forEach(el => { el.querySelector('img')?.remove(); el.insertAdjacentHTML('afterbegin', imgTag(u)); });
}
async function cambiaFoto(id) {
  const p = D().byId[id]; if (!p) return;
  const u = prompt(`Incolla il link di una foto di ${p.Nome}\n(tieni premuto sull'immagine → "Copia indirizzo immagine").\nLascia vuoto per tornare alla foto automatica.`, p.Foto || '');
  if (u === null) return;
  const link = u.trim();
  if (link && !/^https:\/\//.test(link)) { toast('Il link deve iniziare con https://'); return; }
  if (link) FOTO[id] = { u: link, t: Date.now(), n: p.Nome, man: true }; else delete FOTO[id];
  LS.set('fc_foto', FOTO);
  if (await salvaRosa(r => r.map(x => x.Id === id ? { ...x, Foto: link } : x), link ? 'Foto aggiornata' : 'Torno alla foto automatica')) { closeSheet(); playerSheet(id); }
  else render();
}

/* ───────── Vista: Squadra ───────── */
function vSquadra() {
  const d = D(); const c = S.config || {};
  const conE = d.giornate.filter(g => g.e);
  const ultime = conE.slice(-6);
  const media = avg(d.punti);
  const pct = conE.length ? Math.round(d.rec.V / conE.length * 100) : 0;
  const ptsLega = d.rec.V * 3 + d.rec.P;
  const NOMI = { V: ['vittoria', 'vittorie'], P: ['pareggio', 'pareggi'], S: ['sconfitta', 'sconfitte'] };
  let streak = '';
  if (conE.length) { const e0 = conE[conE.length - 1].e; let k = 0; for (let i = conE.length - 1; i >= 0 && conE[i].e === e0; i--) k++; streak = k > 1 ? `${k} ${NOMI[e0][1]} di fila` : `Ultima: ${NOMI[e0][0]}`; }
  const top = (k, min = 0, f = s => s[k]) => Object.values(d.st).filter(s => attivo(d.byId[s.id]) && s.pres >= min && f(s) != null && f(s) > 0).sort((a, b) => f(b) - f(a))[0];
  const star = (label, icon, s, val, sub) => { const p = s && d.byId[s.id];
    return `<button class="star" data-player="${p ? p.Id : ''}">${avatar(p, 'xl')}<span class="star-tag">${icon} ${label}</span>
      <b>${p ? esc(shortName(p.Nome)) : '–'}</b><small>${p ? val(s) : sub || 'Nessun dato'}</small></button>`; };
  const spesi = sum(d.rosa.map(p => Number(p.Crediti) || 0)); const budget = Number(c.budget) || 300;
  const perRep = ['P', 'D', 'C', 'A'].map(r => ({ r, cr: sum(d.rosa.filter(p => p.Reparto === r).map(p => Number(p.Crediti) || 0)), n: d.rosa.filter(p => p.Reparto === r).length }));
  const last = d.giornate[d.giornate.length - 1];
  const sq = c.squadra || 'La mia squadra';
  const crest = sq.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const classifica = d.rosa.map(p => d.st[p.Id]).filter(s => s.pres >= 1 && s.fm != null).sort((a, b) => b.fm - a.fm).slice(0, 5);
  const maxFm = Math.max(7, ...classifica.map(s => s.fm));
  const modTop = Object.values(d.moduli).sort((a, b) => b.n - a.n)[0];

  return `
  <section class="hero">
    <div class="hero-top">
      <div class="crest" aria-hidden="true">${esc(crest)}</div>
      <div class="hero-id"><div class="lega">${esc(c.lega || 'Fantacalcio Mantra')} · 2026/27</div><div class="team">${esc(sq)}</div></div>
    </div>
    <div class="hero-main">
      <div class="ring" style="--p:${pct}" aria-label="${pct}% di partite vinte"><div><b>${pct}%</b><span>vinte</span></div></div>
      <div class="hero-stats">
        <div class="pill-stat"><b>${ptsLega}</b><span>Punti</span></div>
        <div class="pill-stat"><b>${fmt(media, 1)}</b><span>Media</span></div>
        <div class="pill-stat"><b>${d.punti.length ? fmt(Math.max(...d.punti), 1) : '–'}</b><span>Record</span></div>
        <div class="pill-stat wide"><b class="vps"><i class="V">${d.rec.V}</i><i class="P">${d.rec.P}</i><i class="S">${d.rec.S}</i></b><span>V · P · S</span></div>
      </div>
    </div>
    ${ultime.length ? `<div class="hero-form"><div class="form-strip" aria-label="Ultimi risultati">${ultime.map(g => resBadge(g.e)).join('')}</div><span>${streak}</span></div>` : ''}
  </section>

  <div class="quick section">
    <button class="qa primary" data-act="nuova-giornata"><span class="qi">${ICON.plus}</span><b>Registra</b><small>nuova partita</small></button>
    <button class="qa" data-go="formazione"><span class="qi">${ICON.wand}</span><b>Chi schiero?</b><small>${modTop ? 'di solito ' + esc(modTop.m) : 'undici consigliato'}</small></button>
    <button class="qa" data-go="altro" data-scroll="import"><span class="qi">${ICON.up}</span><b>Carica voti</b><small>${d.ultimaA ? 'ultima: ' + d.ultimaA + 'ª' : 'file fantacalcio.it'}</small></button>
  </div>

  ${last ? `<div class="section"><h3>Ultima partita</h3>${spotlight(last)}</div>` : ''}

  <div class="section"><h3>I protagonisti</h3>
  <div class="stars">
    ${star('Bomber', '⚽', top('gol'), s => `${s.gol} gol · ${s.pres} pres.`)}
    ${star('Assistman', '🎯', top('ass'), s => `${s.ass} assist`)}
    ${star('Fantamedia', '⭐', top('fm', 2), s => `FM ${fmt(s.fm)}`, 'Min. 2 presenze')}
    ${star('In forma', '🔥', top('forma', 2), s => `Ultime 3: ${fmt(s.forma)}`, 'Min. 2 presenze')}
    ${star('MVP', '🏆', top('migl'), s => `${s.migl} ${s.migl === 1 ? 'volta' : 'volte'} migliore`)}
    ${star('Flop', '👎', top('pegg'), s => `${s.pegg} ${s.pegg === 1 ? 'volta' : 'volte'} peggiore`)}
  </div></div>

  <div class="grid grid-2 section">
    <div class="card"><div class="card-head"><h3>Top 5 fantamedia</h3><button class="chip" data-go="giocatori">Tutti →</button></div>
      ${classifica.length ? `<div class="list">${classifica.map((s, i) => { const p = d.byId[s.id]; return `<button class="li rank" data-player="${p.Id}">
        <span class="pos num">${i + 1}</span>${avatar(p)}<div class="grow"><div class="name">${esc(p.Nome)}</div>
        <div class="bar"><i style="width:${Math.max(6, Math.min(100, (s.fm - 4) / (maxFm - 4) * 100))}%;background:var(--r-${REP_C[p.Reparto] || 'cen'})"></i></div></div>
        <span class="heat" style="${heat(s.fm)}">${fmt(s.fm)}</span></button>`; }).join('')}</div>` : '<div class="empty-state small">Carica i voti per vedere la classifica.</div>'}
    </div>
    <div class="card"><div class="card-head"><h3>Punteggi</h3><span class="chip">${d.punti.length} partite</span></div>${chartPunteggi(d.giornate)}</div>
  </div>

  <div class="card section"><div class="card-head"><h3>Crediti</h3><span class="chip ${budget - spesi >= 0 ? 'ok' : 'warn'}">${budget - spesi} rimasti</span></div>
    <div class="kpi" style="margin-bottom:12px"><b>${spesi}<span class="muted" style="font-size:18px"> / ${budget}</span></b></div>
    <div class="stack">${perRep.map(x => `<i style="flex:${x.cr || 0.001};background:var(--r-${REP_C[x.r]})" title="${REPARTI[x.r]}: ${x.cr}"></i>`).join('')}${budget > spesi ? `<i style="flex:${budget - spesi};background:var(--surface-2)"></i>` : ''}</div>
    <div class="legend">${perRep.map(x => `<span><i style="background:var(--r-${REP_C[x.r]})"></i>${REPARTI[x.r]} <b class="num">${x.cr}</b> <span class="muted">(${x.n})</span></span>`).join('')}</div>
  </div>`;
}

function spotlight(g) {
  const d = D();
  const pl = (id, lab, cls) => { const p = d.byId[id]; if (!p) return '';
    const v = g.A != null ? d.votoDi(id, g.A) : null;
    return `<div class="sp-pl ${cls}" data-player="${p.Id}" role="button" tabindex="0">${avatar(p, 'lg')}<div style="min-width:0"><span class="sp-lab">${lab}</span>
      <div class="name">${esc(shortName(p.Nome))}</div>${v && v.FV != null ? `<span class="small muted">FV ${fmt(v.FV, v.FV % 1 ? 1 : 0)}</span>` : ''}</div></div>`; };
  const col = { V: 'win', P: 'draw', S: 'loss' }[g.e] || 'ink-3';
  return `<div class="spot" style="--ec:var(--${col})">
    <button class="spot-head" data-giornata="${g.n}">
      ${g.e ? resBadge(g.e, 'lg') : '<span class="res lg" style="background:var(--surface-2);color:var(--ink-3)">?</span>'}
      <div style="flex:1;min-width:0"><div class="small muted">Partita ${g.n}${g.A ? ` · ${g.A}ª Serie A` : ''}${g.F?.modulo || g.Modulo ? ` · ${esc(g.F?.modulo || g.Modulo)}` : ''}</div>
        <div class="spot-title">${g.Avversario ? 'vs ' + esc(g.Avversario) : ({ V: 'Vittoria', P: 'Pareggio', S: 'Sconfitta' }[g.e] || 'Partita')}</div></div>
      <div class="spot-score"><b>${g.pt != null ? fmtPt(g.pt) : '–'}</b>${g.pa != null ? `<span>${fmtPt(g.pa)} avv.</span>` : ''}${risultato(g)}</div>
    </button>
    ${g.Migliore || g.Peggiore ? `<div class="sp-row">${pl(g.Migliore, '★ Migliore', 'best')}${pl(g.Peggiore, '▼ Peggiore', 'worst')}</div>` : ''}
    ${g.Marcatori ? `<div class="tag-line" style="margin-top:12px">${g.Marcatori.split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="chip">⚽ ${esc(x)}</span>`).join('')}</div>` : ''}
  </div>`;
}

function chartPunteggi(gs) {
  const pts = gs.filter(g => g.pt != null);
  if (pts.length < 1) return '<div class="empty-state small">Registra le partite per vedere l\'andamento.</div>';
  const W = 600, H = 230, pl = 40, pr = 12, pt = 18, pb = 28;
  const vals = pts.map(g => g.pt);
  const lo = Math.floor((Math.min(...vals) - 4) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 4) / 5) * 5;
  const x = i => pts.length === 1 ? (pl + W - pr) / 2 : pl + i * (W - pl - pr) / (pts.length - 1);
  const y = v => pt + (hi - v) * (H - pt - pb) / Math.max(1, hi - lo);
  const ticks = []; for (let t = lo; t <= hi; t += Math.max(5, Math.round((hi - lo) / 4 / 5) * 5)) ticks.push(t);
  const m = avg(vals);
  const col = e => `var(--${{ V: 'win', P: 'draw', S: 'loss' }[e] || 'ink-3'})`;
  const gid = 'ga' + Math.random().toString(36).slice(2, 7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Punteggio per partita">
    ${ticks.map(t => `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
    <line x1="${pl}" x2="${W - pr}" y1="${y(m)}" y2="${y(m)}" stroke="var(--ink-3)" stroke-dasharray="4 4"/>
    <text class="ax" x="${W - pr}" y="${y(m) - 5}" text-anchor="end">media ${fmt(m, 1)}</text>
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${pts.length > 1 ? `<polygon fill="url(#${gid})" points="${x(0)},${H - pb} ${pts.map((g, i) => `${x(i)},${y(g.pt)}`).join(' ')} ${x(pts.length - 1)},${H - pb}"/>` : ''}
    <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((g, i) => `${x(i)},${y(g.pt)}`).join(' ')}"/>
    ${pts.map((g, i) => `<circle cx="${x(i)}" cy="${y(g.pt)}" r="6" fill="${col(g.e)}" stroke="var(--surface)" stroke-width="2"><title>Partita ${g.n}: ${g.pt}</title></circle>
      <text class="lbl" x="${x(i)}" y="${y(g.pt) - 11}" text-anchor="middle">${fmt(g.pt, g.pt % 1 ? 1 : 0)}</text>
      <text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${g.n}</text>`).join('')}
  </svg>`;
}

const risultato = g => g.pt != null && g.pa != null ? `<div class="vs num">${golFanta(g.pt)}-${golFanta(g.pa)}</div>` : '';

function giornataCard(g) {
  const d = D();
  const nm = id => d.byId[id] ? esc(d.byId[id].Nome) : esc(id || '–');
  return `<button class="g-card" data-giornata="${g.n}">
    ${g.e ? resBadge(g.e, 'lg') : '<span class="res lg" style="background:var(--surface-2);color:var(--ink-3)">?</span>'}
    <div style="flex:1;min-width:0">
      <div class="small muted">Partita ${g.n}${g.A ? ` · ${g.A}ª Serie A` : ''}${g.F?.modulo || g.Modulo ? ` · ${esc(g.F?.modulo || g.Modulo)}` : ''}</div>
      <div style="font-weight:700">${g.Avversario ? 'vs ' + esc(g.Avversario) : ({ V: 'Vittoria', P: 'Pareggio', S: 'Sconfitta' }[g.e] || 'Partita')}</div>
      <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">★ ${nm(g.Migliore)} · ▼ ${nm(g.Peggiore)}${g.Marcatori ? ' · ⚽ ' + esc(g.Marcatori) : ''}</div>
    </div>
    <div style="text-align:right"><div class="score">${g.pt != null ? fmtPt(g.pt) : '–'}</div>${g.pa != null ? `<div class="vs">${fmtPt(g.pa)} avv.</div>` : ''}${risultato(g)}</div>
  </button>`;
}

/* ───────── Pitch (riusabile) ───────── */
function pitchHTML(F, opts = {}) {
  const d = D(); const lines = MODULI[F.modulo] || MODULI['4-1-4-1'];
  let k = 0;
  const body = lines.map(line => `<div class="pline">${line.map(r => {
    const i = k++; const id = F.slot?.[i]; const p = d.byId[id];
    const off = p && !compat(p, r);
    let num = '', badge = '';
    if (p && opts.A != null) {
      const v = d.votoDi(id, opts.A);
      num = v ? (v.FV == null ? 'sv' : fmt(v.FV, v.FV % 1 ? 1 : 0)) : '–';
    } else if (p) {
      const s = d.st[id]; num = s.fm != null ? fmt(s.fm, 1) : '–';
      if (s.forma != null && s.pres >= 2) badge = `<span class="fv ${s.forma >= 7 ? 'good' : s.forma < 6 ? 'bad' : ''}" title="Forma ultime 3">${fmt(s.forma, 1)}</span>`;
      badge += statoBadge(s.stato);
    }
    const ko = p && opts.A == null && d.st[id]?.stato.escluso;
    return `<button class="slot ${p ? '' : 'empty'} ${off ? 'off' : ''} ${ko ? 'ko' : ''} ${opts.sel === i ? 'sel' : ''}" ${opts.readonly ? 'disabled style="cursor:default"' : ''} data-slot="${i}" aria-label="${slotLabel(r)}: ${p ? esc(p.Nome) : 'vuoto'}">
      <span class="shirt">${p ? `${avatar(p, 'fill')}<b class="val">${num}</b>` : '+'}${badge}</span>
      <span class="lbl">${p ? esc(shortName(p.Nome)) : '&nbsp;'}</span>
      <span class="slot-role">${slotLabel(r)}${off ? ' ⚠' : ''}</span></button>`;
  }).join('')}</div>`).join('');
  return `<div class="pitch"><div class="lines"></div><div class="box"></div><div class="box top"></div>${body}</div>`;
}

function refit(F, nuovoModulo) {
  // passa a un nuovo modulo tenendo i giocatori compatibili
  const d = D(); const nuovi = slotsDi(nuovoModulo); const vecchi = (F.slot || []).filter(Boolean);
  const out = nuovi.map(() => ''); const usati = new Set();
  nuovi.forEach((r, i) => { const id = vecchi.find(x => !usati.has(x) && compat(d.byId[x], r)); if (id) { out[i] = id; usati.add(id); } });
  return { modulo: nuovoModulo, slot: out };
}

function pickerHTML(F, i) {
  const d = D(); const r = slotsDi(F.modulo)[i];
  const inCampo = new Set(F.slot.filter(Boolean));
  const ord = (a, b) => d.st[b.Id].score - d.st[a.Id].score;
  const ok = d.rosa.filter(p => compat(p, r)).sort(ord), ko = d.rosa.filter(p => !compat(p, r)).sort(ord);
  const row = p => { const s = d.st[p.Id]; return `<button class="li" data-pick="${p.Id}">
      ${avatar(p)}<div class="grow"><div class="name">${esc(p.Nome)} ${roleBadges(p)}${inCampo.has(p.Id) ? ' <span class="chip">in campo</span>' : ''}</div>
      <div class="sub">${esc(p.Squadra || '')} · ${s.pres} pres.${s.stato.testo ? ` · <span style="color:var(--${s.stato.escluso ? 'loss' : 'draw'})">${statoBadge(s.stato)} ${esc(s.stato.testo)}</span>` : s.saltataUltima && d.ultimaA ? ' · <span style="color:var(--draw)">non a referto l\'ultima</span>' : ''}</div></div>
      <div class="right"><div class="big">${fmt(s.fm, 2)}</div><div class="sub">forma ${fmt(s.forma, 1)}</div></div></button>`; };
  return `<div class="card" style="margin-top:14px"><div class="card-head"><h3>Posto ${slotLabel(r)}</h3>
      <div class="row" style="flex:none;gap:6px">${F.slot[i] ? '<button class="btn ghost small" data-pick="">Svuota</button>' : ''}<button class="x" data-pick-close aria-label="Chiudi">×</button></div></div>
    <div class="small muted" style="margin-bottom:6px">Ordinati per rendimento (fantamedia + forma). Numero grande = fantamedia.</div>
    <div class="list">${ok.map(row).join('') || '<div class="muted small">Nessun giocatore con questo ruolo.</div>'}</div>
    ${ko.length ? `<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer;padding:6px 0">Fuori ruolo (${ko.length})</summary><div class="list">${ko.map(row).join('')}</div></details>` : ''}
  </div>`;
}

/* ───────── Vista: Formazione ───────── */
function currentForm() {
  if (!ui.editForm) {
    const f = S.config?.formazione;
    ui.editForm = f?.modulo ? { modulo: f.modulo, slot: [...(f.slot || [])] } : { modulo: '4-1-4-1', slot: [] };
    const n = slotsDi(ui.editForm.modulo).length;
    while (ui.editForm.slot.length < n) ui.editForm.slot.push('');
  }
  return ui.editForm;
}
function vFormazione() {
  const d = D(); const F = currentForm();
  const fuori = F.slot.map((id, i) => id && d.byId[id] && !compat(d.byId[id], slotsDi(F.modulo)[i]) ? d.byId[id].Nome : null).filter(Boolean);
  const malus = bonus().fuoriRuolo;
  const assenti = F.slot.filter(id => id && d.byId[id] && (d.st[id].stato.escluso || !attivo(d.byId[id]))).map(id => d.byId[id].Nome + (attivo(d.byId[id]) ? '' : ' (ceduto)'));
  const avvisi = d.rosa.map(p => ({ p, s: d.st[p.Id] })).filter(x => x.s.stato.m || x.s.stato.auto).sort((a, b) => (b.s.stato.escluso - a.s.stato.escluso));
  const pieni = F.slot.filter(Boolean).length;
  const ranking = Object.keys(MODULI).map(m => ({ m, ...bestXI(m) })).sort((a, b) => b.tot - a.tot);
  const panchina = d.rosa.filter(p => !F.slot.includes(p.Id)).sort((a, b) => d.st[b.Id].score - d.st[a.Id].score);
  const saved = JSON.stringify(S.config?.formazione || {}) === JSON.stringify(F);
  return `
  <div class="head"><div><div class="eyebrow">Prossima partita</div><h1>Formazione</h1></div>
    <div class="head-actions">
      <select class="input" id="modulo" style="width:auto" aria-label="Modulo">${Object.keys(MODULI).map(m => `<option ${m === F.modulo ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <button class="btn" data-act="consiglia">${ICON.wand} Consigliami</button>
      <button class="btn primary" data-act="salva-form" ${saved ? 'disabled' : ''}>${ICON.save} ${saved ? 'Salvata' : 'Salva'}</button>
    </div></div>
  <div class="pitch-wrap">
    <div>
      ${pitchHTML(F, { sel: ui.formSel })}
      <div class="tag-line" style="margin-top:10px">
        <span class="chip ${pieni === 11 ? 'ok' : ''}">${pieni}/11 schierati</span>
        ${fuori.length ? `<span class="chip warn">⚠ Fuori ruolo: ${fuori.map(esc).join(', ')}${malus ? ` (${fmt(malus * fuori.length, 1)})` : ''}</span>` : ''}
        ${assenti.length ? `<span class="chip warn">🚑 Non disponibili: ${assenti.map(esc).join(', ')}</span>` : ''}
        <span class="chip">Sotto la foto: fantamedia · badge: forma ultime 3</span>
      </div>
      ${ui.formSel != null ? pickerHTML(F, ui.formSel) : ''}
    </div>
    <div class="grid">
      <div class="card"><div class="card-head"><h3>Modulo consigliato</h3><span class="chip">dalla forma attuale</span></div>
        <div class="list">${ranking.slice(0, 5).map((x, i) => `<button class="li" data-modulo="${x.m}">
          <span class="num" style="font-size:20px;font-weight:800;width:22px;color:${i ? 'var(--ink-3)' : 'var(--accent)'}">${i + 1}</span>
          <div class="grow"><div class="name">${x.m}</div><div class="sub">${x.buchi ? `${x.buchi} posti senza giocatore adatto` : 'Tutti nel proprio ruolo'}</div></div>
          <div class="right"><div class="big">${fmt(x.media, 2)}</div><div class="sub">media XI</div></div></button>`).join('')}</div>
        <div class="small muted" style="margin-top:8px">Tocca un modulo per caricare l'undici migliore in quel modulo.</div>
      </div>
      <div class="card"><div class="card-head"><h3>Indisponibili e avvisi</h3><span class="chip">${avvisi.filter(x => x.s.stato.escluso).length} fuori</span></div>
        ${avvisi.length ? `<div class="list">${avvisi.map(({ p, s }) => `<button class="li" data-player="${p.Id}">${avatar(p)}
          <div class="grow"><div class="name">${esc(p.Nome)} ${statoBadge(s.stato.m ? s.stato : s.stato.auto)}</div><div class="sub">${esc(s.stato.testo || (s.stato.auto ? s.stato.auto.testo + ' · segnato disponibile' : ''))}</div></div>
          <span class="chip ${s.stato.escluso ? 'warn' : ''}">${s.stato.escluso ? 'escluso' : 'ok'}</span></button>`).join('')}</div>`
          : '<div class="small muted">Nessuno. Tocca un giocatore per segnarlo infortunato, squalificato o in dubbio.</div>'}
        <div class="small muted" style="margin-top:8px">Rossi e somma di gialli sono dedotti dai voti caricati (probabili). "Consigliami" lascia fuori infortunati e squalificati.</div>
      </div>
      <div class="card"><div class="card-head"><h3>Panchina</h3><span class="chip">${panchina.length}</span></div>
        <div class="list">${panchina.map(p => { const s = d.st[p.Id]; return `<button class="li" data-player="${p.Id}">${avatar(p)}
          <div class="grow"><div class="name">${esc(p.Nome)} ${roleBadges(p)} ${statoBadge(s.stato)}</div><div class="sub">${esc(p.Squadra || '')} · ${s.pres} pres.</div></div>
          <div class="right"><div class="big">${fmt(s.fm, 2)}</div><div class="sub">forma ${fmt(s.forma, 1)}</div></div></button>`; }).join('')}</div></div>
    </div>
  </div>`;
}

/* ───────── Vista: Giornate ───────── */
function vGiornate() {
  const d = D(); const gs = [...d.giornate].reverse();
  return `<div class="head"><div><div class="eyebrow">${d.rec.V}V · ${d.rec.P}P · ${d.rec.S}S</div><h1>Partite</h1></div>
    <div class="head-actions"><button class="btn primary" data-act="nuova-giornata">${ICON.plus} Registra partita</button></div></div>
    ${gs.length ? `<div class="grid grid-2">${gs.map(giornataCard).join('')}</div>` : '<div class="card empty-state"><b>Nessuna partita</b>Registra la prima con il pulsante qui sopra.</div>'}`;
}

function giornataDettaglio(n) {
  const d = D(); const g = d.giornate.find(x => x.n === Number(n)); if (!g) return;
  const nm = id => d.byId[id] ? esc(d.byId[id].Nome) : esc(id || '–');
  const tit = (g.F?.slot || []).filter(Boolean);
  const voti = g.A != null ? tit.map(id => ({ p: d.byId[id], v: d.votoDi(id, g.A) })).filter(x => x.p) : [];
  openSheet(`<div class="panel-head"><div><div class="small muted">Partita ${g.n}${g.A ? ` · ${g.A}ª giornata Serie A` : ''}</div>
      <h2>${g.Avversario ? 'vs ' + esc(g.Avversario) : 'Partita ' + g.n}</h2></div><button class="x" data-close aria-label="Chiudi">×</button></div>
    <div class="row" style="align-items:center;margin-bottom:14px">${resBadge(g.e, 'lg')}
      <div><div class="num" style="font-size:34px;font-weight:800;line-height:1">${g.pt != null ? fmtPt(g.pt) : '–'}${g.pa != null ? ` <span class="muted" style="font-size:22px">– ${fmtPt(g.pa)}</span>` : ''}</div>
      <div class="small muted">${esc(g.F?.modulo || g.Modulo || 'Modulo non registrato')}${g.pt != null && g.pa != null ? ` · risultato ${golFanta(g.pt)}-${golFanta(g.pa)}` : ''}${g.eAuto ? ' · esito calcolato dai punti' : ''}</div></div></div>
    ${g.F?.slot?.some(Boolean) ? pitchHTML(g.F, { readonly: true, A: g.A }) + (g.A == null ? '<div class="note" style="margin-top:8px">Collega la giornata di Serie A per vedere i voti in campo.</div>' : '') : '<div class="note">Formazione non registrata per questa partita.</div>'}
    <div class="grid grid-2" style="margin-top:14px">
      <div class="card"><h3>Migliore</h3><div class="pname" style="font-size:18px">${avatar(d.byId[g.Migliore], 'lg')} ★ ${nm(g.Migliore)}</div></div>
      <div class="card"><h3>Peggiore</h3><div class="pname" style="font-size:18px">${avatar(d.byId[g.Peggiore], 'lg')} ▼ ${nm(g.Peggiore)}</div></div>
    </div>
    ${g.Marcatori ? `<div class="card" style="margin-top:14px"><h3>Marcatori</h3>⚽ ${esc(g.Marcatori)}</div>` : ''}
    ${voti.length ? `<div class="card" style="margin-top:14px"><h3>Pagelle</h3><div class="list">${voti.sort((a, b) => (b.v?.FV ?? -1) - (a.v?.FV ?? -1)).map(({ p, v }) => `<div class="li">${avatar(p)}<div class="grow"><div class="name">${esc(p.Nome)} ${roleBadges(p)}</div><div class="sub">${v ? bonusTxt(v) : 'Non a referto'}</div></div>
      <div class="right"><span class="heat" style="${heat(v?.FV)}">${v ? (v.FV == null ? 'sv' : fmt(v.FV, 1)) : '–'}</span><div class="sub">voto ${v ? esc(v.Voto) : '–'}</div></div></div>`).join('')}</div></div>` : ''}
    ${g.Note ? `<div class="note" style="margin-top:14px">${esc(g.Note)}</div>` : ''}
    <div class="row" style="margin-top:16px"><button class="btn danger" data-del-giornata="${g.n}">Elimina</button><button class="btn primary" data-edit-giornata="${g.n}">Modifica</button></div>`,
  panel => {
    panel.querySelector('[data-edit-giornata]').onclick = () => giornataForm(g.n);
    panel.querySelector('[data-del-giornata]').onclick = async () => { if (confirm(`Eliminare la partita ${g.n}?`)) { closeSheet(); await write('deleteGiornata', g.n, 'Partita eliminata'); } };
  });
}
function bonusTxt(v) {
  const p = [];
  const n = k => Number(v[k]) || 0;
  if (n('Gf')) p.push('⚽'.repeat(n('Gf'))); if (n('Rf')) p.push(`rig. ⚽×${n('Rf')}`); if (n('Ass')) p.push(`🅰️×${n('Ass')}`);
  if (n('Amm')) p.push('🟨'); if (n('Esp')) p.push('🟥'); if (n('Gs')) p.push(`-${n('Gs')} subiti`); if (n('Rp')) p.push(`rig. parato×${n('Rp')}`);
  if (n('Rs')) p.push(`rig. sbagliato×${n('Rs')}`); if (n('Au')) p.push(`autogol×${n('Au')}`);
  return p.join(' ') || 'Nessun bonus/malus';
}

/* Form partita */
function giornataForm(n) {
  const d = D();
  const esist = n != null ? d.giornate.find(x => x.n === Number(n)) : null;
  const next = (d.giornate[d.giornate.length - 1]?.n || 0) + 1;
  const F0 = esist?.F?.slot ? { modulo: esist.F.modulo, slot: [...esist.F.slot] } : JSON.parse(JSON.stringify(currentForm()));
  const st = { F: F0, sel: null, esito: esist?.e || '', manuale: !!esitoK(esist?.Esito) };
  const A0 = esist ? esist.A : (d.ultimaA != null && !d.giornate.some(g => g.A === d.ultimaA) ? d.ultimaA : '');

  const draw = panel => {
    const A = panel.querySelector('#gA').value === '' ? null : Number(panel.querySelector('#gA').value);
    const tit = st.F.slot.filter(Boolean);
    const conVoto = A != null ? tit.map(id => ({ id, v: d.votoDi(id, A) })).filter(x => x.v && x.v.FV != null) : [];
    const slots = slotsDi(st.F.modulo); const malus = bonus().fuoriRuolo;
    const nFuori = st.F.slot.filter((id, i) => id && conVoto.some(x => x.id === id) && !compat(d.byId[id], slots[i])).length;
    const stima = conVoto.length ? sum(conVoto.map(x => x.v.FV)) + malus * nFuori : null;
    const best = conVoto.slice().sort((a, b) => b.v.FV - a.v.FV);
    panel.querySelector('#stima').innerHTML = A == null ? 'Scegli la giornata di Serie A per i suggerimenti dai voti.'
      : !d.gA.includes(A) ? `Voti della ${A}ª giornata non ancora caricati.`
      : `Somma fantavoti titolari: <b class="num">${fmt(stima, 1)}</b> (${conVoto.length}/11 a voto${malus && nFuori ? `, ${nFuori} fuori ruolo ${fmt(malus * nFuori, 1)}` : ''}, senza sostituzioni né modificatori)
         <div class="row" style="margin-top:8px"><button type="button" class="btn small" id="usaSugg">Compila migliore, peggiore e marcatori</button></div>`;
    const us = panel.querySelector('#usaSugg');
    if (us) us.onclick = () => {
      if (best[0]) panel.querySelector('#gMig').value = best[0].id;
      if (best.length) panel.querySelector('#gPeg').value = best[best.length - 1].id;
      const marc = [];
      tit.forEach(id => { const v = d.votoDi(id, A); if (!v) return; const g = (Number(v.Gf) || 0) + (Number(v.Rf) || 0); for (let k = 0; k < g; k++) marc.push(d.byId[id].Nome); });
      panel.querySelector('#gMarc').value = marc.join(', ');
      if (panel.querySelector('#gPt').value === '' && stima != null) { panel.querySelector('#gPt').value = Math.round(stima * 2) / 2; aggEsito(panel); }
    };
    panel.querySelector('#pitchBox').innerHTML = pitchHTML(st.F, { sel: st.sel, A: A != null && d.gA.includes(A) ? A : undefined }) + (st.sel != null ? pickerHTML(st.F, st.sel) : '');
    panel.querySelectorAll('#pitchBox [data-slot]').forEach(b => b.onclick = () => { st.sel = st.sel === Number(b.dataset.slot) ? null : Number(b.dataset.slot); draw(panel); });
    panel.querySelectorAll('#pitchBox [data-pick]').forEach(b => b.onclick = () => { pick(st.F, st.sel, b.dataset.pick); st.sel = null; draw(panel); });
    const pc = panel.querySelector('#pitchBox [data-pick-close]'); if (pc) pc.onclick = () => { st.sel = null; draw(panel); };
  };
  const opts = sel => `<option value="">–</option>` + d.tutti.map(p => `<option value="${p.Id}" ${p.Id === sel ? 'selected' : ''}>${esc(p.Nome)}</option>`).join('');
  const aOpts = [...new Set([...d.gA, ...(A0 !== '' && A0 != null ? [A0] : [])])].sort((a, b) => a - b);

  openSheet(`<div class="panel-head"><h2>${esist ? 'Modifica partita ' + esist.n : 'Nuova partita'}</h2><button class="x" data-close aria-label="Chiudi">×</button></div>
    <div class="row"><div class="field"><label for="gN">Partita n°</label><input class="input" id="gN" type="number" min="1" value="${esist ? esist.n : next}"></div>
      <div class="field"><label for="gA">Giornata Serie A</label><select class="input" id="gA"><option value="">–</option>${aOpts.map(a => `<option ${a === A0 ? 'selected' : ''} value="${a}">${a}ª${d.gA.includes(a) ? ' · voti ✓' : ''}</option>`).join('')}
        ${Array.from({ length: 38 }, (_, i) => i + 1).filter(a => !aOpts.includes(a)).map(a => `<option value="${a}">${a}ª</option>`).join('')}</select></div></div>
    <div class="field"><label for="gAvv">Avversario</label><input class="input" id="gAvv" value="${esc(esist?.Avversario || '')}" placeholder="Nome squadra avversaria"></div>
    <div class="row"><div class="field"><label for="gPt">I miei punti</label><input class="input" id="gPt" type="number" step="0.5" inputmode="decimal" value="${esist?.pt ?? ''}"></div>
      <div class="field"><label for="gPa">Punti avversario</label><input class="input" id="gPa" type="number" step="0.5" inputmode="decimal" value="${esist?.pa ?? ''}"></div></div>
    <div class="field"><label>Esito</label><div class="esito-pick">${['V', 'P', 'S'].map(e => `<button type="button" class="${e}" data-esito="${e}" aria-pressed="${st.esito === e}">${{ V: 'Vittoria', P: 'Pareggio', S: 'Sconfitta' }[e]}</button>`).join('')}</div>
      <div class="small muted" id="esitoInfo" style="margin-top:6px"></div></div>
    <div class="field"><label>Formazione schierata</label>
      <div class="row" style="margin-bottom:8px"><select class="input" id="gMod">${Object.keys(MODULI).map(m => `<option ${m === st.F.modulo ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <button type="button" class="btn" id="gUsaAtt">Usa formazione salvata</button></div>
      <div id="pitchBox"></div></div>
    <div class="note" id="stima" style="margin-bottom:12px"></div>
    <div class="row"><div class="field"><label for="gMig">Migliore</label><select class="input" id="gMig">${opts(esist?.Migliore)}</select></div>
      <div class="field"><label for="gPeg">Peggiore</label><select class="input" id="gPeg">${opts(esist?.Peggiore)}</select></div></div>
    <div class="field"><label for="gMarc">Marcatori</label><input class="input" id="gMarc" value="${esc(esist?.Marcatori || '')}" placeholder="es. Malen, Castro S."></div>
    <div class="field"><label for="gNote">Note</label><textarea class="input" id="gNote" rows="2">${esc(esist?.Note || '')}</textarea></div>
    <button class="btn primary block" id="gSave">${ICON.save} Salva partita</button>`,
  panel => {
    panel._st = st;
    draw(panel);
    panel.querySelector('#gA').onchange = () => draw(panel);
    panel.querySelector('#gMod').onchange = e => { st.F = refit(st.F, e.target.value); st.sel = null; draw(panel); };
    panel.querySelector('#gUsaAtt').onclick = () => { st.F = JSON.parse(JSON.stringify(currentForm())); panel.querySelector('#gMod').value = st.F.modulo; draw(panel); };
    panel.querySelectorAll('[data-esito]').forEach(b => b.onclick = () => {
      st.esito = st.esito === b.dataset.esito ? '' : b.dataset.esito; st.manuale = !!st.esito;
      aggEsito(panel);
    });
    panel.querySelector('#gPt').oninput = () => aggEsito(panel);
    panel.querySelector('#gPa').oninput = () => aggEsito(panel);
    aggEsito(panel);
    panel.querySelector('#gSave').onclick = async () => {
      const N = Number(panel.querySelector('#gN').value);
      if (!N) { toast('Inserisci il numero della partita'); return; }
      if (d.giornate.some(g => g.n === N && g !== esist) && !confirm(`La partita ${N} esiste già: la sovrascrivo?`)) return;
      const payload = {
        Giornata: N, GiornataA: panel.querySelector('#gA').value, Punteggio: panel.querySelector('#gPt').value,
        Esito: { V: 'Vittoria', P: 'Pareggio', S: 'Sconfitta' }[st.esito] || '', Avversario: panel.querySelector('#gAvv').value.trim(),
        PuntiAvv: panel.querySelector('#gPa').value, Modulo: st.F.modulo, Formazione: JSON.stringify(st.F),
        Migliore: panel.querySelector('#gMig').value, Peggiore: panel.querySelector('#gPeg').value,
        Marcatori: panel.querySelector('#gMarc').value.trim(), Note: panel.querySelector('#gNote').value.trim()
      };
      const btn = panel.querySelector('#gSave'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Salvo…';
      // prima salvo la nuova; solo se è andata bene cancello quella col vecchio numero (così non si perde niente)
      let ok = await write('saveGiornata', payload, 'Partita salvata');
      if (ok && esist && esist.n !== N) ok = await write('deleteGiornata', esist.n, `Partita spostata da ${esist.n} a ${N}`);
      if (ok) closeSheet(); else { btn.disabled = false; btn.innerHTML = `${ICON.save} Salva partita`; }
    };
  });
}

// Esito: si compila da solo dai punti (soglia 66, un gol ogni 6) finché non lo scegli tu a mano
function aggEsito(panel) {
  const st = panel._st; if (!st) return;
  const pt = numOrNull(panel.querySelector('#gPt').value), pa = numOrNull(panel.querySelector('#gPa').value);
  const auto = esitoAuto(pt, pa);
  if (!st.manuale && auto) st.esito = auto;
  panel.querySelectorAll('[data-esito]').forEach(x => x.setAttribute('aria-pressed', x.dataset.esito === st.esito));
  panel.querySelector('#esitoInfo').textContent = pt != null && pa != null
    ? `Risultato ${golFanta(pt)}-${golFanta(pa)}${st.manuale ? (auto && auto !== st.esito ? ' · esito scelto a mano (diverso dal calcolo)' : '') : ' · esito calcolato dai punti'}`
    : 'Inserisci i punti: l\'esito si compila da solo.';
}

function pick(F, i, id) {
  if (i == null) return;
  if (id) { const j = F.slot.indexOf(id); if (j >= 0 && j !== i) F.slot[j] = F.slot[i] || ''; }
  F.slot[i] = id || '';
}

/* ───────── Vista: Statistiche ───────── */
function vStatistiche() {
  const tabs = { giocatori: 'Giocatori', ruoli: 'Chi schierare', moduli: 'Moduli', squadra: 'Squadra' };
  return `<div class="head"><div><div class="eyebrow">Analisi</div><h1>Statistiche</h1></div></div>
    <div class="seg" role="tablist" style="margin-bottom:16px">${Object.entries(tabs).map(([k, l]) => `<button data-stat="${k}" aria-pressed="${ui.statTab === k}">${l}</button>`).join('')}</div>
    ${({ giocatori: stGiocatori, ruoli: stRuoli, moduli: stModuli, squadra: stSquadra }[ui.statTab])()}`;
}
function stGiocatori() {
  const d = D();
  const cols = [
    ['pres', 'Pres', s => s.pres], ['tit', 'Tit', s => s.tit], ['mv', 'MV', s => fmt(s.mv)], ['fm', 'FM', s => `<span class="heat" style="${heat(s.fm)}">${fmt(s.fm)}</span>`],
    ['forma', 'Forma', s => `<span class="heat" style="${heat(s.forma)}">${fmt(s.forma, 1)}</span>`], ['gol', 'Gol', s => s.gol || '·'], ['ass', 'Ass', s => s.ass || '·'],
    ['amm', '🟨', s => s.amm || '·'], ['esp', '🟥', s => s.esp || '·'], ['migl', '★', s => s.migl || '·'], ['pegg', '▼', s => s.pegg || '·'],
    ['bonus', 'Bonus', s => s.bonus ? (s.bonus > 0 ? '+' : '') + fmt(s.bonus, 1) : '·'], ['crediti', 'Cr', s => s.crediti]
  ];
  const rows = d.rosa.filter(p => ui.rep === 'T' || p.Reparto === ui.rep).map(p => d.st[p.Id])
    .sort((a, b) => ((a[ui.sortKey] ?? -99) - (b[ui.sortKey] ?? -99)) * (ui.sortDir < 0 ? -1 : 1));
  return `<div class="card">
    <div class="card-head"><div class="seg">${[['T', 'Tutti'], ['P', 'Por'], ['D', 'Dif'], ['C', 'Cen'], ['A', 'Att']].map(([k, l]) => `<button data-rep="${k}" aria-pressed="${ui.rep === k}">${l}</button>`).join('')}</div></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Giocatore</th>${cols.map(([k, l]) => `<th data-sort="${k}" ${ui.sortKey === k ? 'aria-sort="' + (ui.sortDir < 0 ? 'descending' : 'ascending') + '"' : ''}>${l}${ui.sortKey === k ? (ui.sortDir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(s => { const p = d.byId[s.id]; return `<tr data-player="${p.Id}"><td><span class="pname">${avatar(p, 'sm')} ${esc(p.Nome)} ${roleBadges(p)} ${statoBadge(s.stato)}</span></td>${cols.map(([, , f]) => `<td>${f(s)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
    <div class="small muted" style="margin-top:10px">Pres = partite a voto in Serie A · Tit = volte titolare nella tua squadra · FM = fantamedia · Forma = media ultime 3 · ★/▼ = migliore/peggiore della tua squadra · Bonus = somma bonus/malus.</div>
  </div>`;
}
// Quadratini con i fantavoti delle ultime 5 giornate di Serie A caricate
function ultime5(id) {
  const d = D(); const vs = d.votiP[id] || [];
  return `<span class="f5" aria-label="Ultime 5 giornate">${d.gA.slice(-5).map(g => {
    const v = vs.find(x => x.G === g);
    if (!v) return `<i class="no" title="${g}ª: non a referto">–</i>`;
    if (v.FV == null) return `<i class="no" title="${g}ª: senza voto">sv</i>`;
    return `<i style="${heat(v.FV)}" title="${g}ª: ${fmt(v.FV, 1)}">${fmt(v.FV, v.FV % 1 ? 1 : 0)}</i>`;
  }).join('')}</span>`;
}
const trend = s => s.pres < 2 || s.forma == null ? '' : s.forma - s.fm >= 0.3 ? '<span class="tr up" title="In crescita">▲</span>' : s.forma - s.fm <= -0.3 ? '<span class="tr down" title="In calo">▼</span>' : '';

function stRuoli() {
  const d = D();
  const ordina = (a, b) => (d.st[b.Id].pres > 0) - (d.st[a.Id].pres > 0) || d.st[b.Id].score - d.st[a.Id].score;
  const ruoli = ORDINE_RUOLI.map(r => ({ r, ps: d.rosa.filter(p => ruoliDi(p).includes(r)).sort(ordina) })).filter(x => x.ps.length);
  if (!ruoli.length) return '<div class="card empty-state"><b>Nessun giocatore</b>Aggiungi la rosa in Altro.</div>';
  if (ui.ruolo !== 'tutti' && !ruoli.some(x => x.r === ui.ruolo)) ui.ruolo = 'tutti';
  const scelti = ui.ruolo === 'tutti' ? ruoli : ruoli.filter(x => x.r === ui.ruolo);

  const riga = (p, i, r) => {
    const s = d.st[p.Id];
    const qui = Object.entries(s.pos).filter(([lab]) => lab.split('/').includes(RUOLI[r].l)).flatMap(([, e]) => e.fv);
    const prev = s.pres ? s.score : null;
    const tags = [
      qui.length ? `<span class="tag">In questo ruolo: <b>${fmt(avg(qui), 1)}</b> (${qui.length}×)</span>` : '',
      s.stato.testo ? `<span class="tag warn">${esc(s.stato.testo)}</span>` : '',
      s.saltataUltima && d.ultimaA && (d.votiP[p.Id] || []).length ? `<span class="tag warn">Non a referto la ${d.ultimaA}ª</span>` : ''
    ].join('');
    return `<button class="rk ${i === 0 && prev != null ? 'top' : ''}" data-player="${p.Id}">
      <span class="rk-pos num">${i + 1}</span>${avatar(p)}
      <span class="rk-main">
        <span class="rk-name">${esc(p.Nome)} ${statoBadge(s.stato)}</span>
        <span class="rk-sub">${esc(p.Squadra || '')}${s.pres ? ` · FM ${fmt(s.fm)} ${trend(s)}` : ' · ancora nessun voto'}</span>
        ${d.gA.length ? ultime5(p.Id) : ''}
        ${tags ? `<span class="rk-tags">${tags}</span>` : ''}
      </span>
      <span class="rk-score"><b class="num" style="${heat(prev)}">${prev == null ? '–' : fmt(prev, 1)}</b><small>previsto</small></span>
    </button>`;
  };

  return `<div class="rpick" role="tablist" aria-label="Ruolo">
      <button class="all" data-ruolo="tutti" aria-pressed="${ui.ruolo === 'tutti'}">Tutti</button>
      ${ruoli.map(x => `<button data-ruolo="${x.r}" aria-pressed="${ui.ruolo === x.r}"><span class="role ${RUOLI[x.r].c}">${RUOLI[x.r].l}</span>${x.ps.length}</button>`).join('')}
    </div>
    <details class="info"><summary>Come si legge?</summary>
      <ul><li><b>Numero a destra</b> = fantavoto previsto: mix di fantamedia (45%) e forma delle ultime 3 (55%), più basso per ogni assenza nelle ultime 3 giornate e se è in dubbio.</li>
      <li><b>Quadratini</b> = fantavoti delle ultime 5 giornate (– non a referto, sv senza voto).</li>
      <li><b>▲ ▼</b> = in crescita o in calo rispetto alla sua media.</li>
      <li><b>In questo ruolo</b> = fantavoto medio quando l'hai schierato lì.</li></ul></details>
    <div class="grid grid-2">${scelti.map(({ r, ps }) => `<div class="card rk-card">
      <div class="card-head"><div class="rk-title"><span class="role lg ${RUOLI[r].c}">${RUOLI[r].l}</span><b>${RUOLO_NOME[r]}</b></div><span class="chip">${ps.length}</span></div>
      ${ps.map((p, i) => riga(p, i, r)).join('')}</div>`).join('')}</div>`;
}
function stModuli() {
  const d = D();
  const ms = Object.keys(MODULI).map(m => ({ m, rec: d.moduli[m], best: bestXI(m) })).sort((a, b) => (b.rec?.n || 0) - (a.rec?.n || 0) || b.best.tot - a.best.tot);
  return `<div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Modulo</th><th>Giocate</th><th>V</th><th>P</th><th>S</th><th>Media punti</th><th>Max</th><th>XI potenziale</th></tr></thead>
    <tbody>${ms.map(({ m, rec, best }) => `<tr data-modulo="${m}"><td><b>${m}</b></td><td>${rec?.n || '·'}</td><td>${rec?.V || '·'}</td><td>${rec?.P || '·'}</td><td>${rec?.S || '·'}</td>
      <td>${rec?.pt.length ? fmt(avg(rec.pt), 1) : '–'}</td><td>${rec?.pt.length ? fmt(Math.max(...rec.pt), 1) : '–'}</td><td><span class="heat" style="${heat(best.media)}">${fmt(best.media, 2)}</span>${best.buchi ? ` <span class="small muted">(${best.buchi} buchi)</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <div class="small muted" style="margin-top:10px">Media punti e risultati arrivano dalle partite registrate con la formazione. "XI potenziale" = indice medio dell'undici migliore oggi in quel modulo (tocca una riga per caricarlo in Formazione).</div></div>`;
}
function stSquadra() {
  const d = D();
  const gs = d.giornate;
  const reparti = { P: [], D: [], C: [], A: [] };
  gs.forEach(g => { if (g.A == null || !g.F?.slot) return; g.F.slot.forEach(id => { const p = d.byId[id]; const v = p && d.votoDi(id, g.A); if (v && v.FV != null) reparti[p.Reparto]?.push(v.FV); }); });
  const golTot = gs.reduce((a, g) => a + (g.Marcatori ? g.Marcatori.split(',').filter(x => x.trim()).length : 0), 0);
  return `<div class="grid grid-4" style="margin-bottom:14px">
      <div class="card kpi"><span>Partite</span><b>${gs.length}</b></div>
      <div class="card kpi"><span>Punti medi</span><b>${fmt(avg(d.punti), 1)}</b></div>
      <div class="card kpi"><span>Record</span><b>${d.punti.length ? fmt(Math.max(...d.punti), 1) : '–'}</b></div>
      <div class="card kpi"><span>Gol segnati</span><b>${golTot}</b></div></div>
    <div class="grid grid-2">
      <div class="card"><h3>Andamento</h3>${chartPunteggi(gs)}</div>
      <div class="card"><h3>Fantavoto medio per reparto (titolari)</h3>
        ${Object.entries(reparti).map(([r, a]) => `<div class="li"><span class="role ${{ P: 'por', D: 'dif', C: 'cen', A: 'att' }[r]}">${r}</span><div class="grow">${REPARTI[r]}</div><span class="heat" style="${heat(avg(a))}">${fmt(avg(a), 2)}</span><span class="small muted" style="width:44px;text-align:right">${a.length} voti</span></div>`).join('')}
        <div class="small muted" style="margin-top:8px">Serve la formazione registrata e la giornata di Serie A collegata.</div></div>
    </div>`;
}

/* Scheda giocatore */
function playerSheet(id) {
  const d = D(); const p = d.byId[id]; if (!p) return;
  const s = d.st[id]; const vs = d.votiP[id] || [];
  openSheet(`<div class="panel-head"><div class="ps-head"><button class="av-btn" data-foto="${p.Id}" aria-label="Cambia foto">${avatar(p, 'xxl')}<span class="av-edit">✎</span></button><div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${roleBadges(p)}<span class="small muted">${esc(p.Squadra || '')} · ${esc(p.Crediti)} crediti</span></div><h2>${esc(p.Nome)}</h2></div></div><button class="x" data-close aria-label="Chiudi">×</button></div>
    <div class="grid grid-4">
      <div class="card kpi"><span>Presenze</span><b>${s.pres}</b>${s.sv ? `<small>${s.sv} s.v.</small>` : ''}</div>
      <div class="card kpi"><span>Fantamedia</span><b>${fmt(s.fm)}</b><small>MV ${fmt(s.mv)}</small></div>
      <div class="card kpi"><span>Gol / Assist</span><b>${s.gol} / ${s.ass}</b><small>${s.amm} 🟨 ${s.esp} 🟥</small></div>
      <div class="card kpi"><span>Nella tua squadra</span><b>${s.tit}</b><small>titolare · ★${s.migl} ▼${s.pegg}</small></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card-head"><h3>Disponibilità</h3>${s.stato.auto ? `<span class="chip warn">${statoBadge(s.stato.auto)} ${esc(s.stato.auto.testo)}</span>` : ''}</div>
      <div class="seg stato-pick">${Object.entries(STATI).map(([k, l]) => `<button data-stato="${k}" aria-pressed="${(S.config?.indisponibili?.[id]?.m || 'ok') === k}">${STATO_ICO[k] || '✅'} ${l}</button>`).join('')}</div>
      <div class="small muted" style="margin-top:8px">${s.stato.auto?.m === 'squ' ? 'La squalifica è dedotta dai voti: scegli "Disponibile" se non è vero. ' : ''}Infortunati e squalificati non vengono consigliati in formazione.</div></div>
    ${p.Reparto === 'P' ? `<div class="note" style="margin-top:10px">Gol subiti: <b>${s.gs}</b> · Rigori parati: <b>${s.rp}</b></div>` : ''}
    <div class="card" style="margin-top:14px"><h3>Fantavoto per giornata</h3>${chartGiocatore(vs, d.gA)}</div>
    ${Object.keys(s.pos).length ? `<div class="card" style="margin-top:14px"><h3>Posizioni in cui l'hai schierato</h3>${Object.entries(s.pos).sort((a, b) => b[1].n - a[1].n).map(([lab, e]) => `<div class="li"><span class="chip">${lab}</span><div class="grow">${e.n} ${e.n === 1 ? 'volta' : 'volte'}</div><span class="heat" style="${heat(avg(e.fv))}">${fmt(avg(e.fv), 1)}</span></div>`).join('')}</div>` : ''}
    ${vs.length ? `<div class="card" style="margin-top:14px"><h3>Pagelle</h3><div class="list">${[...vs].reverse().map(v => `<div class="li"><span class="chip">${v.G}ª</span><div class="grow small">${bonusTxt(v)}</div><span class="small muted">voto ${esc(v.Voto)}</span><span class="heat" style="${heat(v.FV)}">${v.FV == null ? 'sv' : fmt(v.FV, 1)}</span></div>`).join('')}</div></div>` : ''}`,
  panel => panel.querySelectorAll('[data-stato]').forEach(b => b.onclick = async () => {
    const nota = b.dataset.stato === 'inf' ? (prompt('Nota (facoltativa), es. "rientro fra 2 settimane"', S.config?.indisponibili?.[id]?.nota || '') ?? null) : '';
    if (nota === null) return;
    const ind = { ...(S.config?.indisponibili || {}) };
    // "Disponibile" resta salvato solo se serve a smentire una squalifica dedotta dai voti
    if (b.dataset.stato === 'ok' && s.stato.auto?.m !== 'squ') delete ind[id]; else ind[id] = { m: b.dataset.stato, nota: nota.trim(), da: new Date().toISOString().slice(0, 10) };
    if (await write('saveConfig', { indisponibili: ind }, `${p.Nome}: ${STATI[b.dataset.stato].toLowerCase()}`)) { closeSheet(); playerSheet(id); }
  }));
}
function chartGiocatore(vs, gA) {
  if (!gA.length) return '<div class="small muted">Carica i voti delle giornate per vedere il grafico.</div>';
  const top = Math.max(0, ...vs.map(v => v.FV ?? 0));
  const W = 600, H = 190, pl = 34, pb = 26, pt = 14, base = 6, lo = 2, hi = Math.max(16, Math.ceil(top / 2) * 2 + 2);
  const bw = (W - pl) / gA.length;
  const y = v => pt + (hi - v) * (H - pt - pb) / (hi - lo);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fantavoto per giornata">
    ${[4, 6, 8, 10, 12, 14, 16, 18, 20, 22].filter(t => t < hi).map(t => `<line class="grid-l" x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}" ${t === base ? 'stroke-dasharray="4 4"' : ''}/><text class="ax" x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
    ${gA.map((g, i) => { const v = vs.find(x => x.G === g); const cx = pl + i * bw + bw / 2; const w = Math.min(28, bw * .6);
      if (!v) return `<text class="ax" x="${cx}" y="${y(base) - 4}" text-anchor="middle">–</text><text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${g}</text>`;
      if (v.FV == null) return `<text class="ax" x="${cx}" y="${y(base) - 4}" text-anchor="middle">sv</text><text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${g}</text>`;
      const top = Math.min(y(v.FV), y(base)), h = Math.max(2, Math.abs(y(v.FV) - y(base)));
      return `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="4" fill="var(--${v.FV >= base ? 'win' : 'loss'})"><title>${g}ª: ${fmt(v.FV, 1)}</title></rect>
        <text class="lbl" x="${cx}" y="${v.FV >= base ? top - 4 : top + h + 12}" text-anchor="middle">${fmt(v.FV, 1)}</text><text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${g}</text>`; }).join('')}
  </svg><div class="small muted">Barre dalla linea del 6 · "–" non a referto · "sv" senza voto</div>`;
}

/* ───────── Vista: Altro ───────── */
function vAltro() {
  const c = S?.config || {}; const b = bonus(); const d = S ? D() : null;
  return `<div class="head"><div><div class="eyebrow">Dati e impostazioni</div><h1>Altro</h1></div>
    <div class="head-actions"><button class="btn" data-act="sync" ${API.url ? '' : 'disabled'}>${ICON.sync} Aggiorna</button></div></div>
  <div class="grid grid-2">
    <div class="card" id="import"><h3>Carica voti giornata</h3>
      <label class="drop">${ICON.up.replace('<svg', '<svg style="width:28px;height:28px;margin:0 auto 8px;stroke:var(--accent)"')}
        <b>Scegli i file dei voti</b><div class="small muted">Excel o CSV scaricati da fantacalcio.it (Voti_Fantacalcio_…_Giornata_N). Puoi sceglierne anche più di uno insieme.</div>
        <input type="file" id="fileVoti" accept=".xlsx,.xls,.csv,text/csv" multiple></label>
      <div class="field" style="margin-top:12px"><label for="votoFoglio">Voto da usare</label>
        <select class="input" id="votoFoglio">${['Fantacalcio', 'Statistico', 'Italia'].map(x => `<option ${x === (c.votoFoglio || 'Fantacalcio') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      ${d ? `<div class="tag-line">${d.gA.map(g => `<span class="chip ok">${g}ª ✓ <button class="x" style="width:18px;height:18px;font-size:12px;background:none" data-del-voti="${g}" aria-label="Elimina voti giornata ${g}">×</button></span>`).join('') || '<span class="small muted">Nessuna giornata caricata.</span>'}</div>` : ''}
    </div>

    <div class="card"><h3>Collegamento al foglio</h3>
      <div class="field"><label for="apiUrl">URL dello script (/exec)</label><input class="input" id="apiUrl" value="${esc(API.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>
      <div class="field"><label for="apiKey">Chiave</label><input class="input" id="apiKey" type="password" value="${esc(API.key)}" autocomplete="off"></div>
      <button class="btn primary block" data-act="collega">Collega e scarica i dati</button>
      <div class="small muted" style="margin-top:8px">Stessa URL e chiave su PC di lavoro, casa e telefono: i dati sono nel foglio, quindi sono sempre allineati.</div>
    </div>

    ${S ? `<div class="card"><div class="card-head"><h3>Rosa</h3><button class="btn small" data-act="nuovo-giocatore">${ICON.plus} Aggiungi</button></div>
      <div class="list">${['P', 'D', 'C', 'A'].map(r => d.tutti.filter(p => p.Reparto === r).map(p => `<button class="li" data-edit-player="${p.Id}" style="${p.Attivo === false || p.Attivo === 'FALSE' ? 'opacity:.45' : ''}">${avatar(p)}<div class="grow"><div class="name">${esc(p.Nome)} ${roleBadges(p)}</div><div class="sub">${esc(p.Squadra || '')}${p.Cod ? '' : ' · codice non ancora collegato'}</div></div><span class="num" style="font-weight:700">${esc(p.Crediti)}</span></button>`).join('')).join('')}</div></div>

    <div class="card"><h3>Lega</h3>
      <div class="row"><div class="field"><label for="cSq">Squadra</label><input class="input" id="cSq" value="${esc(c.squadra || '')}"></div>
        <div class="field"><label for="cLe">Lega</label><input class="input" id="cLe" value="${esc(c.lega || '')}"></div></div>
      <div class="field"><label for="cBu">Budget crediti</label><input class="input" id="cBu" type="number" value="${esc(c.budget ?? 300)}"></div>
      <h3 style="margin:14px 0 10px">Bonus e malus</h3>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:0 10px">${Object.keys(DEFAULT_BONUS).map(k => `<div class="field"><label for="b_${k}">${BONUS_NOMI[k]}</label><input class="input" id="b_${k}" type="number" step="0.5" inputmode="decimal" value="${b[k]}"></div>`).join('')}</div>
      <div class="small muted" style="margin:-4px 0 12px">Mantra: il gol può valere diverso per reparto. "Fuori ruolo" (es. -1) si toglie a ogni titolare schierato fuori ruolo nella stima della partita.</div>
      <h3 style="margin:14px 0 10px">Risultato (gol fantacalcio)</h3>
      <div class="row"><div class="field"><label for="cSo">Soglia 1° gol</label><input class="input" id="cSo" type="number" step="0.5" inputmode="decimal" value="${esc(c.soglia ?? 66)}"></div>
        <div class="field"><label for="cFa">Punti per ogni gol in più</label><input class="input" id="cFa" type="number" step="0.5" inputmode="decimal" value="${esc(c.fascia ?? 6)}"></div></div>
      <button class="btn primary block" data-act="salva-config">${ICON.save} Salva impostazioni</button>
    </div>` : ''}

    <div class="card"><h3>Aspetto</h3>
      <div class="seg">${[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<button data-theme="${k}" aria-pressed="${ui.theme === k}">${l}</button>`).join('')}</div>
      <div class="small muted" style="margin-top:12px">Versione ${VERSION}</div></div>

    ${S ? `<div class="card"><h3>Backup</h3>
      <div class="small muted" style="margin-bottom:12px">Scarica in un file Excel rosa, voti, partite e statistiche (nell'app Android finisce nella cartella Download).</div>
      <button class="btn block" data-act="backup">${ICON.save} Esporta backup Excel</button></div>` : ''}
  </div>`;
}

function playerForm(id) {
  const d = D(); const p = id ? d.byId[id] : { Id: 'p' + Date.now().toString(36), Nome: '', Squadra: '', Ruoli: '', Reparto: 'C', Crediti: 1, Cod: '', Attivo: true };
  openSheet(`<div class="panel-head"><h2>${id ? 'Modifica giocatore' : 'Nuovo giocatore'}</h2><button class="x" data-close aria-label="Chiudi">×</button></div>
    <div class="field"><label for="pN">Nome (come su fantacalcio.it)</label><input class="input" id="pN" value="${esc(p.Nome)}"></div>
    <div class="row"><div class="field"><label for="pS">Squadra</label><input class="input" id="pS" value="${esc(p.Squadra)}"></div>
      <div class="field"><label for="pC">Crediti</label><input class="input" id="pC" type="number" value="${esc(p.Crediti)}"></div></div>
    <div class="field"><label>Ruoli Mantra</label><div class="tag-line" id="pR">${ORDINE_RUOLI.map(r => `<button type="button" class="chip ${ruoliDi(p).includes(r) ? 'ok' : ''}" data-r="${r}" aria-pressed="${ruoliDi(p).includes(r)}">${RUOLI[r].l}</button>`).join('')}</div></div>
    <div class="field"><label for="pRep">Reparto</label><select class="input" id="pRep">${Object.entries(REPARTI).map(([k, l]) => `<option value="${k}" ${p.Reparto === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <label class="row" style="align-items:center;gap:8px;margin-bottom:14px"><input type="checkbox" id="pA" ${p.Attivo === false || p.Attivo === 'FALSE' ? '' : 'checked'} style="flex:none;width:20px;height:20px"> In rosa (togli la spunta se lo hai ceduto: le statistiche restano)</label>
    <button class="btn primary block" id="pSave">${ICON.save} Salva</button>`,
  panel => {
    panel.querySelectorAll('#pR [data-r]').forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.classList.toggle('ok', on); });
    panel.querySelector('#pSave').onclick = async () => {
      const nuovo = { ...p, Nome: panel.querySelector('#pN').value.trim(), Squadra: panel.querySelector('#pS').value.trim(), Crediti: Number(panel.querySelector('#pC').value) || 0,
        Ruoli: $$('#pR [aria-pressed="true"]', panel).map(b => b.dataset.r).join(','), Reparto: panel.querySelector('#pRep').value, Attivo: panel.querySelector('#pA').checked };
      if (!nuovo.Nome) { toast('Inserisci il nome'); return; }
      if (nuovo.Nome !== p.Nome) nuovo.Cod = '';
      const campi = ['Nome', 'Squadra', 'Crediti', 'Ruoli', 'Reparto', 'Attivo', 'Cod'];
      const btn = panel.querySelector('#pSave'); btn.disabled = true;
      // aggiorno solo i campi del modulo sul giocatore fresco dal foglio (Foto e codice cambiati altrove restano)
      const ok = await salvaRosa(r => id
        ? r.map(x => x.Id === id ? { ...x, ...Object.fromEntries(campi.filter(k => k !== 'Cod' || nuovo.Cod === '').map(k => [k, nuovo[k]])) } : x)
        : [...r, nuovo], 'Rosa aggiornata');
      if (ok) closeSheet(); else btn.disabled = false;
    };
  });
}

/* ───────── Import voti ───────── */
// Legge un file voti e lo abbina alla rosa. Non salva niente.
async function parseFile(file) {
  const d = D();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const voluto = S.config?.votoFoglio || 'Fantacalcio';
  const foglio = wb.Sheets[voluto] ? voluto : wb.SheetNames[0];
  const ws = wb.Sheets[foglio];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // numero di giornata: prima dal nome del file (…_Giornata_9), poi dal titolo dentro il file
  const titolo = String(rows[0]?.[0] || '');
  const m = file.name.match(/Giornata[_\s-]*(\d+)/i) || titolo.match(/giornata\s*(\d+)/i) || titolo.match(/(\d+)\s*[ªa°º]\s*giornata/i);
  const giornata = m && Number(m[1]) >= 1 && Number(m[1]) <= 38 ? Number(m[1]) : null;
  let squadra = '', head = null; const righe = [];
  rows.forEach(r => {
    if (r[0] === 'Cod.') { head = r.map(String); return; }
    if (r[0] !== '' && typeof r[0] === 'string' && r.slice(1).every(x => x === '') && !/^(Voti|Solo|QUESTO|E')/i.test(r[0])) { squadra = r[0]; return; }
    if (head && (typeof r[0] === 'number' || /^\d+$/.test(String(r[0]))) && r[1] !== 'ALL') {
      const o = { Squadra: squadra }; head.forEach((h, i) => o[h.replace('.', '')] = r[i]); righe.push(o);
    }
  });

  // abbinamento con la rosa: prima codice, poi nome (tollera "Taylor" → "Taylor K.")
  const byCod = Object.fromEntries(righe.map(r => [String(r.Cod), r]));
  const trovati = [], updates = [];
  const usati = new Set();
  // codici già collegati a un mio giocatore: quelle righe non si abbinano per nome a nessun altro
  const codRosa = new Set(d.tutti.map(p => String(p.Cod || '')).filter(Boolean));
  d.tutti.forEach(p => {
    let r = p.Cod ? byCod[String(p.Cod)] : null;
    // Se il codice è già noto ma non è nel file, il giocatore NON era a referto: niente ricerca per nome
    // (altrimenti si rischia di prendere il voto di un omonimo).
    if (!r && !p.Cod) {
      const np = norm(p.Nome);
      const libere = righe.filter(x => !codRosa.has(String(x.Cod)));
      let cand = libere.filter(x => norm(x.Nome) === np);
      if (!cand.length) cand = libere.filter(x => { const nx = norm(x.Nome); return nx.startsWith(np + ' ') || np.startsWith(nx + ' '); });
      if (cand.length > 1 && p.Squadra) cand = cand.filter(x => norm(x.Squadra) === norm(p.Squadra));
      if (cand.length === 1) r = cand[0];
    }
    if (r && !usati.has(String(r.Cod))) {
      usati.add(String(r.Cod));
      const sv = String(r.Voto).includes('*');
      const voto = Number(String(r.Voto).replace(',', '.'));
      trovati.push({ p, r, row: { Id: p.Id, Cod: r.Cod, Nome: p.Nome, Voto: sv || isNaN(voto) ? 6 : voto, SV: sv || isNaN(voto), Gf: r.Gf, Gs: r.Gs, Rp: r.Rp, Rs: r.Rs, Rf: r.Rf, Au: r.Au, Amm: r.Amm, Esp: r.Esp, Ass: r.Ass } });
      const cambiaSq = r.Squadra && norm(r.Squadra) !== norm(p.Squadra);
      if (String(p.Cod) !== String(r.Cod) || cambiaSq) updates.push({ Id: p.Id, Cod: r.Cod, Squadra: cambiaSq ? r.Squadra : p.Squadra });
    }
  });
  trovati.forEach(t => t.row.FV = fv(t.row, undefined, t.p.Reparto));
  const assenti = d.rosa.filter(p => !trovati.some(t => t.p.Id === p.Id));
  return { file, foglio: foglio === voluto ? voluto : '', giornata, letti: righe.length, trovati, updates, assenti };
}

// Numeri veloci di un file voti (per il riepilogo prima di salvare)
function riepilogo(x) {
  const t = x.trovati, conV = t.filter(y => y.row.FV != null);
  const n = k => sum(t.map(y => Number(y.row[k]) || 0));
  const top = conV.slice().sort((a, b) => b.row.FV - a.row.FV)[0];
  return { referto: t.length, sv: t.length - conV.length, fuori: x.assenti.length, media: avg(conV.map(y => y.row.FV)),
    gol: n('Gf') + n('Rf'), ass: n('Ass'), amm: n('Amm'), esp: n('Esp'), top };
}

async function importFiles(files) {
  if (!window.XLSX) { toast('Lettore Excel non ancora caricato, riprova tra un attimo'); return; }
  if (!S) { toast('Collega prima il foglio (Altro → Collegamento)'); return; }
  const lista = [];
  for (const f of files) {
    try { lista.push(await parseFile(f)); }
    catch (e) { lista.push({ file: f, errore: 'file non leggibile' }); }
  }
  if (lista.length === 1) {
    const x = lista[0];
    if (x.errore) { toast('File non leggibile'); return; }
    if (!x.letti) { toast('Non trovo voti in questo file'); return; }
    return anteprimaSingola(x);
  }
  anteprimaMultipla(lista);
}

// Un file: solo un riepilogo veloce e il pulsante Conferma subito in vista
function anteprimaSingola(x) {
  const { file, foglio, giornata, trovati, updates } = x;
  const r = riepilogo(x);
  const gia = D().gA.includes(giornata);
  const conferma = `${ICON.check} Conferma e salva`;
  openSheet(`<div class="panel-head"><div style="min-width:0"><div class="small muted imp-file">${esc(file.name)}${foglio ? ' · voto ' + esc(foglio) : ''}</div><h2>${giornata ? `Voti ${giornata}ª giornata` : 'Voti della giornata'}</h2></div><button class="x" data-close aria-label="Chiudi">×</button></div>
    <div class="imp-sum">
      <div><b class="num">${r.referto}</b><span>a referto</span></div>
      <div><b class="num">${r.fuori}</b><span>non a referto</span></div>
      <div><b class="num">${fmt(r.media, 1)}</b><span>media FV</span></div>
    </div>
    <div class="imp-line">⚽ <b>${r.gol}</b> gol · 🅰️ <b>${r.ass}</b> assist · 🟨 <b>${r.amm}</b> · 🟥 <b>${r.esp}</b>${r.sv ? ` · ${r.sv} s.v.` : ''}${r.top ? `<br>★ Migliore: <b>${esc(r.top.p.Nome)}</b> ${fmt(r.top.row.FV, 1)}` : ''}</div>
    <div class="note warn-note" id="impGia" ${gia ? '' : 'hidden'}>Questa giornata è già caricata: confermando sostituisco i voti.</div>
    <div class="imp-actions">
      <label class="imp-g"><span>Giornata</span><input class="input" id="impG" type="number" min="1" max="38" inputmode="numeric" value="${giornata || ''}"></label>
      <button class="btn primary" id="impSave">${conferma}</button>
    </div>`,
  panel => {
    const gIn = panel.querySelector('#impG');
    if (!giornata) gIn.focus();
    gIn.oninput = () => { panel.querySelector('#impGia').hidden = !D().gA.includes(Number(gIn.value)); };
    panel.querySelector('#impSave').onclick = async () => {
      const g = Number(gIn.value);
      if (!g) { toast('Indica la giornata'); gIn.focus(); return; }
      const btn = panel.querySelector('#impSave'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Salvo…';
      const ok = await write('importVoti', { giornata: g, rows: trovati.map(t => t.row), rosaUpdates: updates }, `Voti della ${g}ª giornata salvati`);
      if (ok) closeSheet(); else { btn.disabled = false; btn.innerHTML = conferma; }
    };
  });
}

// Più file insieme: riepilogo, giornata modificabile, salvataggio in fila dalla più vecchia alla più recente
function anteprimaMultipla(lista) {
  const gA = D().gA;
  lista.sort((a, b) => (a.giornata ?? 99) - (b.giornata ?? 99));
  const righe = lista.map((x, i) => {
    if (x.errore || !x.letti) return `<div class="li"><div class="grow"><div class="name">${esc(x.file.name)}</div><div class="sub" style="color:var(--loss)">${x.errore || 'nessun voto trovato'} · verrà saltato</div></div></div>`;
    const r = riepilogo(x);
    return `<div class="li" data-i="${i}"><input class="input g-in" type="number" min="1" max="38" inputmode="numeric" value="${x.giornata || ''}" placeholder="?" aria-label="Giornata">
      <div class="grow">${x.giornata ? '' : `<div class="sub imp-file" style="color:var(--draw)">Scrivi la giornata · ${esc(x.file.name)}</div>`}<div class="sub">${r.referto} a referto · ⚽ ${r.gol} · media ${fmt(r.media, 1)}</div>
      ${gA.includes(x.giornata) ? '<div class="sub" style="color:var(--draw)">già caricata: verrà sostituita</div>' : ''}<div class="sub st"></div></div></div>`;
  }).join('');
  const validi = lista.filter(x => !x.errore && x.letti);
  const fogli = [...new Set(validi.map(x => x.foglio).filter(Boolean))];
  openSheet(`<div class="panel-head"><div><div class="small muted">${lista.length} file${fogli.length === 1 ? ' · voto ' + esc(fogli[0]) : ''}</div><h2>Carica ${validi.length} giornate</h2></div><button class="x" data-close aria-label="Chiudi">×</button></div>
    <div class="small muted" style="margin-bottom:6px">Il numero a sinistra è la giornata: correggilo se serve.</div>
    <div class="list imp-multi">${righe}</div>
    <div class="imp-actions sticky"><button class="btn primary block" id="impAll" ${validi.length ? '' : 'disabled'}>${ICON.check} Conferma e salva ${validi.length} giornate</button></div>`,
  panel => {
    panel.querySelector('#impAll').onclick = async () => {
      const job = [];
      for (const el of panel.querySelectorAll('[data-i]')) {
        const g = Number(el.querySelector('.g-in').value);
        if (!g) { toast('Manca il numero di giornata per ' + lista[el.dataset.i].file.name); return; }
        job.push({ el, g, x: lista[el.dataset.i] });
      }
      const doppie = job.map(j => j.g).filter((g, i, a) => a.indexOf(g) !== i);
      if (doppie.length) { toast(`La ${doppie[0]}ª giornata compare due volte`); return; }
      job.sort((a, b) => a.g - b.g); // la squadra più recente di ogni giocatore vince
      const btn = panel.querySelector('#impAll'); btn.disabled = true;
      panel.querySelectorAll('.g-in').forEach(i => i.disabled = true);
      syncState.busy = true; renderSync();
      let fatte = 0, ultimo = null;
      for (const j of job) {
        btn.innerHTML = `<span class="spin"></span> Salvo la ${j.g}ª giornata (${fatte + 1} di ${job.length})…`;
        const st = j.el.querySelector('.st');
        try {
          ultimo = await apiPost('importVoti', { giornata: j.g, rows: j.x.trovati.map(t => t.row), rosaUpdates: j.x.updates });
          fatte++; st.innerHTML = '<span style="color:var(--win)">✓ salvata</span>';
        } catch (e) {
          st.innerHTML = `<span style="color:var(--loss)">Errore: ${esc(e.message)}</span>`;
          break;
        }
      }
      if (ultimo) setData(ultimo);
      syncState.busy = false; renderSync(); render();
      if (fatte === job.length) { closeSheet(); toast(`${fatte} giornate salvate`); }
      else { toast(`Salvate ${fatte} di ${job.length}: riprova con le altre`); btn.textContent = 'Chiudi'; btn.disabled = false; btn.onclick = closeSheet; }
    };
  });
}

/* ───────── Backup Excel ───────── */
function esportaBackup() {
  if (!window.XLSX) { toast('Lettore Excel non ancora caricato, riprova tra un attimo'); return; }
  const d = D(); const wb = XLSX.utils.book_new();
  const foglio = (nome, righe) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(righe.length ? righe : [{}]), nome);
  foglio('Rosa', (S.rosa || []).map(p => ({ ...p, Stato: d.st[p.Id]?.stato.testo || '' })));
  foglio('Voti', (S.voti || []).map(v => ({ ...v, FV: fv(v, d.b, d.byId[v.Id]?.Reparto) })).sort((a, b) => a.Giornata - b.Giornata));
  foglio('Partite', (S.giornate || []).map(g => { const x = d.giornate.find(y => y.n === Number(g.Giornata)); return { ...g, EsitoCalcolato: x?.e || '', Risultato: x?.pt != null && x?.pa != null ? `${golFanta(x.pt)}-${golFanta(x.pa)}` : '' }; }));
  foglio('Statistiche', d.tutti.map(p => { const s = d.st[p.Id]; return { Nome: p.Nome, Squadra: p.Squadra, Ruoli: p.Ruoli, Presenze: s.pres, SV: s.sv,
    MV: s.mv == null ? '' : +s.mv.toFixed(2), FM: s.fm == null ? '' : +s.fm.toFixed(2), Forma: s.forma == null ? '' : +s.forma.toFixed(2), Gol: s.gol, Assist: s.ass,
    Ammonizioni: s.amm, Espulsioni: s.esp, Titolare: s.tit, Migliore: s.migl, Peggiore: s.pegg, Crediti: s.crediti }; }));
  foglio('Impostazioni', Object.entries(S.config || {}).map(([k, v]) => ({ Chiave: k, Valore: typeof v === 'object' ? JSON.stringify(v) : v })));
  XLSX.writeFile(wb, `Fanta-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('Backup esportato');
}

/* ───────── Eventi ───────── */
function bind(root) {
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const sc = b.dataset.scroll; go(b.dataset.go); if (sc) setTimeout(() => $('#' + sc)?.scrollIntoView({ behavior: 'smooth' }), 50); });
  root.querySelectorAll('[data-player]').forEach(b => {
    b.addEventListener('click', () => b.dataset.player && playerSheet(b.dataset.player));
    if (b.getAttribute('role') === 'button') b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
  });
  root.querySelectorAll('[data-giornata]').forEach(b => b.onclick = () => giornataDettaglio(b.dataset.giornata));
  root.querySelectorAll('[data-stat]').forEach(b => b.onclick = () => { ui.statTab = b.dataset.stat; render(); });
  root.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { ui.rep = b.dataset.rep; render(); });
  root.querySelectorAll('[data-ruolo]').forEach(b => b.onclick = () => { ui.ruolo = b.dataset.ruolo; render(); });
  root.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; ui.sortDir = ui.sortKey === k ? -ui.sortDir : -1; ui.sortKey = k; render(); });
  root.querySelectorAll('[data-modulo]').forEach(b => b.onclick = () => { ui.editForm = { modulo: b.dataset.modulo, slot: bestXI(b.dataset.modulo).slot }; ui.formSel = null; if (view !== 'formazione') go('formazione'); else render(); toast('Undici consigliato in ' + b.dataset.modulo); });
  root.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { ui.theme = b.dataset.theme; LS.set('fc_theme', ui.theme); applyTheme(); render(); });
  root.querySelectorAll('[data-edit-player]').forEach(b => b.onclick = () => playerForm(b.dataset.editPlayer));
  root.querySelectorAll('[data-del-voti]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (confirm(`Eliminare i voti della ${b.dataset.delVoti}ª giornata?`)) await write('deleteVoti', Number(b.dataset.delVoti), 'Voti eliminati'); });

  // formazione
  if (view === 'formazione' && S) {
    const F = currentForm();
    root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { const i = Number(b.dataset.slot); ui.formSel = ui.formSel === i ? null : i; render(); });
    root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { pick(F, ui.formSel, b.dataset.pick); ui.formSel = null; render(); });
    const pc = root.querySelector('[data-pick-close]'); if (pc) pc.onclick = () => { ui.formSel = null; render(); };
    const mod = root.querySelector('#modulo'); if (mod) mod.onchange = e => { ui.editForm = refit(F, e.target.value); ui.formSel = null; render(); };
  }

  const acts = {
    'nuova-giornata': () => giornataForm(null),
    'consiglia': () => { const F = currentForm(); ui.editForm = { modulo: F.modulo, slot: bestXI(F.modulo).slot }; ui.formSel = null; render(); toast('Undici consigliato in ' + F.modulo); },
    'salva-form': () => write('saveConfig', { formazione: currentForm() }, 'Formazione salvata'),
    'sync': () => sync(false),
    'nuovo-giocatore': () => playerForm(null),
    'collega': async () => {
      API = { url: $('#apiUrl').value.trim(), key: $('#apiKey').value.trim() };
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(API.url)) { toast('L\'URL deve iniziare con https://script.google.com/'); return; }
      LS.set('fc_api', API); ui.editForm = null; await sync(false); if (S) go('squadra');
    },
    'salva-config': () => {
      const bo = {}; Object.keys(DEFAULT_BONUS).forEach(k => bo[k] = numOrNull($('#b_' + k).value.replace(',', '.')) ?? 0);
      write('saveConfig', { squadra: $('#cSq').value.trim(), lega: $('#cLe').value.trim(), budget: Number($('#cBu').value) || 300, bonus: bo,
        soglia: Number($('#cSo').value) || 66, fascia: Number($('#cFa').value) || 6 }, 'Impostazioni salvate');
    },
    'backup': esportaBackup
  };
  root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => acts[b.dataset.act]?.());
  const fileIn = root.querySelector('#fileVoti'); if (fileIn) fileIn.onchange = e => { const fs = [...e.target.files]; if (fs.length) importFiles(fs).catch(err => toast('File non leggibile: ' + err.message)); e.target.value = ''; };
  const vf = root.querySelector('#votoFoglio'); if (vf) vf.onchange = e => write('saveConfig', { votoFoglio: e.target.value }, 'Userò il voto ' + e.target.value);
}

function applyTheme() {
  const r = document.documentElement;
  if (ui.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', ui.theme);
}

/* ───────── Avvio ───────── */
if (!API.url && view !== 'altro') view = 'altro';
render();
sync(true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && API.url) sync(true); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
