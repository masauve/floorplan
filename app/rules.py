"""Moteur de règles : géométrie du plan, collisions, plinthes, passages de 36 po, cercles de rotation.

Repère global en pouces : origine = coin intérieur sud-ouest de la chambre SO, +x vers l'est, +y vers le nord.
Source : data/floorplan_data.json (extrait du PDF vectoriel, échelle 1:100).
"""
import json
import math
from collections import deque
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
PLAN = json.loads((HERE / 'data' / 'floorplan_data.json').read_text(encoding='utf-8'))
CATALOGUE = json.loads((HERE / 'data' / 'catalogue.json').read_text(encoding='utf-8'))
CAT = {m['id']: m for m in CATALOGUE['meubles']}

DEFAUTS = {'passage': 36.0, 'cercle': 48.0, 'plinthe': 12.0, 'cote_lit': 36.0}


def R(x0, y0, x1, y1):
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]


PIECES = {r['id']: r['polygon'] for r in PLAN['rooms'] if r['id'] != 'BALCONY'}
NOMS = {'BR_SW': 'Chambre (SO)', 'BR_NE': 'Chambre (NE) / bureau', 'LIVING': 'Séjour et cuisine',
        'BATH': 'Salle de bain', 'ENTRY': "Vestibule d'entrée", 'PASSAGE': 'Passage'}
C3 = [c for c in PLAN['closets'] if c['id'] == 'C3'][0]['polygon']

# Éléments fixes : aucun meuble ne doit les chevaucher.
FIXES = {
    'BR_SW': [('pilier SO', R(0, 0, 4.4, 9.7)), ('pilier SE', R(121.7, 0, 127.2, 9.7)),
              ('portes du placard C1', R(0, 105, 48, 113))],
    'BR_NE': [('placard C3', C3), ('portes du placard C2', R(276.8, 309.8, 324.9, 317.8))],
    'LIVING': [('pilier SO', R(131.9, 0, 136.5, 9.7)), ('pilier SE', R(356.8, 0, 366.4, 9.7)),
               ('colonne est', R(356.8, 102.9, 378.4, 117.7)), ('comptoir nord', R(254, 149.7, 346, 175.2)),
               ('évier / comptoir est', R(346, 144.3, 378.4, 175.2)), ('réfrigérateur', R(353, 117.7, 378.4, 144.3))],
    'BATH': [('baignoire', R(241, 281.7, 272.2, 341.7)), ('toilette', R(181.6, 312.3, 211.3, 333.2)),
             ('lavabo', [[231.1, 242.5], [245.9, 257.3], [233.9, 269.3], [219.1, 254.5]])],
}
# Débattement de porte (charnière, rayon, angle début, angle fin). Porte de la chambre SO enlevée.
PORTES = [{'piece': 'BR_NE', 'charniere': [254.0, 178.6], 'rayon': 34, 'a0': 47.5, 'a1': 137.5}]
PLINTHES = [{'nom': 'plinthe chambre SO (mur sud)', 'p1': [59.8, 0], 'p2': [107.9, 0]},
            {'nom': 'plinthe séjour (mur sud)', 'p1': [277.4, 0], 'p2': [325.4, 0]},
            {'nom': 'plinthe chambre NE (mur est)', 'p1': [378.4, 187.3], 'p2': [378.4, 235.3]}]
# Point d'entrée de chaque pièce (départ des passages de 36 po).
ENTREES = {'BR_SW': (115, 116.75), 'BR_NE': (262, 205), 'LIVING': (215, 135), 'BATH': (204, 275), 'ENTRY': (175, 245)}



# ---------------------------------------------------------------- géométrie de base
def point_dans(px, py, poly):
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            c = not c
    return c


def dist_seg(px, py, a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L))
    return math.hypot(px - x1 - t * dx, py - y1 - t * dy)


def aretes(poly):
    return [(poly[i - 1], poly[i]) for i in range(len(poly))]


def echantillons(poly, n=12):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    x0, x1, y0, y1 = min(xs) + .05, max(xs) - .05, min(ys) + .05, max(ys) - .05
    pts = [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n) for i in range(n + 1) for j in range(n + 1)]
    return pts if len(poly) == 4 else [p for p in pts if point_dans(*p, poly)]


def piece_de(x, y):
    for pid, poly in PIECES.items():
        if point_dans(x, y, poly):
            return pid
    return None


# ---------------------------------------------------------------- meubles placés
# Repère local d'un meuble : origine au centre, x vers sa droite, y vers l'arrière ; le DEVANT est du côté -y.
# rot = angle en degrés, sens horaire sur le plan (0 : devant au sud, 90 : ouest, 180 : nord, 270 : est).
def angle(pl):
    return float(pl.get('rot', 0) or 0) % 360


