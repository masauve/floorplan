"""Tests de l'API : création de meubles rectangulaires personnalisés."""
import importlib
import os
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    with tempfile.TemporaryDirectory() as d:
        os.environ['DB_PATH'] = os.path.join(d, 'plans.db')
        import app.main as main
        importlib.reload(main)
        with TestClient(main.app) as c:
            yield c


def test_creer_placer_supprimer_meuble(client):
    r = client.post('/api/meubles', json={'nom': 'Étagère  basse', 'w': 30, 'd': 12, 'type': 'sol', 'acces': True, 'quantite': 2})
    assert r.status_code == 201
    m = r.json()
    assert m['id'].startswith('perso-') and m['nom'] == 'Étagère basse' and m['categorie'] == 'perso'
    assert any(x['id'] == m['id'] for x in client.get('/api/catalogue').json()['meubles'])

    # même nom refusé
    assert client.post('/api/meubles', json={'nom': 'étagère basse', 'w': 10, 'd': 10}).status_code == 409
    # dimensions hors limites refusées
    assert client.post('/api/meubles', json={'nom': 'Trop grand', 'w': 500, 'd': 10}).status_code == 422

    # utilisable dans la vérification et les plans
    pl = [{'uid': 'a', 'item': m['id'], 'x': 300, 'y': 60, 'rot': 0}]
    res = client.post('/api/verifier', json={'placements': pl}).json()
    assert any(a['uid'] == 'a' for a in res['acces'])
    plan = client.post('/api/plans', json={'nom': 'Essai', 'placements': pl}).json()

    # suppression refusée tant qu'il est utilisé dans un plan
    r = client.delete(f"/api/meubles/{m['id']}")
    assert r.status_code == 409 and 'Essai' in r.json()['detail']
    client.delete(f"/api/plans/{plan['id']}")
    assert client.delete(f"/api/meubles/{m['id']}").status_code == 204
    assert not any(x['id'] == m['id'] for x in client.get('/api/catalogue').json()['meubles'])


def test_meuble_inconnu_refuse(client):
    r = client.post('/api/verifier', json={'placements': [{'uid': 'a', 'item': 'perso-inexistant', 'x': 0, 'y': 0}]})
    assert r.status_code == 422


def test_meubles_du_catalogue_non_supprimables(client):
    assert client.delete('/api/meubles/lit-articule').status_code == 404
