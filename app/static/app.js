'use strict';
/* Éditeur d'aménagement – repère en pouces, y vers le nord (inversé à l'affichage). */

const NS = 'http://www.w3.org/2000/svg';
const NOMS_CATEGORIES = { existant: 'existant', nouveau: 'à acheter', sur_mesure: 'sur mesure', perso: 'créé' };

const VUE_INITIALE = { x: -15, y: -362, w: 412, h: 432 };
const ZOOM_MIN = 60, ZOOM_MAX = 900;   // largeur de la vue, en pouces
const S = {
  plan: null, cat: [], catById: {}, placements: [], sel: null,
  planId: null, nomPlan: 'Nouveau plan', modifie: false,
  vb: { x: -15, y: -362, w: 412, h: 432 },   // vue initiale : tout l'appartement et le balcon
  problemes: [], resultats: null,
  onglet: null,                      // null = plan complet, sinon id de la pièce affichée
};
const ID_ONGLET = Math.random().toString(36).slice(2, 10);   // identifie cette fenêtre pour la synchronisation

/* ------------------------------------------------------------------ thèmes (skins)
   Couleurs du plan SVG ; les couleurs de l'interface sont dans style.css (:root[data-theme=…]). */
const THEMES = {
  classique: { nom: 'Classique', balcon: '#eef3f6', balconTrait: '#9fb0bd', piece: '#eaf6f6', mur: '#6b7280', equip: '#ffffff', equipTrait: '#7a8796',
    placard: '#f2efe6', placardTrait: '#a39b82', fenetre: '#5aa9e6', ouverture: '#ffffff', plinthe: '#e03030', porte: '#9aa3ad', porteTrait: '#6b7280',
    vert: '#2a7a3b', etiquette: '#445566', masque: '#f2f4f7', masqueOpacite: 0.9, contour: '#23405f',
    meubles: { existant: '#4a7fd4', nouveau: '#f0a030', sur_mesure: '#9b6cd1', perso: '#2a9d8f' }, mince: '#111111', trait: '#1f2937',
    probleme: '#e03030', info: '#f08a00', selection: '#0b5ed7', devant: '#ffffff', texteMeuble: '#111111', poignee: '#ffffff', zone: '#4a7fd4',
    cercleOk: '#2fb35a', cercleKo: '#e03030', epais: 1 },
  sombre: { nom: 'Sombre', balcon: '#1c252e', balconTrait: '#4b5b6b', piece: '#1f2b33', mur: '#9aa5b4', equip: '#2b3542', equipTrait: '#7d8a9a',
    placard: '#2e2a22', placardTrait: '#8f8466', fenetre: '#5aa9e6', ouverture: '#1f2b33', plinthe: '#ff6b6b', porte: '#9aa3ad', porteTrait: '#9aa5b4',
    vert: '#7ad694', etiquette: '#c9d1dc', masque: '#161b22', masqueOpacite: 0.88, contour: '#8ab4f8',
    meubles: { existant: '#5b8fe0', nouveau: '#e0a040', sur_mesure: '#a984de', perso: '#3bb3a4' }, mince: '#e6e9ef', trait: '#0d1117',
    probleme: '#ff6b6b', info: '#f2b04a', selection: '#8ab4f8', devant: '#ffffff', texteMeuble: '#0d1117', poignee: '#1e2530', zone: '#8ab4f8',
    cercleOk: '#7ad694', cercleKo: '#ff6b6b', epais: 1 },
  contraste: { nom: 'Contraste élevé', balcon: '#ffffff', balconTrait: '#000000', piece: '#ffffff', mur: '#000000', equip: '#ffffff', equipTrait: '#000000',
    placard: '#ffffff', placardTrait: '#000000', fenetre: '#0060ff', ouverture: '#ffffff', plinthe: '#d00000', porte: '#000000', porteTrait: '#000000',
    vert: '#005a00', etiquette: '#000000', masque: '#ffffff', masqueOpacite: 0.93, contour: '#000000',
    meubles: { existant: '#1f5fd6', nouveau: '#ff9a00', sur_mesure: '#8a2be2', perso: '#008a7a' }, mince: '#000000', trait: '#000000',
    probleme: '#d00000', info: '#b35c00', selection: '#0000c8', devant: '#ffff00', texteMeuble: '#000000', poignee: '#ffff00', zone: '#0000c8',
    cercleOk: '#005a00', cercleKo: '#d00000', epais: 1.8 },
  nature: { nom: 'Nature', balcon: '#eef0e2', balconTrait: '#a9ad92', piece: '#f3f1e2', mur: '#5a5f4a', equip: '#fffdf5', equipTrait: '#8c8f78',
    placard: '#ece3cc', placardTrait: '#a89a72', fenetre: '#6aa9c9', ouverture: '#f3f1e2', plinthe: '#c0392b', porte: '#9a9f86', porteTrait: '#5a5f4a',
    vert: '#2f6b2a', etiquette: '#4a5a3e', masque: '#fbfaf5', masqueOpacite: 0.9, contour: '#3f5a32',
    meubles: { existant: '#8a6b48', nouveau: '#d7a13f', sur_mesure: '#6f8f5a', perso: '#3f8f86' }, mince: '#23301f', trait: '#3a3f2e',
    probleme: '#c0392b', info: '#d7a13f', selection: '#3f5a32', devant: '#ffffff', texteMeuble: '#1d2416', poignee: '#fffdf7', zone: '#5f8a3d',
    cercleOk: '#2f6b2a', cercleKo: '#c0392b', epais: 1 },
  sable: { nom: 'Sable', balcon: '#f6efe6', balconTrait: '#cdb69c', piece: '#fbf1e4', mur: '#7a6555', equip: '#fffdf8', equipTrait: '#a48d78',
    placard: '#f2e3cf', placardTrait: '#b89b78', fenetre: '#6fa8c8', ouverture: '#fbf1e4', plinthe: '#c62828', porte: '#b8a596', porteTrait: '#7a6555',
    vert: '#4d6b2a', etiquette: '#6b4f3d', masque: '#fffaf3', masqueOpacite: 0.9, contour: '#8c4a2f',
    meubles: { existant: '#c0643c', nouveau: '#e3a73c', sur_mesure: '#8e6bb0', perso: '#3d8f8a' }, mince: '#3a2a20', trait: '#4a3426',
    probleme: '#c62828', info: '#e3a73c', selection: '#8c4a2f', devant: '#ffffff', texteMeuble: '#2a1c14', poignee: '#fffdf8', zone: '#c0643c',
    cercleOk: '#4d6b2a', cercleKo: '#c62828', epais: 1 },
};
const CLE_THEME = 'amenagement-theme';
let T = THEMES.classique;
function appliquerTheme(nom, memoriser = true) {
  if (!THEMES[nom]) nom = 'classique';
  T = THEMES[nom];
  document.documentElement.dataset.theme = nom;
  if ($('theme')) $('theme').value = nom;
  if (memoriser) { try { localStorage.setItem(CLE_THEME, nom); } catch (e) { /* navigation privée */ } }
  if (S.plan && gPlan) { dessinerPlan(); dessinerMasque(); toutRedessiner(); }
}

/* ------------------------------------------------------------------ utilitaires */
const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
const pts = (poly) => poly.map(([x, y]) => `${x},${-y}`).join(' ');
const r1 = (v) => Math.round(v * 10) / 10;
const uid = () => Math.random().toString(36).slice(2, 10);
/* Échappe le texte saisi par les utilisateurs avant de l'insérer en HTML (application publique). */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = JSON.stringify((await r.json()).detail); } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
}