def _cs(rot):
    t = math.radians(rot)
    c, s = math.cos(t), math.sin(t)
    return (0.0 if abs(c) < 1e-12 else c), (0.0 if abs(s) < 1e-12 else s)


def vers_monde(pl, lx, ly):
    c, s = _cs(angle(pl))
    return [round(float(pl['x']) + lx * c + ly * s, 6), round(float(pl['y']) - lx * s + ly * c, 6)]


def direction_monde(pl, lx, ly):
    c, s = _cs(angle(pl))
    return (lx * c + ly * s, -lx * s + ly * c)


def dims(pl, m):
    """Largeur (côté avant) et profondeur du meuble, dans son propre repère."""
    w = float(pl.get('w') or m['w']) if m.get('redimensionnable') else float(m['w'])
    d = float(pl.get('d') or m['d']) if m.get('redimensionnable') else float(m['d'])
    return w, d


def contour_local(m, w, d):
    x0, y0, x1, y1 = -w / 2, -d / 2, w / 2, d / 2
    if m.get('forme') == 'octogone':
        c = min(w, d) * 0.293
        return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]]
    return R(x0, y0, x1, y1)


def empreinte(pl, m):
    w, d = dims(pl, m)
    return [vers_monde(pl, *p) for p in contour_local(m, w, d)]


def echantillons_meuble(pl, m, n=12):
    """Grille de points sur toute la surface du meuble (calculée dans son repère, donc valable à tout angle)."""
    w, d = dims(pl, m)
    loc = contour_local(m, w, d)
    pts = [(-w / 2 + .05 + (w - .1) * i / n, -d / 2 + .05 + (d - .1) * j / n) for i in range(n + 1) for j in range(n + 1)]
    if m.get('forme') == 'octogone':
        pts = [p for p in pts if point_dans(*p, loc)]
    return [tuple(vers_monde(pl, *p)) for p in pts]


def zone_inclinaison(pl, m):
    """Recliner : 64 po incliné. Zone réservée devant le meuble (répartition dossier/repose-pieds inconnue)."""
    w, d = dims(pl, m)
    ext = float(m.get('inclinaison', 0)) - d
    if ext <= 0:
        return None
    return [vers_monde(pl, *p) for p in R(-w / 2, -d / 2 - ext, w / 2, d / 2)]


NOMS_DIRECTIONS = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est']


def cardinal(vx, vy):
    return NOMS_DIRECTIONS[int(round(math.degrees(math.atan2(vy, vx)) / 45)) % 8]


# côtés du meuble dans son repère : normale sortante, axe le long du côté, demi-longueur selon w ou d
COTES_LOCAUX = {'avant': ((0, -1), (1, 0), 'w'), 'arriere': ((0, 1), (1, 0), 'w'),
                'gauche': ((-1, 0), (0, 1), 'd'), 'droite': ((1, 0), (0, 1), 'd')}


def point_cote(pl, m, cote, t, off):
    """Point à la position t le long du côté (−L/2..L/2) et à la distance off à l'extérieur du meuble."""
    w, d = dims(pl, m)
    (nx, ny), (ax, ay), _ = COTES_LOCAUX[cote]
    demi = d / 2 if nx == 0 else w / 2
    return vers_monde(pl, nx * (demi + off) + ax * t, ny * (demi + off) + ay * t)


def longueur_cote(pl, m, cote):
    w, d = dims(pl, m)
    return w if COTES_LOCAUX[cote][2] == 'w' else d


def nom_cote(pl, cote):
    return cardinal(*direction_monde(pl, *COTES_LOCAUX[cote][0]))


def resoudre(placements, cat=None):
    """Retourne la liste des meubles placés avec leur polygone, leurs points d'échantillonnage, leur pièce et leur fiche."""
    cat = cat or CAT
    out = []
    for pl in placements:
        m = cat.get(pl.get('item'))
        if not m:
            continue
        out.append({'uid': pl.get('uid'), 'm': m, 'pl': pl, 'poly': empreinte(pl, m), 'pts': echantillons_meuble(pl, m),
                    'piece': piece_de(float(pl['x']), float(pl['y'])), 'zone': zone_inclinaison(pl, m)})
    return out


def dans_secteur(p, porte):
    (hx, hy), r = porte['charniere'], porte['rayon']
    dx, dy = p[0] - hx, p[1] - hy
    return math.hypot(dx, dy) < r and porte['a0'] <= math.degrees(math.atan2(dy, dx)) % 360 <= porte['a1']


