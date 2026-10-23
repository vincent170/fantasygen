# 🏰 Fantasy City Builder

A browser-based, Cities&nbsp;Skylines-style city builder. Sculpt your own terrain, then grow a city of up to
**25,000 citizens** in five architectural styles — **Colonial, Georgian, Southern, American and Modern** —
with zoning, roads, power & water, traffic, public services, laws and special industries.

No build step, no dependencies to install: it is a static site (vanilla ES modules + a vendored copy of
[Three.js](https://threejs.org/)), so it hosts perfectly on **GitHub Pages**.

---

## ▶ Run it

**Locally** (ES modules need a web server, `file://` will not work):

```bash
cd FantasyMapGen
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

**On GitHub Pages**

1. Create a repository and push this folder to it (the folder contents — `index.html`, `js/`, `css/`, `lib/` — must be the repo root).
   ```bash
   cd FantasyMapGen
   git init && git add . && git commit -m "Fantasy City Builder"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Build and deployment → Source: _Deploy from a branch_ → `main` / `(root)`** → Save.
   (Alternatively choose **GitHub Actions** — `.github/workflows/pages.yml` is included.)
3. After a minute your game is live at `https://<you>.github.io/<repo>/`.

> Requires a WebGL-capable browser. A dedicated GPU is recommended for large cities; the game lowers its own graphics
> quality automatically if the frame rate is poor (Menu → Graphics quality).

---

## ✨ What's inside

### Terrain
Raise / lower / smooth / flatten land, flood it into **sea & lakes**, carve meandering **rivers**, refill land, plant or clear
**forests**, paint **parks**. Or generate a map: *Coastal Bay, River Valley, Island, Lakeland, River Delta, Highlands,
Archipelago, Open Plains* or a *Blank Canvas*. Roads cross water automatically as **bridges**.

### Five architectural styles
Every zone tile remembers the style it was painted with, so an old **Colonial** harbour can sit beside a **Modern** glass downtown.
Houses, apartments, shops, offices and factories are procedurally modelled for each style and for three growth levels,
with randomised palettes, so no two streets look the same. Civic buildings (schools, hospitals, town hall, churches…) use the
active style too. Open **`gallery.html`** to inspect every model (day & night).

### Zoning & building
Paint **Residential / Commercial / Industrial** (low & high density) or **hand-place** specific lot types from the *Buildings* tab.
Buildings appear where roads, power and water reach, level up with land value and services, and are abandoned if neglected.

### Infrastructure
Dirt lanes, streets, avenues, tree-lined boulevards, highways and railways · power plants (wind, coal, solar, hydro), power-line
pylons · water pumps, wells & sewage treatment · bus stops, depots, train stations · live **traffic simulation** with congestion,
buses, trains, service vehicles and pedestrians.

### Public services
Schools → university, clinics → hospitals, police stations / HQ / courthouse / prison, fire stations / HQ, landfill, incinerator and
recycling. Coverage radius, capacity and budget all matter; fires spread and crime happens.

### Laws
Eighteen laws (curfew, smoking ban, rent control, clean air act, prohibition, heritage protection, gambling licences …) enacted from
the Town Hall. Laws are only as effective as your **enforcement** (police coverage, budget, courthouse).

### Special industries
Farms, lumber mills (that fell your forests!), fishing harbours, quarries, container ports (with ships), distilleries, textile mills,
oil refineries, tech campuses, resorts and casinos — each with terrain requirements, supply-chain bonuses and adoptable policies.

### Simulation
RCI demand, taxes & per-service budgets, loans, happiness breakdown, education, health, pollution, noise, crime, land value,
waste, power/water/sewage networks, tourism, milestones, day/night cycle with lit windows, overlays for everything, statistics,
autosave + manual save/load + file export/import. Population is capped at **25,000**.

---

## 🎮 Controls

| | |
|---|---|
| **W A S D / arrows** | pan (Shift = faster) |
| **Q / E** | rotate |
| **Mouse wheel** | zoom to cursor |
| **Right-drag** | orbit & tilt |
| **Middle-drag / Space + drag** | pan |
| **Left-click / drag** | use the selected tool (click a building with no tool to inspect it) |
| **R** | rotate a building · flip the bend of a road |
| **Shift** (while drawing roads) | straight line |
| **1 2 3 / P** | speed / pause |
| **O / G / B / Esc** | cycle overlays / toggle grid / bulldoze / cancel |

**Getting started:** shape the land → place a wind turbine (or coal plant) and a water pump (shore) or well → connect them with roads →
pick a style and zone land beside the roads → add schools, clinics, police and fire stations → build a Town Hall for laws →
unlock more as you grow.

---

## 🗂 Project layout

```
index.html            game entry
gallery.html          architecture gallery (all buildings, day/night)
css/style.css         UI theme
lib/three.module.js   vendored Three.js r160 (MIT)
js/
  main.js             boot, game loop, new/load game
  world.js            heightmap, tile layers, terrain generation & terraforming
  data.js             styles, roads, buildings, industries, laws, milestones
  sim.js              economy, growth, utilities, services, happiness, events
  traffic.js          A* pathfinding, vehicles, trains, ships, pedestrians
  view.js             terrain, water, roads, chunked buildings, trees, sky, FX
  ground.js           procedural terrain texture painter
  atlas.js            procedural road / facade / roof texture atlas
  kit.js, build_*.js, architect.js   procedural building generators
  tools.js, ui.js, camctl.js         input, interface, camera
```

Everything is data-driven: tweak costs, unlocks, laws and industries in `js/data.js`.