/* ------------------------------------------------------------------ géométrie */
function pointDans(px, py, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[j];
    if ((y1 > py) !== (y2 > py) && px < (x2 - x1) * (py - y1) / (y2 - y1) + x1) c = !c;
  }
  return c;
}
function distSeg(px, py, a, b) {
  const [x1, y1] = a, [x2, y2] = b, dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}
function bornes(poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function echantillons(poly, n = 12) {
  let [x0, y0, x1, y1] = bornes(poly);
  x0 += 0.05; y0 += 0.05; x1 -= 0.05; y1 -= 0.05;
  const out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) out.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n]);
  return poly.length === 4 ? out : out.filter((p) => pointDans(p[0], p[1], poly));
}
/* Repère local d'un meuble : origine au centre, x vers sa droite, y vers l'arrière ; le DEVANT est du côté -y.
   rot = angle en degrés, sens horaire sur le plan (0 : devant au sud, 90 : ouest, 180 : nord, 270 : est). */
const normAngle = (a) => { const v = Math.round((((a % 360) + 360) % 360) * 100) / 100; return v >= 360 ? 0 : v; };
function cs(rot) {
  const t = rot * Math.PI / 180; let c = Math.cos(t), s = Math.sin(t);
  if (Math.abs(c) < 1e-12) c = 0; if (Math.abs(s) < 1e-12) s = 0;
  return [c, s];
}
function versMonde(pl, lx, ly) { const [c, s] = cs(pl.rot || 0); return [pl.x + lx * c + ly * s, pl.y - lx * s + ly * c]; }
function versLocal(pl, x, y) { const [c, s] = cs(pl.rot || 0), dx = x - pl.x, dy = y - pl.y; return [dx * c - dy * s, dx * s + dy * c]; }
function dims(pl, m) {
  return [m.redimensionnable ? (pl.w || m.w) : m.w, m.redimensionnable ? (pl.d || m.d) : m.d];
}
function contourLocal(m, w, d) {
  const x0 = -w / 2, y0 = -d / 2, x1 = w / 2, y1 = d / 2;
  if (m.forme === 'octogone') {
    const c = Math.min(w, d) * 0.293;
    return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
  }
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}
function empreinte(pl, m) {
  const [w, d] = dims(pl, m);
  return contourLocal(m, w, d).map(([lx, ly]) => versMonde(pl, lx, ly));
}
function echantillonsMeuble(pl, m, n = 12) {
  const [w, d] = dims(pl, m), loc = contourLocal(m, w, d), out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const lx = -w / 2 + 0.05 + (w - 0.1) * i / n, ly = -d / 2 + 0.05 + (d - 0.1) * j / n;
    if (m.forme !== 'octogone' || pointDans(lx, ly, loc)) out.push(versMonde(pl, lx, ly));
  }
  return out;
}
function zoneInclinaison(pl, m) {
  const [w, d] = dims(pl, m), ext = (m.inclinaison || 0) - d;
  if (ext <= 0) return null;
  return [[-w / 2, -d / 2 - ext], [w / 2, -d / 2 - ext], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, ly]) => versMonde(pl, lx, ly));
}
const DIRECTIONS = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est'];
function cardinal(vx, vy) { return DIRECTIONS[((Math.round(Math.atan2(vy, vx) * 180 / Math.PI / 45) % 8) + 8) % 8]; }
function directionDevant(pl) { const [c, s] = cs(pl.rot || 0); return [-s, -c]; }
function pieceDe(x, y) {
  const p = S.plan.pieces.find((r) => pointDans(x, y, r.polygone));
  return p ? p.id : null;
}
function dansSecteur([px, py], porte) {
  const [hx, hy] = porte.charniere, dx = px - hx, dy = py - hy;
  const a = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
  return Math.hypot(dx, dy) < porte.rayon && a >= porte.a0 && a <= porte.a1;
}

/* ------------------------------------------------------------------ contrôles en direct */
function controles() {
  const plinthe = +$('p-plinthe').value || 12;
  const items = S.placements.map((pl) => ({ pl, m: S.catById[pl.item] })).filter((e) => e.m);
  const sol = items.filter((e) => e.m.type === 'sol').map((e) => {
    const poly = empreinte(e.pl, e.m);
    return { ...e, poly, pts: echantillonsMeuble(e.pl, e.m), piece: pieceDe(e.pl.x, e.pl.y) };
  });
  const out = [];
  for (const e of sol) {
    const nom = e.m.nom;
    if (!e.piece) { out.push({ uid: e.pl.uid, msg: `${nom} : hors des pièces` }); continue; }
    const room = S.plan.pieces.find((r) => r.id === e.piece).polygone;
    if (e.pts.some((p) => !pointDans(p[0], p[1], room))) out.push({ uid: e.pl.uid, msg: `${nom} : traverse un mur ou sort de la pièce` });
    for (const f of (S.plan.fixes[e.piece] || [])) {
      if (e.pts.some((p) => pointDans(p[0], p[1], f.polygone))) out.push({ uid: e.pl.uid, msg: `${nom} : chevauche ${f.nom}` });
    }
    for (const porte of S.plan.portes) {
      if (porte.piece === e.piece && e.pts.some((p) => dansSecteur(p, porte))) out.push({ uid: e.pl.uid, msg: `${nom} : dans le débattement de la porte` });
    }
    for (const pl of S.plan.plinthes) {
      const d = Math.min(...echantillonsMeuble(e.pl, e.m, 16).map(([x, y]) => distSeg(x, y, pl.p1, pl.p2)));
      if (d < plinthe) out.push({ uid: e.pl.uid, msg: `${nom} : à ${r1(d)} po de la ${pl.nom}`, info: true });
    }
  }
  for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) {
    const a = sol[i], b = sol[j];
    if (a.pts.some((p) => pointDans(p[0], p[1], b.poly)) || b.pts.some((p) => pointDans(p[0], p[1], a.poly))) {
      out.push({ uid: a.pl.uid, uid2: b.pl.uid, msg: `${a.m.nom} chevauche ${b.m.nom}` });
    }
  }
  S.problemes = out;
  const ul = $('problemes');
  ul.innerHTML = '';
  const dansPiece = (u) => { const pl = S.placements.find((x) => x.uid === u); return pl && pieceDe(pl.x, pl.y) === S.onglet; };
  const affiches = S.onglet ? out.filter((p) => dansPiece(p.uid) || (p.uid2 && dansPiece(p.uid2))) : out;
  if (!affiches.length) { ul.innerHTML = `<li class="ok">Aucun chevauchement, mur, porte ou plinthe en conflit${S.onglet ? ' dans cette pièce' : ''}.</li>`; }
  if (S.onglet && out.length > affiches.length) {
    const li = document.createElement('li'); li.className = 'info';
    li.textContent = `${out.length - affiches.length} autre(s) problème(s) dans d'autres pièces : voir « Plan complet ».`;
    ul.appendChild(li);
  }
  for (const p of affiches) {
    const li = document.createElement('li');
    if (p.info) li.className = 'info';
    li.textContent = p.msg;
    li.onclick = () => selectionner(p.uid);
    ul.appendChild(li);
  }
}

