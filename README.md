# Floorplan – furniture layout editor

Web app to try furniture layouts on the floor plan of the 4½ Style D apartment (1400 rue Desgagné). The interface is in French.

- Floor plan drawn to scale (inches) from `app/data/floorplan_data.json`, extracted from the residence's PDF (1:100).
- Furniture catalog (existing pieces from `currentfurniture.csv` + suggested purchases + custom island) in `app/data/catalogue.json`.
- Drag, rotate to any angle (90° / 15° / 1° steps, typed angle, or "align with the nearest wall" for diagonal walls), nudge (arrow keys), resize custom pieces, save / open / copy layouts.
- One tab per room (bedrooms, living/kitchen, bathroom, entry): zoomed on the room, rest of the apartment faded, only that room's furniture, room panel with its pieces and measurements. All tabs edit the same layout. The ↗ button opens a room in its own browser tab; windows showing the same layout stay in sync both ways, unsaved changes included (BroadcastChannel). Address format: `#piece=BR_NE&plan=<id>`.
- Create your own rectangular pieces (name, width, depth, floor or wall-mounted, quantity, walker access). They are stored in the database, shared by everyone, and can be deleted when no saved layout uses them.
- Live checks in the browser: overlaps, walls, door swing, distance to baseboard heaters.
- Full check on the server: largest free turning circle per room (default 48 in), 36-in walker paths from each room entrance to every piece that must be reached, bed transfer side (36 in), missing essential pieces.

## Run locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt pytest httpx
.venv/bin/python -m pytest -q          # rule engine tests (values validated by hand for layout v3)
DB_PATH=./donnees/plans.db .venv/bin/uvicorn app.main:app --reload --port 8080
```

Open http://localhost:8080. The API is documented at `/api/docs`.

## Deploy on OpenShift

```bash
oc new-project floorplan
oc apply -k openshift/            # ImageStream, BuildConfig (from this GitHub repo), PVC, Deployment, Service, Route
oc logs -f bc/floorplan           # first build starts automatically
oc get route floorplan -o jsonpath='{.spec.host}'
```

Rebuild after a push: `oc start-build floorplan --follow` (the Deployment updates automatically when the image changes).

Saved layouts live in SQLite on the `floorplan-donnees` PVC (one replica, `Recreate` strategy).

## Layout of the code

| Path | Content |
|---|---|
| `app/rules.py` | Geometry and rule engine (numpy) |
| `app/main.py` | FastAPI: `/api/plan`, `/api/catalogue`, `/api/meubles`, `/api/plans`, `/api/verifier`, `/healthz`, `/readyz` |
| `app/static/` | Interface (HTML, CSS, plain JavaScript, SVG) |
| `app/data/` | Floor plan, catalog, starting layout |
| `openshift/` | Kustomize manifests |
| `tests/` | Rule engine tests |

## Coordinates and rules

Inches; origin = inside south-west corner of the south-west bedroom; x east, y north. Rotation is in degrees, clockwise on the plan; a piece's "front" faces south at 0°, west at 90°. Geometry (outline, collisions, reclining zone, bed sides, access points) is computed in each piece's own frame, so any angle works.
Defaults (editable in the app): walker path 36 in, turning circle 48 in, heater distance 12 in, bed transfer side 36 in. Recliners reserve a 64-in reclining zone in front of them.
Some plan values are estimated (±2–3 in); see `meta.source_tags` and `flags` in `floorplan_data.json`.