def problemes(meubles, params):
    """Contrôles simples (les mêmes que dans le navigateur)."""
    out = []
    sol = [e for e in meubles if e['m']['type'] == 'sol']
    for e in sol:
        pts = e['pts']
        nom = e['m']['nom']
        if e['piece'] is None:
            out.append({'uid': e['uid'], 'type': 'hors_piece', 'message': f"{nom} : hors des pièces"})
            continue
        if any(not point_dans(*p, PIECES[e['piece']]) for p in pts):
            out.append({'uid': e['uid'], 'type': 'mur', 'message': f"{nom} : traverse un mur ou sort de la pièce"})
        for fn, fp in FIXES.get(e['piece'], []):
            if any(point_dans(*p, fp) for p in pts):
                out.append({'uid': e['uid'], 'type': 'fixe', 'message': f"{nom} : chevauche {fn}"})
        for porte in PORTES:
            if porte['piece'] == e['piece'] and any(dans_secteur(p, porte) for p in pts):
                out.append({'uid': e['uid'], 'type': 'porte', 'message': f"{nom} : dans le débattement de la porte"})
        for pl in PLINTHES:
            d = min(dist_seg(x, y, pl['p1'], pl['p2']) for x, y in echantillons_meuble(e['pl'], e['m'], 16))
            if d < params['plinthe']:
                out.append({'uid': e['uid'], 'type': 'plinthe', 'message': f"{nom} : à {d:.1f} po de la {pl['nom']}"})
    for i in range(len(sol)):
        for j in range(i + 1, len(sol)):
            a, b = sol[i], sol[j]
            if any(point_dans(*p, b['poly']) for p in a['pts']) or any(point_dans(*p, a['poly']) for p in b['pts']):
                out.append({'uid': a['uid'], 'uid2': b['uid'], 'type': 'chevauchement',
                            'message': f"{a['m']['nom']} chevauche {b['m']['nom']}"})
    return out


# ---------------------------------------------------------------- grilles de dégagement (numpy)
def _dans_np(X, Y, poly):
    inside = np.zeros(X.shape, bool)
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if y1 == y2:
            continue
        cond = (y1 > Y) != (y2 > Y)
        xi = (x2 - x1) * (Y - y1) / (y2 - y1) + x1
        inside ^= cond & (X < xi)
    return inside


