# 🏰 Fantasy City Builder

A browser-based city builder modelled on **Cities: Skylines**. Sculpt your own terrain, then grow a city of up to
**25,000 citizens** in five architectural styles — **Colonial, Georgian, Southern, American and Modern** — with zoning,
districts, map areas, roads and one-way streets, power & water, public transport lines, public services, policies,
specialised industry, seasons, weather and disasters.

No build step, no dependencies to install: it is a static site (vanilla ES modules + a vendored copy of
[Three.js](https://threejs.org/) and its post-processing add-ons), so it hosts perfectly on **GitHub Pages**.

---

## ▶ Run it

**Locally** (ES modules need a web server, `file://` will not work):

```bash
cd FantasyMapGen
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

**On GitHub Pages**

1. Push this folder to a repository (the folder contents — `index.html`, `js/`, `css/`, `lib/` — must be the repo root).
2. In the repo: **Settings → Pages → Build and deployment → Source: _Deploy from a branch_ → `main` / `(root)`** → Save.
   (Alternatively choose **GitHub Actions** — `.github/workflows/pages.yml` is included.)
3. After a minute your game is live at `https://<you>.github.io/<repo>/`.

> Requires a WebGL 2 browser. Pick a graphics preset on the start screen or in Menu: **Low** (no shadows/effects),
> **Medium** (shadows, night bloom, anti-aliasing) or **High** (soft shadows, ambient occlusion, bloom, full resolution).
> The game steps down by itself if the frame rate stays poor.

---

## ✨ What's inside

### Graphics
Three presets · ambient occlusion · bloom on lit windows, street lights and car headlights at night · depth-based water with
shore foam · contact shadows on buildings · **seasons** (spring greens, orange autumn trees, snow-covered winters) and **weather**
(rain, thunderstorms with lightning, fog, snowfall) with three climates (Temperate, Boreal, Tropical) · day/night cycle.

### Terrain & land
Raise / lower / smooth / flatten land, seas, lakes, meandering rivers, forests and parks, or generate one of nine maps.
Every map has **natural resources** (fertile land, forests, ore, oil — see the *Natural resources* info view).
You start with the four central **map areas** and a **highway connection**; milestones grant permits to **buy more land**.

### Zoning — 8 zone types, 5 styles
Residential low / **medium (row homes)** / high, **mixed use** (shops below, flats above), commercial low / high
(supermarkets, department stores, cinemas, hotels, malls), **office**, and industrial. Each style has many house designs —
Cape Cods, saltboxes, Dutch gambrels, garrisons, thatched cottages, Regency villas, semi-detached pairs, shotguns, Creole
cottages, raised Lowcountry houses, dogtrots, Craftsman bungalows, ranches, foursquares, Second Empire mansions,
split-levels, A-frames, cantilevered and courtyard modern homes — with driveways, parked cars, mailboxes, gardens, pools,
sheds, swing sets and more. Open **`gallery.html`** to browse them.

### Districts & policies
Paint **districts**, name them and give each its own **policies** (smoke detectors, high-rise ban, heavy-traffic ban, tourism,
green belt, nightlife, free Wi-Fi…) and an **industry specialisation** — farming, forestry, ore or oil — which turns industrial
zones into farms with barns and greenhouses, sawmills, mines or oil fields (ore and oil run out!). City-wide laws work alongside.

### Transport
Lanes, streets, avenues, boulevards, highways, railways, bridges, **one-way streets**, traffic lights · **bus lines** and
**metro lines** you draw stop by stop (each with its own colour, vehicle count and ridership) · trains, cargo rail terminal,
**airport** with planes taking off and landing, ships · live traffic with congestion.

### Services
Education, health, **deathcare** (cemeteries & crematoriums with hearses), police, fire & rescue, **disaster shelters &
response units**, garbage, **post offices & sorting**, **cell towers & telecom**, parks (plazas, dog parks, skate parks, pond
parks, zoo, amusement park with a turning Ferris wheel) and landmarks (cathedral, opera house, triumphal arch, observatory …).

### Simulation
RCIO demand, taxes per zone, utility fees, service budgets, loans · happiness breakdown · education, health, pollution, noise,
crime, land value, waste · buildings level up (the info panel shows exactly what they still need) · 13 CS-style milestones
with cash rewards · **disasters** (meteor, tornado, earthquake, forest fire — or trigger them in sandbox) · **Chirper** feed
of citizen opinions · click any car, bus or pedestrian to meet the citizen and **follow** them · 23 info views · statistics
with demographics · autosave + save/load + file export/import. Population is capped at **25,000**.

---

## 🎮 Controls

| | |
|---|---|
| **W A S D / arrows** | pan (Shift = faster) |
| **Q / E** | rotate |
| **Mouse wheel** | zoom to cursor |
| **Right-drag** | orbit & tilt |
| **Middle-drag / Space + drag** | pan |
| **Left-click / drag** | use the selected tool · with no tool, click a building or a vehicle/citizen to inspect it |
| **R** | rotate a building · flip the bend of a road |
| **Shift** (while drawing roads) | straight line |
| **Enter / Esc** | finish a transport line · cancel |
| **1 2 3 / P** | speed / pause |
| **O / G / B** | cycle info views / toggle grid / bulldoze |

**Getting started:** connect a road to the highway → place a wind turbine and a water pump (shore) or well beside the road →
zone residential, commercial and industrial land → add schools, clinics, police and fire stations → build a Town Hall for laws →
draw bus lines when traffic builds up → buy more land as milestones arrive.

---

## 🗂 Project layout

```
index.html            game entry
gallery.html          architecture gallery
css/style.css         UI theme
lib/                  vendored Three.js r160 + post-processing add-ons (MIT)
js/
  main.js             boot, game loop, new/load game
  world.js            heightmap, tile layers, resources, districts, terrain generation
  data.js             styles, zones, roads, buildings, laws, district policies, milestones
  sim.js, sim_ext.js  economy, growth, services, districts, areas, transit lines, deathcare, disasters, Chirper
  weather.js          seasons, weather, precipitation
  traffic.js          pathfinding (one-way aware), vehicles, bus lines, planes, citizens
  view.js, post.js    renderer, water, roads, buildings, trees, sky, effects, graphics presets
  ground.js, atlas.js procedural terrain & facade textures
  kit.js, build_*.js, architect.js   procedural building generators
  tools.js, ui.js, camctl.js         input, interface, camera
```

Everything is data-driven: tweak costs, unlocks, policies and industries in `js/data.js`.