/* ------------------------------------------------------------------ dessin du plan */
let gPlan, gMasque, gMeubles, gCalques, gResultats;
function dessinerPlan() {
  const svg = $('plan');
  svg.innerHTML = '';
  gPlan = el('g', {}, svg);
  el('polygon', { points: pts(S.plan.balcon), fill: T.balcon, stroke: T.balconTrait, 'stroke-width': 0.6 }, gPlan);
  for (const p of S.plan.pieces) el('polygon', { points: pts(p.polygone), fill: T.piece, stroke: 'none' }, gPlan);
  for (const w of S.plan.murs) {
    if (w.type === 'rect') el('rect', { x: w.x[0], y: -w.y[1], width: w.x[1] - w.x[0], height: w.y[1] - w.y[0], fill: T.mur }, gPlan);
    else el('polygon', { points: pts(w.pts), fill: T.mur }, gPlan);
  }
  for (const f of S.plan.equipements) {
    el('polygon', { points: pts(f.polygon), fill: T.equip, stroke: T.equipTrait, 'stroke-width': 0.5 * T.epais }, gPlan);
  }
  for (const c of S.plan.placards) {
    const poly = c.polygon || (c.x ? [[c.x[0], c.y[0]], [c.x[1], c.y[0]], [c.x[1], c.y[1]], [c.x[0], c.y[1]]] : null);
    if (poly) el('polygon', { points: pts(poly), fill: T.placard, stroke: T.placardTrait, 'stroke-width': 0.5 * T.epais, 'stroke-dasharray': '2,1' }, gPlan);
  }
  for (const room of Object.values(S.plan.fixes)) {
    for (const f of room) if (f.nom.startsWith('portes du placard')) el('polygon', { points: pts(f.polygone), fill: 'none', stroke: T.placardTrait, 'stroke-width': 0.4 * T.epais, 'stroke-dasharray': '1,1' }, gPlan);
  }
  for (const o of S.plan.ouvertures) {
    if (o.type === 'window') {
      const a = o.wall === 'east' ? [378.4, o.y[0]] : [o.x[0], 0], b = o.wall === 'east' ? [378.4, o.y[1]] : [o.x[1], 0];
      el('line', { x1: a[0], y1: -a[1], x2: b[0], y2: -b[1], stroke: T.fenetre, 'stroke-width': 3 }, gPlan);
    } else if (o.jambs) {
      const [a, b] = o.jambs;
      el('line', { x1: a[0], y1: -a[1], x2: b[0], y2: -b[1], stroke: T.ouverture, 'stroke-width': 2.4 }, gPlan);
    } else if (o.x) {
      el('line', { x1: o.x[0], y1: 0, x2: o.x[1], y2: 0, stroke: T.ouverture, 'stroke-width': 3 }, gPlan);
    }
  }
  for (const pl of S.plan.plinthes) el('line', { x1: pl.p1[0], y1: -pl.p1[1], x2: pl.p2[0], y2: -pl.p2[1], stroke: T.plinthe, 'stroke-width': 1.6 }, gPlan);
  for (const p of S.plan.portes) {
    const [hx, hy] = p.charniere, r = p.rayon, a0 = p.a0 * Math.PI / 180, a1 = p.a1 * Math.PI / 180;
    const x0 = hx + r * Math.cos(a0), y0 = hy + r * Math.sin(a0), x1 = hx + r * Math.cos(a1), y1 = hy + r * Math.sin(a1);
    el('path', { d: `M${hx},${-hy} L${x0},${-y0} A${r},${r} 0 0 0 ${x1},${-y1} Z`, fill: T.porte, 'fill-opacity': 0.2, stroke: T.porteTrait, 'stroke-width': 0.4 * T.epais, 'stroke-dasharray': '1.5,1' }, gPlan);
  }
  el('text', { x: 127.5, y: -137, 'font-size': 3.2, fill: T.vert }, gPlan).textContent = 'porte enlevée';
  const etiquettes = { BR_SW: [24, 100], BR_NE: [320, 312], LIVING: [190, 165], BATH: [226, 300], ENTRY: [170, 270], PASSAGE: [215, 185] };
  for (const p of S.plan.pieces) {
    const [x, y] = etiquettes[p.id] || [0, 0];
    el('text', { x, y: -y, 'font-size': 4.2, 'font-weight': 600, fill: T.etiquette, 'text-anchor': 'middle' }, gPlan).textContent = p.nom;
  }
  el('text', { x: 192, y: 40, 'font-size': 4, fill: T.etiquette, 'text-anchor': 'middle' }, gPlan).textContent = 'Balcon';
  gMasque = el('g', {}, svg);
  gCalques = el('g', {}, svg);
  gMeubles = el('g', {}, svg);
  gResultats = el('g', {}, svg);
  appliquerVue();
}

/* ------------------------------------------------------------------ onglets par pièce */
const pieceOnglet = () => S.onglet && S.plan.pieces.find((r) => r.id === S.onglet);
function visible(pl) {
  return !S.onglet || pl.uid === S.sel || (glisse && glisse.id === pl.uid) || pieceDe(pl.x, pl.y) === S.onglet;
}
function vueOnglet() {
  const p = pieceOnglet();
  if (!p) return { ...VUE_INITIALE };
  const [x0, y0, x1, y1] = bornes(p.polygone), marge = 16;
  return { x: x0 - marge, y: -(y1 + marge), w: x1 - x0 + 2 * marge, h: y1 - y0 + 2 * marge };
}
/* Estompe tout ce qui est hors de la pièce ; les murs autour de la pièce restent nets. */
function dessinerMasque() {
  gMasque.innerHTML = '';
  const p = pieceOnglet();
  if (!p) return;
  const trou = p.polygone.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${-y}`).join(' ') + ' Z';
  el('path', { d: `M-200,-500 H600 V200 H-200 Z ${trou}`, 'fill-rule': 'evenodd', fill: T.masque, 'fill-opacity': T.masqueOpacite }, gMasque);
  const [x0, y0, x1, y1] = bornes(p.polygone), m = 14;
  const defs = el('defs', {}, gMasque), clip = el('clipPath', { id: 'clip-piece' }, defs);
  el('rect', { x: x0 - m, y: -(y1 + m), width: x1 - x0 + 2 * m, height: y1 - y0 + 2 * m }, clip);
  const murs = el('g', { 'clip-path': 'url(#clip-piece)' }, gMasque);
  for (const w of S.plan.murs) {
    if (w.type === 'rect') el('rect', { x: w.x[0], y: -w.y[1], width: w.x[1] - w.x[0], height: w.y[1] - w.y[0], fill: T.mur }, murs);
    else el('polygon', { points: pts(w.pts), fill: T.mur }, murs);
  }
  for (const pl of S.plan.plinthes) el('line', { x1: pl.p1[0], y1: -pl.p1[1], x2: pl.p2[0], y2: -pl.p2[1], stroke: T.plinthe, 'stroke-width': 1.6 }, murs);
  el('polygon', { points: pts(p.polygone), fill: 'none', stroke: T.contour, 'stroke-width': 0.8 * T.epais }, gMasque);
}
function dessinerOnglets() {
  const nav = $('onglets');
  nav.innerHTML = '';
  const nb = (id) => S.placements.filter((pl) => S.catById[pl.item]?.type === 'sol' && pieceDe(pl.x, pl.y) === id).length;
  const items = [{ id: null, nom: 'Plan complet' }, ...S.plan.pieces.filter((p) => p.onglet).map((p) => ({ id: p.id, nom: p.nom }))];
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'onglet' + ((S.onglet || null) === it.id ? ' actif' : '');
    d.setAttribute('role', 'tab');
    d.innerHTML = `<button class="titre">${esc(it.nom)}${it.id ? `<span class="compte" title="meubles au sol dans la pièce">${nb(it.id)}</span>` : ''}</button>` +
      (it.id ? '<button class="nouvel" title="Ouvrir cette pièce dans un nouvel onglet du navigateur (synchronisé)">↗</button>' : '');
    d.querySelector('.titre').onclick = () => definirOnglet(it.id);
    const n = d.querySelector('.nouvel');
    if (n) n.onclick = () => window.open(`${location.pathname}#piece=${it.id}${S.planId ? '&plan=' + S.planId : ''}`, '_blank');
    nav.appendChild(d);
  }
}
function definirOnglet(id) {
  S.onglet = id && S.plan.pieces.some((p) => p.id === id) ? id : null;
  S.vb = vueOnglet();
  appliquerVue();
  majBoutonsZoom();
  dessinerMasque();
  const h = new URLSearchParams(location.hash.slice(1));
  if (S.onglet) h.set('piece', S.onglet); else h.delete('piece');
  if (S.planId) h.set('plan', S.planId);
  history.replaceState(null, '', `${location.pathname}${location.search}${h.toString() ? '#' + h : ''}`);
  toutRedessiner();
}
function dessinerPanneauPiece() {
  const sec = $('panneau-piece'), p = pieceOnglet();
  sec.hidden = !p;
  if (!p) return;
  $('piece-titre').textContent = p.nom;
  const ici = S.placements.filter((pl) => S.catById[pl.item] && pieceDe(pl.x, pl.y) === p.id);
  const res = S.resultats && S.resultats.pieces.find((r) => r.piece === p.id);
  let h = `<p class="aide">Emprise ${r1(p.emprise[0])} × ${r1(p.emprise[1])} po · ${p.surface_pi2} pi²</p>`;
  if (res) h += `<p>Plus grand cercle libre : <b>${res.cercle} po</b> <span class="${res.ok ? 'ok-txt' : 'ko-txt'}">${res.ok ? 'OK' : 'insuffisant'}</span></p>`;
  else h += '<p class="aide">Lancez « Vérifier le plan » pour voir le cercle de rotation de la pièce.</p>';
  h += `<h3>Meubles dans la pièce (${ici.length})</h3>`;
  h += ici.length ? '<ul class="liste">' + ici.map((pl) => {
    const m = S.catById[pl.item], [w, d] = dims(pl, m);
    return `<li data-uid="${esc(pl.uid)}" class="${pl.uid === S.sel ? 'sel' : ''}">${esc(m.nom)} · ${r1(w)} × ${r1(d)} po · ${r1(pl.rot || 0)}°</li>`;
  }).join('') + '</ul>' : '<p class="aide">Aucun meuble. Utilisez « + » dans la liste de gauche : le meuble arrive au centre de la pièce.</p>';
  $('piece-contenu').innerHTML = h;
  for (const li of $('piece-contenu').querySelectorAll('li[data-uid]')) li.onclick = () => selectionner(li.dataset.uid);
}

