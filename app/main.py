"""API de l'application d'aménagement (FastAPI)."""
import json
import os
import sqlite3
import time
import uuid
from contextlib import closing
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from . import rules

HERE = Path(__file__).parent
DB_PATH = os.environ.get('DB_PATH', str(HERE.parent / 'donnees' / 'plans.db'))
MAX_PLACEMENTS = 200

app = FastAPI(title="Aménagement – 1400 rue Desgagné", docs_url='/api/docs', openapi_url='/api/openapi.json')


# ---------------------------------------------------------------- modèles
class Placement(BaseModel):
    uid: str = Field(max_length=64)
    item: str = Field(max_length=64)
    x: float = Field(ge=-100, le=500)
    y: float = Field(ge=-100, le=500)
    rot: int = 0
    w: Optional[float] = Field(default=None, gt=0, le=200)
    d: Optional[float] = Field(default=None, gt=0, le=200)

    @field_validator('rot')
    @classmethod
    def rot_valide(cls, v):
        if v % 90 != 0:
            raise ValueError('rotation par pas de 90°')
        return v % 360

class NouveauMeuble(BaseModel):
    nom: str = Field(min_length=1, max_length=60)
    w: float = Field(ge=2, le=200, description='largeur (côté avant), en pouces')
    d: float = Field(ge=1, le=200, description='profondeur, en pouces')
    type: str = Field(default='sol', pattern='^(sol|mural)$')
    acces: bool = True
    quantite: int = Field(default=1, ge=1, le=10)

    @field_validator('nom')
    @classmethod
    def nom_propre(cls, v):
        v = ' '.join(v.split())
        if not v:
            raise ValueError('nom vide')
        return v


class Parametres(BaseModel):
    passage: float = Field(default=36, ge=24, le=60)
    cercle: float = Field(default=48, ge=24, le=72)
    plinthe: float = Field(default=12, ge=0, le=48)
    cote_lit: float = Field(default=36, ge=12, le=60)


class Plan(BaseModel):
    nom: str = Field(min_length=1, max_length=80)
    placements: list[Placement] = Field(max_length=MAX_PLACEMENTS)


class Verification(BaseModel):
    placements: list[Placement] = Field(max_length=MAX_PLACEMENTS)
    parametres: Parametres = Parametres()


# ---------------------------------------------------------------- base de données
def db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with closing(db()) as c, c:
        c.execute('CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, nom TEXT NOT NULL, placements TEXT NOT NULL, '
                  'cree REAL NOT NULL, modifie REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS meubles (id TEXT PRIMARY KEY, nom TEXT NOT NULL, w REAL NOT NULL, d REAL NOT NULL, '
                  'type TEXT NOT NULL, acces INTEGER NOT NULL, quantite INTEGER NOT NULL, cree REAL NOT NULL)')
        if c.execute('SELECT COUNT(*) FROM plans').fetchone()[0] == 0:
            for p in json.loads((HERE / 'data' / 'plans_initiaux.json').read_text(encoding='utf-8')):
                now = time.time()
                c.execute('INSERT INTO plans VALUES (?,?,?,?,?)', (uuid.uuid4().hex, p['nom'], json.dumps(p['placements']), now, now))


@app.on_event('startup')
def startup():
    init_db()


def meubles_perso():
    with closing(db()) as c:
        rows = c.execute('SELECT * FROM meubles ORDER BY cree').fetchall()
    return [{'id': r['id'], 'nom': r['nom'], 'categorie': 'perso', 'essentiel': False, 'w': r['w'], 'd': r['d'],
             'forme': 'rect', 'type': r['type'], 'quantite': r['quantite'], 'acces': bool(r['acces']),
             'note': 'Meuble créé dans l\'application.'} for r in rows]


def catalogue_complet():
    return {**rules.CAT, **{m['id']: m for m in meubles_perso()}}


def valider_items(placements, cat):
    inconnus = sorted({p.item for p in placements if p.item not in cat})
    if inconnus:
        raise HTTPException(422, f"meuble inconnu : {', '.join(inconnus)}")


def ligne(r, avec_placements=True):
    d = {'id': r['id'], 'nom': r['nom'], 'cree': r['cree'], 'modifie': r['modifie']}
    if avec_placements:
        d['placements'] = json.loads(r['placements'])
    return d


