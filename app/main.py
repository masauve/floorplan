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

    @field_validator('item')
    @classmethod
    def item_connu(cls, v):
        if v not in rules.CAT:
            raise ValueError(f'meuble inconnu : {v}')
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
        if c.execute('SELECT COUNT(*) FROM plans').fetchone()[0] == 0:
            for p in json.loads((HERE / 'data' / 'plans_initiaux.json').read_text(encoding='utf-8')):
                now = time.time()
                c.execute('INSERT INTO plans VALUES (?,?,?,?,?)', (uuid.uuid4().hex, p['nom'], json.dumps(p['placements']), now, now))


@app.on_event('startup')
def startup():
    init_db()


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
    return rules.CATALOGUE


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
    pid, now = uuid.uuid4().hex, time.time()
    with closing(db()) as c, c:
        c.execute('INSERT INTO plans VALUES (?,?,?,?,?)',
                  (pid, p.nom, json.dumps([x.model_dump(exclude_none=True) for x in p.placements]), now, now))
    return lire(pid)


@app.put('/api/plans/{pid}')
def modifier(pid: str, p: Plan):
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
    return rules.verifier([x.model_dump(exclude_none=True) for x in v.placements], v.parametres.model_dump())


@app.get('/')
def index():
    return FileResponse(HERE / 'static' / 'index.html')


app.mount('/', StaticFiles(directory=HERE / 'static'), name='static')