def _dist_np(X, Y, a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    L = dx * dx + dy * dy
    if L == 0:
        return np.hypot(X - x1, Y - y1)
    t = np.clip(((X - x1) * dx + (Y - y1) * dy) / L, 0, 1)
    return np.hypot(X - x1 - t * dx, Y - y1 - t * dy)


def grille(piece, obstacles):
    """Distance de chaque point libre (grille de 1 po) au mur ou obstacle le plus proche. -1 = occupé."""
    P = PIECES[piece]
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    gx = np.arange(int(min(xs)), int(max(xs)) + 1, dtype=float)
    gy = np.arange(int(min(ys)), int(max(ys)) + 1, dtype=float)
    X, Y = np.meshgrid(gx, gy)
    libre = _dans_np(X, Y, P)
    for o in obstacles:
        libre &= ~_dans_np(X, Y, o)
    D = np.full(X.shape, np.inf)
    for poly in [P] + list(obstacles):
        for a, b in aretes(poly):
            D = np.minimum(D, _dist_np(X, Y, a, b))
    D[~libre] = -1
    return gx, gy, D


def accessibles(gx, gy, D, depart, r):
    """Cellules atteignables depuis le point d'entrée avec un passage de 2r po."""
    X, Y = np.meshgrid(gx, gy)
    proche = (np.hypot(X - depart[0], Y - depart[1]) <= 24) & (D >= 0)
    if not proche.any():
        return np.zeros(D.shape, bool)
    cand = np.where(proche, D, -1)
    j, i = np.unravel_index(np.argmax(cand), D.shape)
    vu = np.zeros(D.shape, bool)
    if D[j, i] < r:
        return vu
    ok = D >= r
    vu[j, i] = True
    q = deque([(j, i)])
    while q:
        j, i = q.popleft()
        for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nj, ni = j + dj, i + di
            if 0 <= nj < ok.shape[0] and 0 <= ni < ok.shape[1] and ok[nj, ni] and not vu[nj, ni]:
                vu[nj, ni] = True
                q.append((nj, ni))
    return vu


def _atteint(gx, gy, vu, p, tol=8):
    X, Y = np.meshgrid(gx, gy)
    return bool((vu & (np.hypot(X - p[0], Y - p[1]) <= tol)).any())


def approches(pl, m, pas=6):
    """Points d'approche le long de chaque côté du meuble (tous les 6 po), à 19 po de lui
    (moitié d'un passage de 36 po + 1). Les côtés sont nommés selon leur direction sur le plan."""
    out = {}
    for cote in COTES_LOCAUX:
        L = longueur_cote(pl, m, cote)
        ts = np.linspace(-L / 2, L / 2, max(2, int(L // pas) + 1))
        out[nom_cote(pl, cote)] = [tuple(point_cote(pl, m, cote, float(t), 19)) for t in ts]
    return out


def largeur_cote(pl, m, cote, libre_fn, fenetre=30, maxi=72):
    """Dégagement d'un côté du lit (repère du meuble, donc valable à tout angle) : profil pouce par pouce le long du côté.
    Retourne (meilleure largeur sur une fenêtre de 30 po = zone de transfert, largeur minimale sur toute la longueur)."""
    L = longueur_cote(pl, m, cote)
    profil = []
    for t in np.arange(-L / 2 + .5, L / 2, 1.0):
        w = 0
        for off in range(1, maxi + 1):
            if libre_fn(*point_cote(pl, m, cote, float(t), off - .5)):
                w = off
            else:
                break
        profil.append(w)
    n = min(fenetre, len(profil))
    meilleure = max(min(profil[k:k + n]) for k in range(len(profil) - n + 1))
    return meilleure, min(profil)


def verifier(placements, params=None, cat=None):
    """cat : catalogue complet (fixe + meubles créés par les utilisateurs). Par défaut, le catalogue fixe."""
    params = {**DEFAUTS, **(params or {})}
    meubles = resoudre(placements, cat)
    res = {'parametres': params, 'problemes': problemes(meubles, params), 'pieces': [], 'acces': [], 'lit': [],
           'essentiels_manquants': []}
    places = {}
    for e in meubles:
        places[e['m']['id']] = places.get(e['m']['id'], 0) + 1
    for m in CATALOGUE['meubles']:
        if m['essentiel'] and places.get(m['id'], 0) < m['quantite']:
            res['essentiels_manquants'].append(f"{m['nom']} ({places.get(m['id'], 0)}/{m['quantite']})")
    r = params['passage'] / 2
    for piece in ('BR_SW', 'BR_NE', 'LIVING', 'BATH', 'ENTRY'):
        ici = [e for e in meubles if e['piece'] == piece and e['m']['type'] == 'sol']
        obstacles = [fp for _, fp in FIXES.get(piece, [])] + [e['poly'] for e in ici] + [e['zone'] for e in ici if e['zone']]
        gx, gy, D = grille(piece, obstacles)
        j, i = np.unravel_index(np.argmax(D), D.shape)
        diam = round(float(2 * D[j, i]), 1)
        res['pieces'].append({'piece': piece, 'nom': NOMS[piece], 'cercle': diam, 'centre': [float(gx[i]), float(gy[j])],
                              'ok': diam >= params['cercle']})
        vu = accessibles(gx, gy, D, ENTREES[piece], r)
        for e in ici:
            if e['m'].get('acces'):
                ap = approches(e['pl'], e['m'])
                cotes = [c for c, pts in ap.items() if any(_atteint(gx, gy, vu, p, tol=4) for p in pts)]
                res['acces'].append({'uid': e['uid'], 'nom': e['m']['nom'], 'piece': piece, 'accessible': bool(cotes), 'cotes': cotes})
            if e['m'].get('lit'):
                def libre(x, y, piece=piece, obstacles=obstacles):
                    return point_dans(x, y, PIECES[piece]) and not any(point_dans(x, y, o) for o in obstacles)
                w, d = dims(e['pl'], e['m'])
                longs = ('avant', 'arriere') if w >= d else ('gauche', 'droite')
                mesures = {nom_cote(e['pl'], c): largeur_cote(e['pl'], e['m'], c, libre) for c in longs}
                largeurs = {c: v[0] for c, v in mesures.items()}
                transfert = max(largeurs, key=largeurs.get)
                res['lit'].append({'uid': e['uid'], 'cotes': largeurs, 'minimums': {c: v[1] for c, v in mesures.items()},
                                   'transfert': transfert, 'ok': largeurs[transfert] >= params['cote_lit']})
    return res


def plan_public():
    """Données du plan envoyées au navigateur."""
    return {
        'pieces': [{'id': k, 'nom': NOMS.get(k, k), 'polygone': v} for k, v in PIECES.items()],
        'balcon': [r['polygon'] for r in PLAN['rooms'] if r['id'] == 'BALCONY'][0],
        'murs': PLAN['walls_raw'],
        'ouvertures': PLAN['openings'],
        'placards': PLAN['closets'],
        'equipements': [f for f in PLAN['fixtures'] if 'polygon' in f and f['id'] not in ('SHAFT',)],
        'fixes': {k: [{'nom': n, 'polygone': p} for n, p in v] for k, v in FIXES.items()},
        'portes': PORTES,
        'plinthes': PLINTHES,
        'entrees': ENTREES,
        'drapeaux': PLAN['flags'],
    }