function dessinerMeubles() {
  gMeubles.innerHTML = '';
  gCalques.innerHTML = '';
  const pb = new Set(S.problemes.filter((p) => !p.info).flatMap((p) => [p.uid, p.uid2]));
  const pbInfo = new Set(S.problemes.filter((p) => p.info).map((p) => p.uid));
  const ordre = [...S.placements].sort((a, b) => {
    const ta = S.catById[a.item]?.type === 'sol' ? 0 : 1, tb = S.catById[b.item]?.type === 'sol' ? 0 : 1;
    return ta - tb;
  });
  for (const pl of ordre) {
    const m = S.catById[pl.item];
    if (!m || !visible(pl)) continue;
    const poly = empreinte(pl, m);
    const z = zoneInclinaison(pl, m);
    if (z) el('polygon', { points: pts(z), fill: T.zone, 'fill-opacity': 0.06, stroke: T.zone, 'stroke-width': 0.5 * T.epais, 'stroke-dasharray': '2,1' }, gCalques);
    const g = el('g', { class: 'meuble-svg', 'data-uid': pl.uid }, gMeubles);
    const mince = m.type !== 'sol';
    const couleur = mince ? T.mince : T.meubles[m.categorie];
    let stroke = T.trait, sw = 0.5 * T.epais;
    if (pb.has(pl.uid)) { stroke = T.probleme; sw = 1.6 * T.epais; } else if (pbInfo.has(pl.uid)) { stroke = T.info; sw = 1.2 * T.epais; }
    if (S.sel === pl.uid) { sw += 0.8; stroke = pb.has(pl.uid) ? T.probleme : T.selection; }
    el('polygon', { points: pts(poly), fill: couleur, 'fill-opacity': mince ? 0.95 : 0.82, stroke, 'stroke-width': sw }, g);
    // repère du devant : trait blanc au milieu du côté avant
    const [x0, y0, x1, y1] = bornes(poly);
    if (!mince && m.forme !== 'octogone') {
      const [w, d] = dims(pl, m), L = Math.min(6, w / 3);
      const [ax, ay] = versMonde(pl, -L, -d / 2 + 0.6), [bx, by] = versMonde(pl, L, -d / 2 + 0.6);
      el('line', { x1: ax, y1: -ay, x2: bx, y2: -by, stroke: T.devant, 'stroke-width': 1.2 }, g);
    }
    if (!mince) {
      const fs = Math.max(2.2, Math.min(3.4, (x1 - x0) / 9));
      const t = el('text', { x: (x0 + x1) / 2, y: -(y0 + y1) / 2 + fs / 3, 'font-size': fs, 'text-anchor': 'middle', fill: T.texteMeuble }, g);
      t.textContent = m.nom.replace(/\s*\(.*\)/, '');
    }
    g.addEventListener('pointerdown', (ev) => debutGlisser(ev, pl.uid));
  }
  dessinerPoignees();
}

/* Poignées de redimensionnement (meubles « sur mesure ») : une au milieu de chaque côté, dans le repère du meuble
   (elles suivent la rotation). Le côté opposé reste fixe pendant qu'on tire. */
const TAILLE_MIN = 6, TAILLE_MAX = 200;
const COTES_LOCAUX = { droite: [1, 0], gauche: [-1, 0], arriere: [0, 1], avant: [0, -1] };
function dessinerPoignees() {
  const pl = S.placements.find((p) => p.uid === S.sel);
  const m = pl && S.catById[pl.item];
  if (!m || !m.redimensionnable) return;
  const [w, d] = dims(pl, m);
  const h = Math.max(2, S.vb.w / 110);
  const g = el('g', {}, gMeubles);
  for (const [cote, [nx, ny]] of Object.entries(COTES_LOCAUX)) {
    const [x, y] = versMonde(pl, nx * w / 2, ny * d / 2);
    const r = el('rect', { x: x - h / 2, y: -y - h / 2, width: h, height: h, fill: T.poignee, stroke: T.selection, 'stroke-width': 0.8 * T.epais, style: 'cursor:move' }, g);
    r.addEventListener('pointerdown', (ev) => debutRedim(ev, pl.uid, cote));
  }
  const [, , , y1] = bornes(empreinte(pl, m));
  const fs = Math.max(2.6, S.vb.w / 100);
  el('text', { x: pl.x, y: -y1 - h - 1, 'font-size': fs, 'font-weight': 700, fill: T.selection, 'text-anchor': 'middle' }, g)
    .textContent = `${r1(w)} × ${r1(d)} po`;
}
function debutRedim(ev, id, cote) {
  ev.stopPropagation();
  const pl = S.placements.find((p) => p.uid === id);
  const m = S.catById[pl.item], [w, d] = dims(pl, m);
  glisse = { type: 'redim', id, cote, b: { x: pl.x, y: pl.y, rot: pl.rot || 0, w, d } };   // état au début du geste
  $('plan').setPointerCapture(ev.pointerId);
}
function redimensionner(pl, cote, depart, mx, my) {
  const [lx, ly] = versLocal(depart, mx, my);
  let x0 = -depart.w / 2, x1 = depart.w / 2, y0 = -depart.d / 2, y1 = depart.d / 2;
  const snap = (v) => Math.round(v * 2) / 2;
  const borne = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  if (cote === 'droite') x1 = x0 + borne(snap(lx - x0), TAILLE_MIN, TAILLE_MAX);
  if (cote === 'gauche') x0 = x1 - borne(snap(x1 - lx), TAILLE_MIN, TAILLE_MAX);
  if (cote === 'arriere') y1 = y0 + borne(snap(ly - y0), TAILLE_MIN, TAILLE_MAX);
  if (cote === 'avant') y0 = y1 - borne(snap(y1 - ly), TAILLE_MIN, TAILLE_MAX);
  const [cx, cy] = versMonde(depart, (x0 + x1) / 2, (y0 + y1) / 2);
  pl.x = Math.round(cx * 100) / 100; pl.y = Math.round(cy * 100) / 100;
  pl.w = x1 - x0; pl.d = y1 - y0;
}