# ---------------------------------------------------------------- routes
@app.get('/healthz')
def healthz():
    return {'ok': True}


@app.get('/readyz')
def readyz():
    with closing(db()) as c:
        c.execute('SELECT 1')
    return {'ok': True}


@app.get('/api/plan')
def get_plan():
    return rules.plan_public()


@app.get('/api/catalogue')
def get_catalogue():
    return {**rules.CATALOGUE, 'meubles': rules.CATALOGUE['meubles'] + meubles_perso()}


@app.post('/api/meubles', status_code=201)
def creer_meuble(m: NouveauMeuble):
    with closing(db()) as c, c:
        if c.execute('SELECT COUNT(*) FROM meubles').fetchone()[0] >= 100:
            raise HTTPException(409, 'trop de meubles créés (100 au maximum)')
        cle = m.nom.casefold()   # comparaison insensible à la casse, accents compris (lower() de SQLite ne gère que l'ASCII)
        noms = [r['nom'] for r in c.execute('SELECT nom FROM meubles')] + [x['nom'] for x in rules.CATALOGUE['meubles']]
        if any(n.casefold() == cle for n in noms):
            raise HTTPException(409, f'un meuble nommé « {m.nom} » existe déjà')
        mid = 'perso-' + uuid.uuid4().hex[:10]
        c.execute('INSERT INTO meubles VALUES (?,?,?,?,?,?,?,?)',
                  (mid, m.nom, round(m.w, 1), round(m.d, 1), m.type, int(m.acces), m.quantite, time.time()))
    return [x for x in meubles_perso() if x['id'] == mid][0]


@app.delete('/api/meubles/{mid}', status_code=204)
def supprimer_meuble(mid: str):
    with closing(db()) as c, c:
        if not c.execute('SELECT 1 FROM meubles WHERE id=?', (mid,)).fetchone():
            raise HTTPException(404, 'meuble introuvable (seuls les meubles créés peuvent être supprimés)')
        utilise = [r['nom'] for r in c.execute('SELECT nom, placements FROM plans')
                   if any(p.get('item') == mid for p in json.loads(r['placements']))]
        if utilise:
            raise HTTPException(409, 'meuble utilisé dans : ' + ', '.join(utilise) + '. Enlevez-le de ces plans d\'abord.')
        c.execute('DELETE FROM meubles WHERE id=?', (mid,))


@app.get('/api/plans')
def lister():
    with closing(db()) as c:
        return [ligne(r, False) for r in c.execute('SELECT * FROM plans ORDER BY modifie DESC')]


@app.get('/api/plans/{pid}')
def lire(pid: str):
    with closing(db()) as c:
        r = c.execute('SELECT * FROM plans WHERE id=?', (pid,)).fetchone()
    if not r:
        raise HTTPException(404, 'plan introuvable')
    return ligne(r)


@app.post('/api/plans', status_code=201)
def creer(p: Plan):
    valider_items(p.placements, catalogue_complet())
    pid, now = uuid.uuid4().hex, time.time()
    with closing(db()) as c, c:
        c.execute('INSERT INTO plans VALUES (?,?,?,?,?)',
                  (pid, p.nom, json.dumps([x.model_dump(exclude_none=True) for x in p.placements]), now, now))
    return lire(pid)


@app.put('/api/plans/{pid}')
def modifier(pid: str, p: Plan):
    valider_items(p.placements, catalogue_complet())
    with closing(db()) as c, c:
        n = c.execute('UPDATE plans SET nom=?, placements=?, modifie=? WHERE id=?',
                      (p.nom, json.dumps([x.model_dump(exclude_none=True) for x in p.placements]), time.time(), pid)).rowcount
    if not n:
        raise HTTPException(404, 'plan introuvable')
    return lire(pid)


@app.delete('/api/plans/{pid}', status_code=204)
def supprimer(pid: str):
    with closing(db()) as c, c:
        c.execute('DELETE FROM plans WHERE id=?', (pid,))


@app.post('/api/verifier')
def verifier(v: Verification):
    cat = catalogue_complet()
    valider_items(v.placements, cat)
    return rules.verifier([x.model_dump(exclude_none=True) for x in v.placements], v.parametres.model_dump(), cat)


@app.get('/')
def index():
    return FileResponse(HERE / 'static' / 'index.html')


app.mount('/', StaticFiles(directory=HERE / 'static'), name='static')
