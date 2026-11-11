"""Le moteur doit reproduire les valeurs validées à la main pour la proposition v3."""
import json
from pathlib import Path

from app import rules

V3 = json.loads((Path(rules.__file__).parent / 'data' / 'plans_initiaux.json').read_text(encoding='utf-8'))[0]['placements']


def test_v3_sans_probleme():
    res = rules.verifier(V3)
    bloquants = [p for p in res['problemes'] if p['type'] != 'plinthe']
    assert bloquants == []
    assert res['essentiels_manquants'] == []


def test_v3_cercles():
    res = rules.verifier(V3)
    cercles = {p['piece']: p['cercle'] for p in res['pieces']}
    assert cercles['BR_SW'] == 38.0
    assert cercles['BR_NE'] == 61.6
    assert cercles['LIVING'] == 68.0
    assert cercles['BATH'] == 51.1


def test_v3_acces_mom():
    res = rules.verifier(V3)
    acces = {a['uid']: a['accessible'] for a in res['acces']}
    assert acces['v3-08']          # recliner de Mom
    assert acces['v3-11']          # chaise de cuisine de Mom
    assert acces['v3-14']          # chaise de bureau
    assert not acces['v3-03']      # commode Mom au pied du lit : non accessible avec la marchette


def test_lit_cote_transfert():
    res = rules.verifier(V3)
    lit = res['lit'][0]
    assert lit['transfert'] == 'nord'
    assert lit['cotes'] == {'nord': 39, 'sud': 20}   # meilleure zone de 30 po de chaque côté
    assert lit['ok']


def test_chevauchement_detecte():
    pl = V3 + [{'uid': 'x', 'item': 'causeuse', 'x': 85, 'y': 59, 'rot': 0}]
    res = rules.verifier(pl)
    assert any(p['type'] == 'chevauchement' for p in res['problemes'])


def test_lit_accessible_cote_nord():
    res = rules.verifier(V3)
    lit = [a for a in res['acces'] if a['uid'] == 'v3-01'][0]
    assert lit['accessible'] and 'nord' in lit['cotes']


def test_ilot_redimensionne():
    """Un îlot agrandi par l'utilisateur est vérifié avec sa nouvelle taille."""
    pl = [dict(p) for p in V3]
    ilot = [p for p in pl if p['uid'] == 'v3-15'][0]
    assert not [p for p in rules.verifier(pl)['problemes'] if p['uid'] == 'v3-15']
    ilot['w'] = 100         # s'étend vers l'ouest (x 256.8) jusque sur la chaise de cuisine de Mom
    ilot['x'] -= (100 - 26.8) / 2
    msgs = [p['message'] for p in rules.verifier(pl)['problemes'] if p['uid'] == 'v3-15' or p.get('uid2') == 'v3-15']
    assert any('chevauche' in m for m in msgs)


# ------------------------------------------------------------------ rotation libre
import math


def test_empreinte_45_degres():
    pl = {'uid': 'r', 'item': 'fauteuil', 'x': 300, 'y': 60, 'rot': 45}
    poly = rules.empreinte(pl, rules.CAT['fauteuil'])
    for x, y in poly:
        assert math.isclose(math.hypot(x - 300, y - 60), math.hypot(15, 15), rel_tol=1e-6)
    # un coin pointe vers le sud (y minimum = centre - 21.2)
    assert math.isclose(min(y for _, y in poly), 60 - math.hypot(15, 15), rel_tol=1e-6)


def test_angles_droits_inchanges():
    pl = {'uid': 'r', 'item': 'commode-mom', 'x': 9.5, 'y': 59, 'rot': 270}
    xs = [p[0] for p in rules.empreinte(pl, rules.CAT['commode-mom'])]; ys = [p[1] for p in rules.empreinte(pl, rules.CAT['commode-mom'])]
    assert (min(xs), max(xs), min(ys), max(ys)) == (0, 19, 30.5, 87.5)


def test_contre_le_mur_diagonal():
    """Armoire 19x36 adossée au mur diagonal de la chambre NE (x − y = −2.9), devant vers le sud-est."""
    n = (1 / math.sqrt(2), -1 / math.sqrt(2))                  # normale du mur vers la pièce
    rot = math.degrees(math.atan2(-n[0], -n[1])) % 360          # le devant regarde la pièce : 315°
    cx, cy = 255 + n[0] * 10, 257.9 + n[1] * 10                 # point du mur + (profondeur/2 + 0.5)
    biais = [{'uid': 'a', 'item': 'armoire-19x36', 'x': cx, 'y': cy, 'rot': rot}]
    assert round(rot) == 315
    assert [p for p in rules.verifier(biais)['problemes'] if p['type'] in ('mur', 'fixe', 'chevauchement')] == []
    droit = [dict(biais[0], rot=0)]
    assert any(p['type'] == 'mur' for p in rules.verifier(droit)['problemes'])


def test_chevauchement_en_biais():
    a = {'uid': 'a', 'item': 'fauteuil', 'x': 300, 'y': 60, 'rot': 45}
    b = {'uid': 'b', 'item': 'fauteuil', 'x': 322, 'y': 60, 'rot': 45}    # coins qui se touchent : chevauchement
    c = {'uid': 'c', 'item': 'fauteuil', 'x': 344, 'y': 60, 'rot': 45}    # 44 po d'écart > 42.4 : libre
    assert any(p['type'] == 'chevauchement' for p in rules.verifier([a, b])['problemes'])
    assert not any(p['type'] == 'chevauchement' for p in rules.verifier([a, c])['problemes'])