/* Aligner sur le mur le plus proche : le dos du meuble contre le mur (droit ou diagonal), le devant vers la pièce. */
function alignerMur(pl) {
  const m = S.catById[pl.item], piece = pieceDe(pl.x, pl.y);
  if (!piece) return alert('Placez d\'abord le meuble dans une pièce.');
  const poly = S.plan.pieces.find((r) => r.id === piece).polygone;
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 12) continue;                                   // ignorer les petits retours de mur
    const dist = distSeg(pl.x, pl.y, a, b);
    if (!best || dist < best.dist) best = { a, b, L, dist };
  }
  if (!best) return;
  const { a, b, L } = best, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  let nx = -uy, ny = ux;                                    // normale du mur
  if (nx * (pl.x - a[0]) + ny * (pl.y - a[1]) < 0) { nx = -nx; ny = -ny; }   // vers l'intérieur (côté du meuble)
  pl.rot = normAngle(Math.atan2(-nx, -ny) * 180 / Math.PI); // devant = normale vers la pièce
  const [, d] = dims(pl, m);
  const t = Math.max(0, Math.min(L, (pl.x - a[0]) * ux + (pl.y - a[1]) * uy));
  pl.x = Math.round((a[0] + ux * t + nx * (d / 2 + 0.5)) * 100) / 100;
  pl.y = Math.round((a[1] + uy * t + ny * (d / 2 + 0.5)) * 100) / 100;
  marquerModifie(); toutRedessiner();
}

function dessinerResultats() {
  gResultats.innerHTML = '';
  if (!S.resultats) return;
  const d = +$('p-cercle').value || 48;
  for (const p of S.resultats.pieces) {
    if (S.onglet && p.piece !== S.onglet) continue;
    const [cx, cy] = p.centre;
    el('circle', { cx, cy: -cy, r: Math.min(p.cercle, d) / 2, fill: 'none', stroke: p.ok ? T.cercleOk : T.cercleKo, 'stroke-width': 0.8 * T.epais, 'stroke-dasharray': '3,2' }, gResultats);
  }
  for (const a of S.resultats.acces) {
    if (a.accessible) continue;
    const pl = S.placements.find((x) => x.uid === a.uid);
    if (!pl || !visible(pl)) continue;
    el('text', { x: pl.x, y: -pl.y - 4, 'font-size': 7, 'font-weight': 700, fill: T.probleme, 'text-anchor': 'middle' }, gResultats).textContent = '!';
  }
}

function toutRedessiner() {
  controles();
  dessinerMeubles();
  dessinerResultats();
  dessinerSelection();
  dessinerCatalogue();
  dessinerOnglets();
  dessinerPanneauPiece();
}

/* ------------------------------------------------------------------ vue (zoom, déplacement) */
function appliquerVue() {
  const v = S.vb;
  $('plan').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}
/* Zoom autour d'un point du plan (par défaut le centre de la vue). f > 1 : éloigner, f < 1 : rapprocher. */
function zoomer(f, centre) {
  const [px, py] = centre || [S.vb.x + S.vb.w / 2, -(S.vb.y + S.vb.h / 2)];
  const sy = -py;
  const w = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, S.vb.w * f)), k = w / S.vb.w;
  S.vb = { x: px - (px - S.vb.x) * k, y: sy - (sy - S.vb.y) * k, w, h: S.vb.h * k };
  appliquerVue();
  majBoutonsZoom();
  if (gMeubles) dessinerMeubles();   // poignées et étiquettes à l'échelle de la vue
}
function recentrer() {
  S.vb = vueOnglet();
  appliquerVue();
  majBoutonsZoom();
  if (gMeubles) dessinerMeubles();
}
function majBoutonsZoom() {
  if (!$('btn-zoom-plus')) return;
  $('btn-zoom-plus').disabled = S.vb.w <= ZOOM_MIN + 0.01;
  $('btn-zoom-moins').disabled = S.vb.w >= ZOOM_MAX - 0.01;
  $('niveau-zoom').textContent = `${Math.round(VUE_INITIALE.w / S.vb.w * 100)} %`;
}
function versPlan(ev) {
  const svg = $('plan'), p = svg.createSVGPoint();
  p.x = ev.clientX; p.y = ev.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return [q.x, -q.y];
}
let glisse = null;
function debutGlisser(ev, id) {
  ev.stopPropagation();
  selectionner(id);
  const pl = S.placements.find((p) => p.uid === id);
  const [x, y] = versPlan(ev);
  glisse = { type: 'meuble', id, dx: pl.x - x, dy: pl.y - y };
  $('plan').setPointerCapture(ev.pointerId);
}
function initVue() {
  const svg = $('plan');
  svg.addEventListener('pointerdown', (ev) => {
    if (glisse) return;
    selectionner(null);
    glisse = { type: 'vue', sx: ev.clientX, sy: ev.clientY, vb: { ...S.vb } };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!glisse) return;
    if (glisse.type === 'meuble') {
      const pl = S.placements.find((p) => p.uid === glisse.id);
      const [x, y] = versPlan(ev);
      const nx = Math.round((x + glisse.dx) * 2) / 2, ny = Math.round((y + glisse.dy) * 2) / 2;
      if (nx !== pl.x || ny !== pl.y) { pl.x = nx; pl.y = ny; marquerModifie(); controles(); dessinerMeubles(); dessinerSelection(); }
    } else if (glisse.type === 'redim') {
      const pl = S.placements.find((p) => p.uid === glisse.id);
      const [x, y] = versPlan(ev);
      const avant = `${pl.w},${pl.d},${pl.x},${pl.y}`;
      redimensionner(pl, glisse.cote, glisse.b, x, y);
      if (`${pl.w},${pl.d},${pl.x},${pl.y}` !== avant) { marquerModifie(); controles(); dessinerMeubles(); dessinerSelection(); }
    } else {
      const r = svg.getBoundingClientRect(), k = glisse.vb.w / r.width;
      S.vb.x = glisse.vb.x - (ev.clientX - glisse.sx) * k;
      S.vb.y = glisse.vb.y - (ev.clientY - glisse.sy) * k;
      appliquerVue();
    }
  });
  const fin = () => { if (glisse && glisse.type !== 'vue') toutRedessiner(); glisse = null; };
  svg.addEventListener('pointerup', fin);
  svg.addEventListener('pointercancel', fin);
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    zoomer(ev.deltaY > 0 ? 1.12 : 1 / 1.12, versPlan(ev));
  }, { passive: false });
}

/* ------------------------------------------------------------------ sélection */
function selectionner(id) {
  S.sel = id;
  dessinerMeubles();
  dessinerSelection();
  dessinerPanneauPiece();
}
function dessinerSelection() {
  const box = $('sel-contenu');
  const pl = S.placements.find((p) => p.uid === S.sel);
  if (!pl) { box.innerHTML = '<p class="aide">Aucun meuble sélectionné. Cliquez sur un meuble du plan.</p>'; return; }
  const m = S.catById[pl.item];
  const [x0, y0, x1, y1] = bornes(empreinte(pl, m));
  const [w, d] = dims(pl, m);
  const piece = pieceDe(pl.x, pl.y);
  const nomPiece = piece ? S.plan.pieces.find((r) => r.id === piece).nom : 'hors des pièces';
  const orient = cardinal(...directionDevant(pl));
  box.innerHTML = `
    <div><b>${esc(m.nom)}</b> <span class="badge">${NOMS_CATEGORIES[m.categorie] || m.categorie}</span>${m.essentiel ? ' <span class="badge ess">essentiel</span>' : ''}</div>
    <div class="aide">${r1(w)} × ${r1(d)} po · ${nomPiece} · devant vers le ${orient} (${r1(pl.rot || 0)}°)${m.note ? '<br>' + esc(m.note) : ''}</div>
    <div class="aide">emprise x ${r1(x0)}–${r1(x1)} · y ${r1(y0)}–${r1(y1)}</div>
    <div class="champs">
      <label>Centre x (po)<input id="s-x" type="number" step="0.5" value="${r1(pl.x)}"></label>
      <label>Centre y (po)<input id="s-y" type="number" step="0.5" value="${r1(pl.y)}"></label>
      ${m.redimensionnable ? `<label>Largeur, côté avant (po)<input id="s-w" type="number" step="0.5" min="${TAILLE_MIN}" max="${TAILLE_MAX}" value="${r1(w)}"></label>
      <label>Profondeur (po)<input id="s-d" type="number" step="0.5" min="${TAILLE_MIN}" max="${TAILLE_MAX}" value="${r1(d)}"></label>` : ''}
    </div>
    ${m.redimensionnable ? `<p class="aide">Dimensions ajustables : tapez-les ci-dessus ou glissez les poignées blanches sur le plan (pas de 0,5 po, ${TAILLE_MIN} à ${TAILLE_MAX} po). Le centre reste en place quand vous tapez une valeur.</p>` : ''}
    <h3>Rotation</h3>
    <div class="rotation">
      <button id="s-rot-90g" title="90° à gauche (Maj+R)">⟲ 90°</button>
      <button id="s-rot-15g" title="15° à gauche ([)">⟲ 15°</button>
      <button id="s-rot-1g" title="1° à gauche (Maj+[)">⟲ 1°</button>
      <label class="angle">Angle (°)<input id="s-angle" type="number" step="1" min="0" max="359.99" value="${r1(pl.rot || 0)}"></label>
      <button id="s-rot-1d" title="1° à droite (Maj+])">⟳ 1°</button>
      <button id="s-rot-15d" title="15° à droite (])">⟳ 15°</button>
      <button id="s-rot-90d" title="90° à droite (R)">⟳ 90°</button>
    </div>
    <div class="boutons">
      <button id="s-mur" title="Tourne le meuble pour que son dos soit contre le mur le plus proche (droit ou diagonal), puis l'y adosse">Aligner sur le mur le plus proche</button>
    </div>
    <p class="aide">0° : devant vers le sud · 90° : ouest · 180° : nord · 270° : est. Le trait blanc marque le devant.</p>
    <div class="boutons">
      <button id="s-dup">Dupliquer</button>
      <button id="s-sup" class="danger">Enlever</button>
    </div>`;
  const maj = () => {
    pl.x = +$('s-x').value; pl.y = +$('s-y').value;
    if (m.redimensionnable) {
      const borne = (v) => Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, Math.round((+v || TAILLE_MIN) * 2) / 2));
      pl.w = borne($('s-w').value); pl.d = borne($('s-d').value);
    }
    marquerModifie(); toutRedessiner();
  };
  for (const id of ['s-x', 's-y', 's-w', 's-d']) if ($(id)) $(id).onchange = maj;
  for (const [id, a] of [['s-rot-90g', -90], ['s-rot-15g', -15], ['s-rot-1g', -1], ['s-rot-1d', 1], ['s-rot-15d', 15], ['s-rot-90d', 90]]) {
    $(id).onclick = () => tourner(pl, a);
  }
  $('s-angle').onchange = () => { pl.rot = normAngle(+$('s-angle').value || 0); marquerModifie(); toutRedessiner(); };
  $('s-mur').onclick = () => alignerMur(pl);
  $('s-sup').onclick = () => enlever(pl.uid);
  $('s-dup').onclick = () => ajouter(pl.item, pl.x + 6, pl.y - 6, pl);
}
/* Rotation autour du centre du meuble (sens horaire positif). */
function tourner(pl, a) { pl.rot = normAngle((pl.rot || 0) + a); marquerModifie(); toutRedessiner(); }
function enlever(id) { S.placements = S.placements.filter((p) => p.uid !== id); S.sel = null; marquerModifie(); toutRedessiner(); }

document.addEventListener('keydown', (ev) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
    if (ev.key === '+' || ev.key === '=') { zoomer(1 / 1.25); ev.preventDefault(); return; }
    if (ev.key === '-' || ev.key === '_') { zoomer(1.25); ev.preventDefault(); return; }
    if (ev.key === '0') { recentrer(); ev.preventDefault(); return; }
  }
  const pl = S.placements.find((p) => p.uid === S.sel);
  if (!pl) return;
  const pas = ev.shiftKey ? 6 : 1;
  const k = ev.key;
  if (k === 'r' || k === 'R') tourner(pl, ev.shiftKey ? -90 : 90);
  else if (k === ']' || k === '}') tourner(pl, ev.shiftKey ? 1 : 15);
  else if (k === '[' || k === '{') tourner(pl, ev.shiftKey ? -1 : -15);
  else if (k === 'Delete' || k === 'Backspace') enlever(pl.uid);
  else if (k === 'Escape') selectionner(null);
  else if (k.startsWith('Arrow')) {
    if (k === 'ArrowLeft') pl.x -= pas; if (k === 'ArrowRight') pl.x += pas;
    if (k === 'ArrowUp') pl.y += pas; if (k === 'ArrowDown') pl.y -= pas;
    marquerModifie(); toutRedessiner();
  } else return;
  ev.preventDefault();
});

/* ------------------------------------------------------------------ catalogue */
function compte(id) { return S.placements.filter((p) => p.item === id).length; }
function dessinerCatalogue() {
  const box = $('liste-catalogue');
  box.innerHTML = '';
  const groupes = { perso: 'Meubles créés', existant: 'Meubles existants', nouveau: 'À acheter', sur_mesure: 'Sur mesure' };
  for (const [cat, titre] of Object.entries(groupes)) {
    const liste = S.cat.filter((x) => x.categorie === cat);
    if (!liste.length) continue;
    const g = document.createElement('div');
    g.className = 'groupe-cat';
    g.innerHTML = `<h3>${titre}</h3>`;
    for (const m of liste) {
      const n = compte(m.id);
      const d = document.createElement('div');
      d.className = 'meuble';
      const badges = [];
      if (m.essentiel) badges.push(`<span class="badge ${n >= m.quantite ? 'ok' : 'ess'}">essentiel</span>`);
      if (m.type === 'mural') badges.push('<span class="badge">mural</span>');
      if (m.type === 'sur_meuble') badges.push('<span class="badge">posé sur un meuble</span>');
      if (m.type === 'accessoire') badges.push('<span class="badge">accessoire</span>');
      if (m.inclinaison) badges.push(`<span class="badge">${m.inclinaison} po incliné</span>`);
      if (m.redimensionnable) badges.push('<span class="badge">dimensions ajustables</span>');
      badges.push(`<span class="badge">${n}/${m.quantite} placé${m.quantite > 1 ? 's' : ''}</span>`);
      d.innerHTML = `<div><div class="nom">${esc(m.nom)}</div><div class="dim">${m.w} × ${m.d} po${m.forme === 'octogone' ? ' (octogone)' : ''}</div></div>
        <div class="actions">${m.categorie === 'perso' ? '<button class="danger supprimer" title="Supprimer ce meuble du catalogue">×</button>' : ''}
        <button class="ajouter" title="Ajouter" ${n >= m.quantite ? 'disabled' : ''}>+</button></div><div class="badges">${badges.join('')}</div>`;
      d.querySelector('button.ajouter').onclick = () => ajouterAuCentre(m.id);
      const sup = d.querySelector('button.supprimer');
      if (sup) sup.onclick = () => supprimerMeuble(m).catch((e) => alert(e.message));
      g.appendChild(d);
    }
    box.appendChild(g);
  }
}
function ajouterAuCentre(item) {
  const v = S.vb;
  ajouter(item, Math.round(v.x + v.w / 2), Math.round(-(v.y + v.h / 2)));
}

/* ------------------------------------------------------------------ meubles créés par l'utilisateur */
async function rechargerCatalogue() {
  const cat = await api('/api/catalogue');
  S.cat = cat.meubles;
  S.catById = Object.fromEntries(cat.meubles.map((m) => [m.id, m]));
}
async function creerMeuble(ev) {
  ev.preventDefault();
  $('m-erreur').textContent = '';
  const corps = {
    nom: $('m-nom').value.trim(), w: +$('m-w').value, d: +$('m-d').value, type: $('m-type').value,
    quantite: +$('m-quantite').value, acces: $('m-acces').checked,
  };
  const placer = $('m-placer').checked;
  try {
    const m = await api('/api/meubles', { method: 'POST', body: JSON.stringify(corps) });
    await rechargerCatalogue();
    if (canal) canal.postMessage({ type: 'catalogue', source: ID_ONGLET });
    $('form-meuble').reset();
    $('m-quantite').value = 1; $('m-acces').checked = true; $('m-placer').checked = placer;
    if (placer) ajouterAuCentre(m.id); else dessinerCatalogue();
  } catch (e) {
    $('m-erreur').textContent = `Impossible de créer le meuble : ${e.message}`;
  }
}
async function supprimerMeuble(m) {
  if (compte(m.id)) {
    alert(`« ${m.nom} » est placé dans le plan ouvert. Enlevez-le du plan (et enregistrez) avant de le supprimer du catalogue.`);
    return;
  }
  if (!confirm(`Supprimer « ${m.nom} » du catalogue pour tout le monde ?`)) return;
  await api(`/api/meubles/${m.id}`, { method: 'DELETE' });
  await rechargerCatalogue();
  if (canal) canal.postMessage({ type: 'catalogue', source: ID_ONGLET });
  dessinerCatalogue();
}

function ajouter(item, x, y, modele) {
  const m = S.catById[item];
  if (compte(item) >= m.quantite) return;
  const pl = { uid: uid(), item, x, y, rot: modele ? modele.rot : 0 };
  if (m.redimensionnable) { pl.w = modele?.w || m.w; pl.d = modele?.d || m.d; }
  S.placements.push(pl);
  S.sel = pl.uid;
  marquerModifie();
  toutRedessiner();
}

/* ------------------------------------------------------------------ vérification complète */
function parametres() {
  return { passage: +$('p-passage').value, cercle: +$('p-cercle').value, plinthe: +$('p-plinthe').value, cote_lit: +$('p-cote_lit').value };
}
async function verifier() {
  const btn = $('btn-verifier');
  btn.disabled = true; btn.textContent = 'Vérification…';
  try {
    S.resultats = await api('/api/verifier', { method: 'POST', body: JSON.stringify({ placements: S.placements, parametres: parametres() }) });
    afficherResultats();
    dessinerResultats();
  } catch (e) {
    $('resultats').innerHTML = `<p class="ko-txt">Erreur : ${e.message}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Vérifier le plan';
  }
}
function afficherResultats() {
  const R = S.resultats, p = R.parametres;
  const nom = (uidm) => { const pl = S.placements.find((x) => x.uid === uidm); return pl ? S.catById[pl.item].nom : uidm; };
  let h = '';
  h += R.essentiels_manquants.length
    ? `<p class="ko-txt">Meubles essentiels manquants : ${esc(R.essentiels_manquants.join(', '))}</p>`
    : '<p class="ok-txt">Tous les meubles essentiels sont placés.</p>';
  h += `<h3>Cercle de rotation (${p.cercle} po)</h3><table class="res"><tr><th>Pièce</th><th>Plus grand cercle libre</th><th></th></tr>`;
  for (const r of R.pieces) h += `<tr><td>${esc(r.nom)}</td><td>${r.cercle} po</td><td class="${r.ok ? 'ok-txt' : 'ko-txt'}">${r.ok ? 'OK' : 'insuffisant'}</td></tr>`;
  h += '</table>';
  for (const l of R.lit) {
    const c = Object.entries(l.cotes).map(([k, v]) => `${k} ${v} po (min. ${l.minimums[k]})`).join(' · ');
    h += `<h3>Lit</h3><p>Meilleure zone de 30 po de chaque côté : ${c}.<br>Côté de transfert : <b>${l.transfert}</b> <span class="${l.ok ? 'ok-txt' : 'ko-txt'}">${l.ok ? `≥ ${p.cote_lit} po OK` : `< ${p.cote_lit} po`}</span></p>`;
  }
  const ko = R.acces.filter((a) => !a.accessible);
  h += `<h3>Accès avec la marchette (passage ${p.passage} po)</h3>`;
  h += ko.length ? '<ul class="liste">' + ko.map((a) => `<li data-uid="${esc(a.uid)}">${esc(a.nom)} : aucun passage de ${p.passage} po depuis l'entrée de la pièce</li>`).join('') + '</ul>'
    : '<p class="ok-txt">Tous les meubles à utiliser sont accessibles.</p>';
  const okA = R.acces.filter((a) => a.accessible);
  if (okA.length) h += '<p class="aide">Accessibles : ' + okA.map((a) => `${esc(a.nom)} (${a.cotes.join(', ')})`).join(' · ') + '</p>';
  if (R.problemes.length) h += `<h3>Problèmes</h3><ul class="liste">${R.problemes.map((x) => `<li class="${x.type === 'plinthe' ? 'info' : ''}" data-uid="${esc(x.uid)}">${esc(x.message)}</li>`).join('')}</ul>`;
  $('resultats').innerHTML = h;
  for (const li of $('resultats').querySelectorAll('li[data-uid]')) li.onclick = () => selectionner(li.dataset.uid);
}

/* ------------------------------------------------------------------ synchronisation entre onglets du navigateur
   Toutes les vues d'une même fenêtre partagent le même état. Entre fenêtres (bouton ↗), chaque changement
   est diffusé ; les fenêtres qui ont le même plan ouvert l'appliquent (y compris les changements non enregistrés). */
const canal = ('BroadcastChannel' in window) ? new BroadcastChannel('amenagement-1400-desgagne') : null;
let enReception = false, diffusionPrevue = false;
function diffuser() {
  if (!canal || enReception || diffusionPrevue) return;
  diffusionPrevue = true;
  // setTimeout plutôt que requestAnimationFrame : ce dernier est suspendu dans les onglets en arrière-plan.
  setTimeout(() => {
    diffusionPrevue = false;
    canal.postMessage({ type: 'etat', source: ID_ONGLET, planId: S.planId, nom: $('nom-plan').value, placements: S.placements, modifie: S.modifie });
  }, 30);
}
async function recevoir(msg) {
  if (!msg || msg.source === ID_ONGLET) return;
  if (msg.type === 'catalogue') { await rechargerCatalogue(); toutRedessiner(); return; }
  if (msg.type === 'demande' && msg.planId === S.planId) { diffuser(); return; }
  if (msg.type === 'enregistre' && msg.ancienId === S.planId) {
    S.planId = msg.planId; $('nom-plan').value = msg.nom; S.modifie = false; $('etat').textContent = 'enregistré';
    await chargerListe(S.planId); return;
  }
  if (msg.type !== 'etat' || msg.planId !== S.planId) return;
  if (msg.placements.some((pl) => !S.catById[pl.item])) await rechargerCatalogue();
  enReception = true;
  try {
    S.placements = msg.placements;
    if (S.sel && !S.placements.some((pl) => pl.uid === S.sel)) S.sel = null;
    $('nom-plan').value = msg.nom;
    S.modifie = msg.modifie;
    $('etat').innerHTML = (msg.modifie ? 'non enregistré' : 'enregistré') + '<span class="sync">⇄ synchronisé</span>';
    if (msg.modifie) { S.resultats = null; $('resultats').innerHTML = ''; }
    toutRedessiner();
  } finally { enReception = false; }
}
if (canal) canal.onmessage = (ev) => recevoir(ev.data).catch((e) => console.error(e));

/* ------------------------------------------------------------------ plans enregistrés */
function marquerModifie(v = true) {
  S.modifie = v;
  $('etat').textContent = v ? 'non enregistré' : 'enregistré';
  if (v) { S.resultats = null; $('resultats').innerHTML = ''; if (gResultats) gResultats.innerHTML = ''; }
  diffuser();
}
async function chargerListe(selection) {
  const plans = await api('/api/plans');
  const sel = $('liste-plans');
  sel.innerHTML = plans.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)}</option>`).join('');
  if (selection) sel.value = selection;
  return plans;
}
async function ouvrir(id) {
  if (S.modifie && !confirm('Le plan actuel n\'est pas enregistré. Continuer ?')) return;
  const p = await api(`/api/plans/${id}`);
  S.planId = p.id; S.nomPlan = p.nom; S.placements = p.placements; S.sel = null;
  $('nom-plan').value = p.nom;
  S.modifie = false; $('etat').textContent = 'enregistré';
  S.resultats = null; $('resultats').innerHTML = '';
  definirOnglet(S.onglet);                      // met aussi à jour l'adresse (#piece=…&plan=…)
}
async function enregistrer(sous) {
  const ancienId = S.planId;
  let nom = $('nom-plan').value.trim() || 'Sans titre';
  if (sous || !S.planId) {
    nom = prompt('Nom du nouveau plan :', sous ? `${nom} (copie)` : nom);
    if (!nom) return;
    const p = await api('/api/plans', { method: 'POST', body: JSON.stringify({ nom, placements: S.placements }) });
    S.planId = p.id;
  } else {
    await api(`/api/plans/${S.planId}`, { method: 'PUT', body: JSON.stringify({ nom, placements: S.placements }) });
  }
  S.nomPlan = nom; $('nom-plan').value = nom;
  marquerModifie(false);
  if (canal && !sous) canal.postMessage({ type: 'enregistre', source: ID_ONGLET, ancienId, planId: S.planId, nom });
  await chargerListe(S.planId);
}
async function supprimer() {
  const id = $('liste-plans').value;
  if (!id) return;
  const nom = $('liste-plans').selectedOptions[0].textContent;
  if (!confirm(`Supprimer définitivement le plan « ${nom} » ?`)) return;
  await api(`/api/plans/${id}`, { method: 'DELETE' });
  if (id === S.planId) { S.planId = null; marquerModifie(true); }
  await chargerListe(S.planId);
}
function exporterSVG() {
  const svg = $('plan').cloneNode(true);
  const v = S.onglet ? vueOnglet() : { ...VUE_INITIALE }, k = 4;
  svg.setAttribute('viewBox', `${v.x} ${v.y - 14} ${v.w} ${v.h + 14}`);
  svg.setAttribute('width', Math.round(v.w * k)); svg.setAttribute('height', Math.round((v.h + 14) * k));
  const titre = el('text', { x: v.x + 4, y: v.y - 4, 'font-size': Math.max(4, v.w / 60), 'font-weight': 700 });
  titre.textContent = `${$('nom-plan').value}${S.onglet ? ' – ' + pieceOnglet().nom : ''} – 1 unité = 1 po`;
  svg.appendChild(titre);
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(($('nom-plan').value || 'plan') + (S.onglet ? '_' + S.onglet : '')).replace(/[^\w\-]+/g, '_')}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------------------------------------------ démarrage */
async function demarrer() {
  let themeMemorise = 'classique';
  try { themeMemorise = localStorage.getItem(CLE_THEME) || 'classique'; } catch (e) { /* navigation privée */ }
  $('theme').innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.nom}</option>`).join('');
  appliquerTheme(themeMemorise, false);
  $('theme').onchange = () => appliquerTheme($('theme').value);
  window.addEventListener('storage', (ev) => { if (ev.key === CLE_THEME && ev.newValue) appliquerTheme(ev.newValue, false); });   // autres fenêtres
  try {
    const [plan, cat] = await Promise.all([api('/api/plan'), api('/api/catalogue')]);
    S.plan = plan; S.cat = cat.meubles; S.catById = Object.fromEntries(cat.meubles.map((m) => [m.id, m]));
    dessinerPlan();
    initVue();
    const plans = await chargerListe();
    const h = new URLSearchParams(location.hash.slice(1));
    S.onglet = S.plan.pieces.some((p) => p.id === h.get('piece')) ? h.get('piece') : null;
    const voulu = plans.find((p) => p.id === h.get('plan')) || plans[0];
    if (voulu) { await ouvrir(voulu.id); $('liste-plans').value = voulu.id; } else { $('nom-plan').value = S.nomPlan; definirOnglet(S.onglet); }
    if (canal) canal.postMessage({ type: 'demande', source: ID_ONGLET, planId: S.planId });   // récupérer les changements non enregistrés
    window.addEventListener('hashchange', () => {
      const p = new URLSearchParams(location.hash.slice(1)).get('piece');
      if ((p || null) !== S.onglet) definirOnglet(p);
    });
  } catch (e) {
    document.body.insertAdjacentHTML('afterbegin', `<p class="ko-txt" style="padding:8px">Impossible de charger l'application : ${e.message}</p>`);
  }
  $('btn-verifier').onclick = verifier;
  $('btn-enregistrer').onclick = () => enregistrer(false).catch((e) => alert(e.message));
  $('btn-enregistrer-sous').onclick = () => enregistrer(true).catch((e) => alert(e.message));
  $('btn-ouvrir').onclick = () => ouvrir($('liste-plans').value).catch((e) => alert(e.message));
  $('btn-supprimer').onclick = () => supprimer().catch((e) => alert(e.message));
  $('btn-export').onclick = exporterSVG;
  $('btn-nouveau').onclick = () => {
    if (S.modifie && !confirm('Le plan actuel n\'est pas enregistré. Continuer ?')) return;
    S.planId = null; S.placements = []; S.sel = null; $('nom-plan').value = 'Nouveau plan';
    marquerModifie(true); toutRedessiner();
  };
  $('nom-plan').oninput = () => marquerModifie(true);
  $('form-meuble').onsubmit = creerMeuble;
  $('btn-zoom-plus').onclick = () => zoomer(1 / 1.25);
  $('btn-zoom-moins').onclick = () => zoomer(1.25);
  $('btn-recentrer').onclick = recentrer;
  majBoutonsZoom();
  for (const id of ['p-plinthe']) $(id).onchange = toutRedessiner;
}
demarrer();
