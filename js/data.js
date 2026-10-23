// Static game data: styles, roads, zones, buildings, industries, laws, milestones.

export const MAP_N = 128;
export const POP_CAP = 25000;
export const SEA_LEVEL = 0;

// ---------------------------------------------------------------- styles
export const STYLES = [
  { id: 0, key: 'colonial', name: 'Colonial', icon: '⛵', color: '#c9a063', desc: 'Clapboard & brick saltboxes, steep shingled gables, central chimneys.' },
  { id: 1, key: 'georgian', name: 'Georgian', icon: '🏛️', color: '#b4553e', desc: 'Symmetrical red brick, white sash windows, pedimented doors, hipped slate roofs.' },
  { id: 2, key: 'southern', name: 'Southern', icon: '🌿', color: '#e8e1cf', desc: 'Wide verandas, white columns, shuttered windows & wrought-iron galleries.' },
  { id: 3, key: 'american', name: 'American', icon: '🗽', color: '#6f8bb0', desc: 'Porch-front homes, Main Street storefronts, brownstones & Art Deco towers.' },
  { id: 4, key: 'modern', name: 'Modern', icon: '🏙️', color: '#4fb5d6', desc: 'Glass, steel & concrete: cubist homes, curtain-wall towers, flat roofs.' },
  { id: 5, key: 'mixed', name: 'Mixed', icon: '🎨', color: '#9a7fd1', desc: 'A random blend of every style.' },
];

// ---------------------------------------------------------------- zones
export const Z = { NONE: 0, RL: 1, RH: 2, CL: 3, CH: 4, IN: 5, PARK: 6, RM: 7, MX: 8, OF: 9 };
export const ZONE_INFO = {
  1: { key: 'RL', name: 'Residential – Low Density', short: 'Low Res', arch: 'house', cat: 'R', color: [100, 205, 95], icon: '🏡', unlock: 0 },
  7: { key: 'RM', name: 'Residential – Medium Density', short: 'Row Homes', arch: 'row', cat: 'R', color: [70, 180, 80], icon: '🏘️', unlock: 250 },
  2: { key: 'RH', name: 'Residential – High Density', short: 'High Res', arch: 'apt', cat: 'R', color: [40, 150, 70], icon: '🏢', unlock: 800 },
  8: { key: 'MX', name: 'Mixed Use (shops + flats)', short: 'Mixed', arch: 'mixed', cat: 'R', color: [80, 190, 170], icon: '🏬', unlock: 500 },
  3: { key: 'CL', name: 'Commercial – Low Density', short: 'Low Com', arch: 'shop', cat: 'C', color: [95, 155, 245], icon: '🏪', unlock: 0 },
  4: { key: 'CH', name: 'Commercial – High Density', short: 'High Com', arch: 'store', cat: 'C', color: [55, 105, 225], icon: '🛍️', unlock: 900 },
  9: { key: 'OF', name: 'Office', short: 'Office', arch: 'office', cat: 'O', color: [165, 110, 230], icon: '🏙️', unlock: 600 },
  5: { key: 'IN', name: 'Industrial', short: 'Industry', arch: 'factory', cat: 'I', color: [235, 190, 70], icon: '🏭', unlock: 0 },
  6: { key: 'PARK', name: 'Park', arch: null, cat: 'P', color: [70, 190, 90], icon: '🌳', unlock: 0 },
};
export const ZONE_ORDER = [1, 7, 2, 8, 3, 4, 9, 5];
export const isBuildZone = (z) => z > 0 && z !== Z.PARK && !!ZONE_INFO[z];
export const RES_ARCH = new Set(['house', 'row', 'apt', 'mixed']);
export const COM_ARCH = new Set(['shop', 'store']);
export const IND_ARCH = new Set(['factory', 'agri', 'forest', 'ore', 'oil']);
// Specialised industry (district policy) -> archetype + resource it needs
export const SPECIALIZATIONS = {
  agri: { name: 'Farming', icon: '🌾', res: 'fert', desc: 'Industrial zones grow farms. Needs fertile land.' },
  forest: { name: 'Forestry', icon: '🌲', res: 'forest', desc: 'Sawmills and log yards. Needs nearby forest.' },
  ore: { name: 'Ore', icon: '⛏️', res: 'ore', desc: 'Mines and processing. Needs ore deposits (depletes).' },
  oil: { name: 'Oil', icon: '🛢️', res: 'oil', desc: 'Pumpjacks and tanks. Needs oil (depletes). Very profitable.' },
};
// Allowed lot sizes [along-road, depth] with spawn weights, per archetype.
export const LOTS = {
  house: [[[1, 1], 6], [[2, 1], 3], [[2, 2], 1.5]],
  row: [[[2, 1], 4], [[3, 1], 3], [[2, 2], 2], [[3, 2], 1.5]],
  apt: [[[2, 2], 5], [[3, 2], 3], [[3, 3], 2]],
  mixed: [[[2, 1], 2], [[2, 2], 4], [[3, 2], 3], [[3, 3], 1]],
  shop: [[[1, 1], 5], [[2, 1], 3], [[2, 2], 2]],
  store: [[[3, 2], 3], [[3, 3], 3], [[2, 2], 2]],
  office: [[[2, 2], 4], [[3, 2], 3], [[3, 3], 3]],
  factory: [[[2, 2], 4], [[3, 2], 3], [[3, 3], 3], [[2, 1], 2.5]],
  agri: [[[3, 3], 3], [[3, 2], 2], [[2, 2], 1]],
  forest: [[[3, 2], 3], [[2, 2], 2]],
  ore: [[[3, 2], 3], [[3, 3], 2]],
  oil: [[[2, 2], 3], [[3, 2], 2]],
};
// per tile-floor capacities
export const ARCH_INFO = {
  house: { res: 1.7, jobs: 0, power: 0.005, water: 1, waste: 0.02, tax: 1.0 },
  row: { res: 2.4, jobs: 0, power: 0.005, water: 1, waste: 0.02, tax: 1.0 },
  apt: { res: 3.6, jobs: 0, power: 0.005, water: 1, waste: 0.02, tax: 0.9 },
  mixed: { res: 2.3, jobs: 1.7, power: 0.005, water: 1, waste: 0.025, tax: 1.0 },
  shop: { res: 0, jobs: 4.6, power: 0.004, water: 0.8, waste: 0.03, tax: 1.0 },
  store: { res: 0, jobs: 4.0, power: 0.005, water: 0.8, waste: 0.035, tax: 1.1 },
  office: { res: 0, jobs: 7.2, power: 0.004, water: 0.8, waste: 0.02, tax: 1.1 },
  factory: { res: 0, jobs: 5.2, power: 0.007, water: 1.0, waste: 0.04, tax: 0.95 },
  agri: { res: 0, jobs: 2.2, power: 0.004, water: 1.4, waste: 0.02, tax: 0.9 },
  forest: { res: 0, jobs: 3.6, power: 0.006, water: 0.8, waste: 0.03, tax: 1.0 },
  ore: { res: 0, jobs: 4.2, power: 0.008, water: 1.0, waste: 0.05, tax: 1.15 },
  oil: { res: 0, jobs: 3.4, power: 0.007, water: 0.9, waste: 0.04, tax: 1.35 },
};

// Hand-placeable lot buildings (auto-growth uses the same models)
export const LOT_COST = { house: 160, row: 220, apt: 330, mixed: 300, shop: 240, store: 360, office: 480, factory: 280 };
export const LOT_TYPES = [
  { id: 'house1', arch: 'house', level: 1, lw: 1, ld: 1, name: 'Cottage', icon: '🏡' },
  { id: 'house2', arch: 'house', level: 2, lw: 2, ld: 1, name: 'House', icon: '🏠' },
  { id: 'house3', arch: 'house', level: 3, lw: 2, ld: 2, name: 'Mansion', icon: '🏰' },
  { id: 'row1', arch: 'row', level: 1, lw: 2, ld: 1, name: 'Row Houses', icon: '🏘️' },
  { id: 'row2', arch: 'row', level: 2, lw: 3, ld: 1, name: 'Townhouse Terrace', icon: '🏘️' },
  { id: 'row3', arch: 'row', level: 3, lw: 3, ld: 2, name: 'Grand Terrace', icon: '🏘️' },
  { id: 'apt1', arch: 'apt', level: 1, lw: 2, ld: 2, name: 'Walk-up', icon: '🏢' },
  { id: 'apt2', arch: 'apt', level: 2, lw: 3, ld: 2, name: 'Apartments', icon: '🏢' },
  { id: 'apt3', arch: 'apt', level: 3, lw: 3, ld: 3, name: 'Residential Tower', icon: '🌆' },
  { id: 'mixed1', arch: 'mixed', level: 1, lw: 2, ld: 1, name: 'Shop & Flats', icon: '🏬' },
  { id: 'mixed2', arch: 'mixed', level: 2, lw: 2, ld: 2, name: 'Main Street Block', icon: '🏬' },
  { id: 'mixed3', arch: 'mixed', level: 3, lw: 3, ld: 2, name: 'Mixed-Use Tower', icon: '🏬' },
  { id: 'shop1', arch: 'shop', level: 1, lw: 1, ld: 1, name: 'Shop', icon: '🏪' },
  { id: 'shop2', arch: 'shop', level: 2, lw: 2, ld: 1, name: 'Store', icon: '🛍️' },
  { id: 'shop3', arch: 'shop', level: 3, lw: 2, ld: 2, name: 'Emporium', icon: '🏬' },
  { id: 'store1', arch: 'store', level: 1, lw: 3, ld: 2, name: 'Supermarket', icon: '🛒' },
  { id: 'store2', arch: 'store', level: 2, lw: 3, ld: 2, name: 'Hotel / Dept. Store', icon: '🏨' },
  { id: 'store3', arch: 'store', level: 3, lw: 3, ld: 3, name: 'Mall / Grand Hotel', icon: '🏩' },
  { id: 'office1', arch: 'office', level: 1, lw: 2, ld: 2, name: 'Counting House', icon: '🏛️' },
  { id: 'office2', arch: 'office', level: 2, lw: 3, ld: 2, name: 'Office Block', icon: '🏢' },
  { id: 'office3', arch: 'office', level: 3, lw: 3, ld: 3, name: 'Skyscraper', icon: '🏙️' },
  { id: 'factory1', arch: 'factory', level: 1, lw: 2, ld: 2, name: 'Workshop', icon: '🔧' },
  { id: 'factory2', arch: 'factory', level: 2, lw: 3, ld: 2, name: 'Factory', icon: '🏭' },
  { id: 'factory3', arch: 'factory', level: 3, lw: 3, ld: 3, name: 'Industrial Plant', icon: '⚙️' },
];
const LOT_ZONE = { house: 1, row: 7, apt: 2, mixed: 8, shop: 3, store: 4, office: 9, factory: 5 };
for (const l of LOT_TYPES) { l.cost = Math.round(LOT_COST[l.arch] * l.lw * l.ld * Math.pow(l.level, 1.35)); l.unlock = Math.max(ZONE_INFO[LOT_ZONE[l.arch]].unlock, l.level === 1 ? 0 : l.level === 2 ? 300 : 1800); l.cat = 'lots'; l.zone = LOT_ZONE[l.arch]; }

// ---------------------------------------------------------------- roads
export const R = { NONE: 0, LANE: 1, STREET: 2, AVENUE: 3, BOULEVARD: 4, HIGHWAY: 5, RAIL: 6 };
export const ROADS = {
  1: { key: 'lane', name: 'Dirt Lane', cost: 6, upkeep: 0.04, speed: 0.55, cap: 5, width: 0.4, frontage: true, icon: '🟫', unlock: 0, desc: 'Cheap & slow. Good for early villages.' },
  2: { key: 'street', name: 'Street', cost: 18, upkeep: 0.12, speed: 1.0, cap: 12, width: 0.62, frontage: true, icon: '🛣️', unlock: 0, desc: 'Two-lane paved street with sidewalks.' },
  3: { key: 'avenue', name: 'Avenue', cost: 45, upkeep: 0.3, speed: 1.35, cap: 26, width: 0.84, frontage: true, icon: '🛤️', unlock: 400, desc: 'Four lanes with a central median.' },
  4: { key: 'boulevard', name: 'Boulevard', cost: 70, upkeep: 0.45, speed: 1.25, cap: 24, width: 0.88, frontage: true, icon: '🌳', unlock: 1000, desc: 'Tree-lined avenue; raises land value.' },
  5: { key: 'highway', name: 'Highway', cost: 130, upkeep: 0.8, speed: 2.4, cap: 70, width: 0.96, frontage: false, icon: '🚗', unlock: 2500, desc: 'High-speed road. No building frontage. Connect to the map edge for trade.' },
  6: { key: 'rail', name: 'Railway', cost: 28, upkeep: 0.2, speed: 0, cap: 0, width: 0.5, frontage: false, icon: '🚆', unlock: 1000, desc: 'Rail line for trains. Connect two stations.' },
};
// tools under the Roads category beyond plain road types
export const ROAD_TOOLS = [
  { id: 'oneway', name: 'One-Way Street', icon: '⬆️', cost: 22, unlock: 300, desc: 'Drag in the direction traffic should flow. Doubles capacity on busy grids.' },
  { id: 'twoway', name: 'Make Two-Way', icon: '↕️', cost: 0, unlock: 300, desc: 'Drag over one-way streets to allow traffic both ways.' },
];

// ---------------------------------------------------------------- buildings (non-zone)
// cat: where it appears in toolbar
// place: 'land' | 'shore' | 'road' | 'rail'
// cov: coverage service key; radius in tiles
export const BUILDINGS = {
  // ---- education
  school_el: { name: 'Elementary School', cat: 'education', w: 2, d: 2, cost: 2500, upkeep: 180, jobs: 12, cov: 'edu', radius: 14, cap: 240, unlock: 100, styled: true, ground: 'pave', icon: '🏫', desc: 'Educates children. Raises education level and happiness.' },
  school_hi: { name: 'High School', cat: 'education', w: 3, d: 2, cost: 6500, upkeep: 420, jobs: 28, cov: 'edu', radius: 20, cap: 520, unlock: 800, styled: true, ground: 'pave', icon: '🎓', desc: 'Larger school with sports field.' },
  university: { name: 'University', cat: 'education', w: 4, d: 4, cost: 24000, upkeep: 1500, jobs: 90, cov: 'edu', radius: 30, cap: 1400, unlock: 3000, styled: true, ground: 'lawn', icon: '🏛️', desc: 'Higher education: unlocks tech jobs & boosts land value.', noise: 0 },
  library: { name: 'Library', cat: 'education', w: 2, d: 2, cost: 3500, upkeep: 200, jobs: 10, cov: 'edu', radius: 12, cap: 80, unlock: 400, styled: true, ground: 'lawn', icon: '📚', happy: 3, desc: 'Books! Small education boost, big happiness.' },
  // ---- health
  clinic: { name: 'Clinic', cat: 'health', w: 2, d: 1, cost: 2200, upkeep: 150, jobs: 10, cov: 'health', radius: 12, cap: 180, unlock: 100, styled: true, ground: 'pave', icon: '🩺', desc: 'Basic healthcare for nearby homes.' },
  hospital: { name: 'Hospital', cat: 'health', w: 3, d: 3, cost: 12000, upkeep: 950, jobs: 70, cov: 'health', radius: 26, cap: 800, unlock: 1000, styled: true, ground: 'pave', icon: '🏥', desc: 'Full hospital. Ambulances dispatched to emergencies.' },
  // ---- police
  police_st: { name: 'Police Station', cat: 'police', w: 2, d: 2, cost: 2800, upkeep: 240, jobs: 14, cov: 'police', radius: 15, cap: 1, unlock: 100, styled: true, ground: 'pave', icon: '🚓', desc: 'Patrols reduce crime and enforce laws.' },
  courthouse: { name: 'Courthouse', cat: 'police', w: 3, d: 2, cost: 7500, upkeep: 420, jobs: 28, cov: 'police', radius: 18, cap: 1, unlock: 1500, styled: true, ground: 'pave', icon: '⚖️', enforce: 0.2, fines: 1, desc: 'Prosecutes offenders. Makes laws easier to enforce.' },
  police_hq: { name: 'Police HQ', cat: 'police', w: 3, d: 3, cost: 10500, upkeep: 800, jobs: 44, cov: 'police', radius: 26, cap: 2, unlock: 2500, styled: true, ground: 'pave', icon: '🚔', enforce: 0.1, desc: 'Large police presence with helipad.' },
  prison: { name: 'Prison', cat: 'police', w: 4, d: 4, cost: 18000, upkeep: 1200, jobs: 55, cov: 'police', radius: 12, cap: 300, unlock: 3000, ground: 'pave', icon: '⛓️', prison: 300, noise: 0.3, desc: 'Holds criminals so crime stays down.' },
  // ---- fire
  fire_st: { name: 'Fire Station', cat: 'fire', w: 2, d: 2, cost: 2800, upkeep: 240, jobs: 14, cov: 'fire', radius: 16, cap: 1, unlock: 100, styled: true, ground: 'pave', icon: '🚒', desc: 'Fire engines race to blazes.' },
  fire_hq: { name: 'Fire HQ', cat: 'fire', w: 3, d: 3, cost: 9500, upkeep: 740, jobs: 36, cov: 'fire', radius: 28, cap: 2, unlock: 2500, styled: true, ground: 'pave', icon: '🧯', desc: 'Large fire service with a training tower.' },
  // ---- waste
  landfill: { name: 'Landfill', cat: 'waste', w: 3, d: 3, cost: 3000, upkeep: 120, jobs: 8, cov: 'waste', radius: 26, cap: 180, unlock: 0, ground: 'dirt', icon: '🗑️', pollute: 1.2, noise: 0.2, desc: 'Cheap, smelly waste storage. Fills up over time.', storage: 60000 },
  incinerator: { name: 'Incinerator', cat: 'waste', w: 3, d: 3, cost: 12000, upkeep: 600, jobs: 24, cov: 'waste', radius: 30, cap: 420, unlock: 500, ground: 'pave', icon: '♨️', pollute: 1.6, power: 6, noise: 0.3, desc: 'Burns waste and generates a little power.' },
  recycling: { name: 'Recycling Center', cat: 'waste', w: 3, d: 2, cost: 9000, upkeep: 500, jobs: 30, cov: 'waste', radius: 26, cap: 260, unlock: 2000, ground: 'pave', icon: '♻️', pollute: 0.3, income: 400, noise: 0.2, desc: 'Processes waste cleanly and sells materials.' },
  // ---- power
  wind: { name: 'Wind Turbine', cat: 'power', w: 1, d: 1, cost: 1200, upkeep: 35, jobs: 1, power: 2.5, unlock: 0, ground: 'lawn', icon: '🌬️', noise: 0.15, desc: 'Clean but small: 2.5 MW.' },
  coal: { name: 'Coal Power Plant', cat: 'power', w: 4, d: 3, cost: 7000, upkeep: 450, jobs: 30, power: 40, unlock: 0, ground: 'dirt', icon: '🏭', pollute: 3.2, noise: 0.5, desc: '40 MW of cheap, dirty power.' },
  solar: { name: 'Solar Farm', cat: 'power', w: 3, d: 3, cost: 8000, upkeep: 110, jobs: 4, power: 12, unlock: 600, ground: 'lawn', icon: '☀️', desc: '12 MW, zero emissions.' },
  hydro: { name: 'Hydro Dam', cat: 'power', w: 3, d: 2, cost: 14000, upkeep: 220, jobs: 12, power: 28, unlock: 2000, place: 'shore', ground: 'pave', icon: '🌊', desc: '28 MW. Must be built on the shore of a river or sea.' },
  pylon: { name: 'Power Line', cat: 'power', w: 1, d: 1, cost: 18, upkeep: 0.2, unlock: 0, place: 'pylon', icon: '🗼', desc: 'Pylons carry power across gaps of up to 3 tiles. Drag to place.' },
  // ---- water
  pump: { name: 'Water Pump', cat: 'water', w: 1, d: 1, cost: 1500, upkeep: 80, jobs: 2, water: 3000, unlock: 0, place: 'shore', ground: 'pave', icon: '💧', desc: 'Draws fresh water from a lake, river or sea. Place on the shore.' },
  well: { name: 'Water Tower & Well', cat: 'water', w: 2, d: 2, cost: 3200, upkeep: 120, jobs: 3, water: 1500, unlock: 0, ground: 'pave', icon: '🚰', desc: 'Groundwater supply that works inland.' },
  sewage: { name: 'Sewage Treatment', cat: 'water', w: 3, d: 3, cost: 5500, upkeep: 320, jobs: 14, sewage: 7000, unlock: 150, ground: 'pave', icon: '🚽', pollute: 0.5, noise: 0.1, desc: 'Treats waste water. Without it rivers become polluted.' },
  // ---- civic
  townhall: { name: 'Town Hall', cat: 'civic', w: 3, d: 3, cost: 8000, upkeep: 320, jobs: 22, unlock: 150, styled: true, ground: 'lawn', icon: '🏛️', happy: 4, civic: true, desc: 'Required to enact laws. Raises happiness around it.' },
  // ---- transit
  bus_stop: { name: 'Bus Stop', cat: 'transit', w: 1, d: 1, cost: 300, upkeep: 15, unlock: 150, place: 'road', cov: 'transit', radius: 8, icon: '🚏', desc: 'Place on a road. Reduces car trips nearby.' },
  bus_depot: { name: 'Bus Depot', cat: 'transit', w: 2, d: 2, cost: 3200, upkeep: 250, jobs: 14, unlock: 400, cov: 'transit', radius: 12, ground: 'pave', icon: '🚌', desc: 'Runs buses between stops.' },
  train_station: { name: 'Train Station', cat: 'transit', w: 3, d: 2, cost: 9000, upkeep: 500, jobs: 20, unlock: 1000, place: 'rail', cov: 'transit', radius: 16, styled: true, ground: 'pave', icon: '🚉', desc: 'Place beside a railway. Link two stations for commuter trains.' },
  // ---- parks
  fountain: { name: 'Fountain Plaza', cat: 'parks', w: 1, d: 1, cost: 600, upkeep: 20, unlock: 0, happy: 3, radius: 8, lv: 0.05, ground: 'park', icon: '⛲', desc: 'A pretty fountain.' },
  playground: { name: 'Playground', cat: 'parks', w: 2, d: 2, cost: 1200, upkeep: 40, unlock: 100, happy: 4, radius: 10, lv: 0.06, ground: 'park', icon: '🛝', desc: 'Kids love it.' },
  sports: { name: 'Sports Field', cat: 'parks', w: 3, d: 2, cost: 2600, upkeep: 80, unlock: 400, happy: 5, radius: 12, lv: 0.05, ground: 'sport', icon: '⚽', desc: 'Football & baseball.' },
  square: { name: 'Town Square', cat: 'parks', w: 3, d: 3, cost: 4200, upkeep: 100, unlock: 800, happy: 6, radius: 14, lv: 0.1, styled: true, tourism: 0.15, ground: 'plaza', icon: '🏙️', desc: 'Paved plaza with monument and gardens.' },
  garden: { name: 'Botanical Garden', cat: 'parks', w: 3, d: 3, cost: 6000, upkeep: 140, unlock: 2000, happy: 7, radius: 14, lv: 0.1, tourism: 0.3, ground: 'park', icon: '🌺', desc: 'Glass conservatory & flower beds. Draws tourists.' },
  // ---- landmarks
  church: { name: 'Church', cat: 'landmarks', w: 2, d: 3, cost: 5000, upkeep: 120, jobs: 4, unlock: 800, styled: true, happy: 4, radius: 12, tourism: 0.25, ground: 'lawn', icon: '⛪', desc: 'Steeple in your chosen style.' },
  monument: { name: 'Monument', cat: 'landmarks', w: 1, d: 1, cost: 3000, upkeep: 30, unlock: 1500, styled: true, happy: 3, radius: 10, tourism: 0.2, ground: 'plaza', icon: '🗿', desc: 'Obelisk or statue.' },
  lighthouse: { name: 'Lighthouse', cat: 'landmarks', w: 1, d: 1, cost: 5200, upkeep: 40, unlock: 1500, place: 'shore', happy: 2, radius: 12, tourism: 0.35, ground: 'rock', icon: '🗼', desc: 'Guides ships; draws tourists. Build on the coast.' },
  museum: { name: 'Museum', cat: 'landmarks', w: 3, d: 3, cost: 13000, upkeep: 400, jobs: 20, unlock: 3500, styled: true, happy: 4, radius: 14, tourism: 0.6, ground: 'plaza', icon: '🖼️', desc: 'Culture & tourism.' },
  stadium: { name: 'Stadium', cat: 'landmarks', w: 5, d: 4, cost: 32000, upkeep: 1200, jobs: 40, unlock: 6000, happy: 6, radius: 20, tourism: 0.9, noise: 0.6, ground: 'pave', icon: '🏟️', desc: 'Home team glory. Huge tourism but noisy.' },
  capitol: { name: 'Capitol Building', cat: 'landmarks', w: 4, d: 4, cost: 48000, upkeep: 1500, jobs: 60, unlock: 12000, styled: true, happy: 8, radius: 22, tourism: 1.2, civic: true, ground: 'lawn', icon: '🏛️', desc: 'The crown of your city.' },
  cathedral: { name: 'Cathedral', cat: 'landmarks', w: 3, d: 4, cost: 26000, upkeep: 500, jobs: 12, unlock: 7000, styled: true, happy: 6, radius: 18, tourism: 0.9, ground: 'plaza', icon: '⛪', desc: 'Soaring spires and rose windows.' },
  opera: { name: 'Opera House', cat: 'landmarks', w: 4, d: 3, cost: 34000, upkeep: 900, jobs: 40, unlock: 9000, styled: true, happy: 6, radius: 18, tourism: 1.0, ground: 'plaza', icon: '🎭', desc: 'Culture for the discerning citizen.' },
  arch: { name: 'Triumphal Arch', cat: 'landmarks', w: 2, d: 1, cost: 9000, upkeep: 60, unlock: 4000, happy: 4, radius: 12, tourism: 0.5, ground: 'plaza', icon: '🏛️', desc: 'A monumental gateway.' },
  observatory: { name: 'Observatory', cat: 'landmarks', w: 2, d: 2, cost: 15000, upkeep: 350, jobs: 10, unlock: 5000, happy: 3, radius: 12, tourism: 0.5, ground: 'lawn', icon: '🔭', cov: 'edu', cap: 60, desc: 'Stargazing. A little education, a lot of wonder.' },
  // ---- parks & recreation (more)
  plaza: { name: 'Paved Plaza', cat: 'parks', w: 2, d: 2, cost: 1500, upkeep: 40, unlock: 200, happy: 3, radius: 9, lv: 0.06, ground: 'plaza', icon: '🟫', desc: 'Benches, planters and a lamp or two.' },
  dog_park: { name: 'Dog Park', cat: 'parks', w: 2, d: 2, cost: 1400, upkeep: 40, unlock: 250, happy: 4, radius: 10, lv: 0.05, ground: 'park', icon: '🐕', desc: 'Fenced run for happy dogs.' },
  skate_park: { name: 'Skate Park', cat: 'parks', w: 2, d: 2, cost: 1800, upkeep: 50, unlock: 600, happy: 4, radius: 10, lv: 0.03, noise: 0.15, ground: 'pave', icon: '🛹', desc: 'Ramps and bowls.' },
  pond_park: { name: 'Pond Park', cat: 'parks', w: 3, d: 3, cost: 3600, upkeep: 90, unlock: 700, happy: 6, radius: 13, lv: 0.12, ground: 'park', icon: '🦆', desc: 'A pond with ducks, paths and a gazebo.' },
  zoo: { name: 'Zoo', cat: 'parks', w: 4, d: 4, cost: 16000, upkeep: 600, jobs: 30, unlock: 3500, happy: 7, radius: 18, lv: 0.08, tourism: 0.8, ground: 'park', icon: '🦁', desc: 'Lions, giraffes and elephants!' },
  amusement: { name: 'Amusement Park', cat: 'parks', w: 4, d: 4, cost: 22000, upkeep: 800, jobs: 40, unlock: 5000, happy: 8, radius: 18, lv: 0.05, tourism: 1.1, noise: 0.5, ground: 'plaza', icon: '🎡', desc: 'Ferris wheel, carousel and coaster.' },
  // ---- deathcare
  cemetery: { name: 'Cemetery', cat: 'health', w: 3, d: 3, cost: 4000, upkeep: 140, jobs: 6, cov: 'death', radius: 26, cap: 260, unlock: 250, ground: 'lawn', icon: '🪦', desc: 'Deathcare: hearses collect the deceased. Fills up over time.', storage: 5000 },
  crematorium: { name: 'Crematorium', cat: 'health', w: 2, d: 2, cost: 7000, upkeep: 320, jobs: 10, cov: 'death', radius: 32, cap: 600, unlock: 2000, ground: 'pave', icon: '⚱️', pollute: 0.3, desc: 'Deathcare that never fills up.' },
  // ---- communications
  post_office: { name: 'Post Office', cat: 'civic', w: 2, d: 1, cost: 2600, upkeep: 150, jobs: 10, cov: 'post', radius: 16, cap: 1, unlock: 400, styled: true, ground: 'pave', icon: '📮', desc: 'Mail service: small happiness and commerce boost.' },
  post_sort: { name: 'Post Sorting Facility', cat: 'civic', w: 3, d: 3, cost: 9000, upkeep: 520, jobs: 40, cov: 'post', radius: 32, cap: 1, unlock: 2500, ground: 'pave', icon: '📦', noise: 0.3, desc: 'Large mail hub covering a wide area.' },
  cell_tower: { name: 'Cell Tower', cat: 'civic', w: 1, d: 1, cost: 1500, upkeep: 60, jobs: 0, cov: 'tele', radius: 14, cap: 1, unlock: 600, ground: 'pave', icon: '📡', desc: 'Mobile coverage boosts offices and land value.' },
  telecom: { name: 'Telecom Center', cat: 'civic', w: 2, d: 2, cost: 8000, upkeep: 420, jobs: 20, cov: 'tele', radius: 28, cap: 1, unlock: 3000, ground: 'pave', icon: '🛰️', desc: 'Fibre & data hub: wide telecom coverage.' },
  // ---- disaster response
  shelter: { name: 'Emergency Shelter', cat: 'fire', w: 2, d: 2, cost: 4500, upkeep: 120, jobs: 4, cov: 'shelter', radius: 22, cap: 1, unlock: 1000, ground: 'pave', icon: '🛡️', desc: 'Citizens take cover here during disasters (fewer casualties).' },
  dru: { name: 'Disaster Response Unit', cat: 'fire', w: 3, d: 2, cost: 9000, upkeep: 520, jobs: 24, cov: 'dru', radius: 45, cap: 1, unlock: 2500, ground: 'pave', icon: '🚁', desc: 'Clears rubble fast and rebuilds after disasters.' },
  // ---- transit (more)
  metro: { name: 'Metro Station', cat: 'transit', w: 1, d: 1, cost: 6000, upkeep: 280, jobs: 6, cov: 'transit', radius: 14, unlock: 3000, ground: 'plaza', icon: 'Ⓜ️', desc: 'Underground rail. Link stations with the Metro Line tool.' },
  cargo_rail: { name: 'Cargo Train Terminal', cat: 'transit', w: 4, d: 2, cost: 14000, upkeep: 600, jobs: 30, unlock: 2000, place: 'rail', ground: 'pave', icon: '🚃', noise: 0.6, desc: 'Ships goods by rail: industrial demand and income up.' },
  airport: { name: 'Airport', cat: 'transit', w: 8, d: 5, cost: 60000, upkeep: 2200, jobs: 120, unlock: 8000, ground: 'pave', icon: '✈️', tourism: 1.6, noise: 1.6, desc: 'Planes bring tourists and trade. Needs lots of flat land.' },
};

// ---------------------------------------------------------------- special industries
export const INDUSTRIES = {
  farm: { name: 'Family Farm', group: 'Agriculture', w: 4, d: 4, cost: 4500, upkeep: 100, jobs: 16, revenue: 1500, unlock: 300, ground: 'farm', styled: true, icon: '🌾', desc: 'Fields, barn and silo. Needs flat land.', req: 'Flat grassland', noise: 0.05 },
  lumber: { name: 'Lumber Mill', group: 'Forestry', w: 3, d: 3, cost: 6500, upkeep: 200, jobs: 24, revenue: 2500, unlock: 800, ground: 'dirt', icon: '🪵', req: '12+ forest tiles within 8 tiles', pollute: 0.8, noise: 0.5, desc: 'Fells trees nearby and sells timber.' },
  fishing: { name: 'Fishing Harbor', group: 'Fishing', w: 3, d: 2, cost: 5000, upkeep: 120, jobs: 18, revenue: 1700, unlock: 500, place: 'shore', ground: 'pave', icon: '🎣', req: 'Coastline', desc: 'Boats and a fish market.' },
  quarry: { name: 'Quarry & Mine', group: 'Mining', w: 4, d: 4, cost: 9000, upkeep: 350, jobs: 32, revenue: 3900, unlock: 1500, ground: 'rock', icon: '⛏️', req: 'Hills nearby (8+ tiles above 2.2 m)', pollute: 2.0, noise: 1.0, desc: 'Digs stone and ore from hillsides.' },
  port: { name: 'Container Port', group: 'Trade', w: 5, d: 3, cost: 26000, upkeep: 900, jobs: 75, revenue: 9500, unlock: 3000, place: 'shore', ground: 'pave', icon: '🚢', req: 'Deep water near the shore', pollute: 1.4, noise: 1.2, desc: 'Cranes and cargo ships. Boosts every industry.' },
  distillery: { name: 'Distillery & Brewery', group: 'Craft', w: 3, d: 2, cost: 8000, upkeep: 260, jobs: 22, revenue: 2800, unlock: 2000, ground: 'pave', styled: true, icon: '🥃', req: 'Better with a Farm', pollute: 0.3, tourism: 0.3, desc: 'Bourbon, ale & tours.' },
  textile: { name: 'Textile Mill', group: 'Craft', w: 3, d: 3, cost: 9000, upkeep: 300, jobs: 42, revenue: 3400, unlock: 1500, ground: 'pave', styled: true, icon: '🧵', req: 'Better with a Farm', pollute: 0.8, noise: 0.6, desc: 'Spins cotton & wool.' },
  refinery: { name: 'Oil Refinery', group: 'Energy', w: 4, d: 4, cost: 30000, upkeep: 1200, jobs: 62, revenue: 10500, unlock: 5000, ground: 'dirt', icon: '🛢️', req: 'Needs a Port', pollute: 4.0, noise: 0.8, fire: 3, desc: 'Huge profits, huge pollution, big fire risk.' },
  tech: { name: 'Tech Campus', group: 'Technology', w: 4, d: 4, cost: 42000, upkeep: 1800, jobs: 130, revenue: 14500, unlock: 6000, ground: 'lawn', icon: '💻', req: 'Educated workforce + University', desc: 'Clean, high-paying jobs for the educated.' },
  resort: { name: 'Seaside Resort & Spa', group: 'Tourism', w: 3, d: 3, cost: 22000, upkeep: 800, jobs: 44, revenue: 6200, unlock: 3000, ground: 'plaza', styled: true, icon: '🏝️', req: 'Beach or parkland nearby', tourism: 1.0, desc: 'Luxury getaway attracting visitors.' },
  casino: { name: 'Casino & Hotel', group: 'Tourism', w: 3, d: 3, cost: 36000, upkeep: 1500, jobs: 76, revenue: 12800, unlock: 5000, ground: 'plaza', icon: '🎰', req: 'Gambling raises crime', tourism: 0.8, crime: 1.2, noise: 0.6, desc: 'Glitz, glamour and organized crime.' },
};
for (const k in INDUSTRIES) { INDUSTRIES[k].cat = 'industries'; INDUSTRIES[k].industry = true; }
Object.assign(BUILDINGS, INDUSTRIES);

export const INDUSTRY_POLICIES = {
  organic: { name: 'Organic Farming Subsidy', ind: 'farm', cost: 400, desc: 'Farm income +25%, no pollution.', mult: 0.25 },
  sustainable: { name: 'Sustainable Forestry', ind: 'lumber', cost: 300, desc: 'Lumber mills replant: forests never deplete. Income −10%.', mult: -0.1 },
  deepmine: { name: 'Deep Shaft Mining', ind: 'quarry', cost: 600, desc: 'Quarry income +40%, pollution +50%, more crime.', mult: 0.4 },
  freetrade: { name: 'Free Trade Zone', ind: 'port', cost: 800, desc: 'Port income +35% and industrial demand up.', mult: 0.35 },
  fishquota: { name: 'Fishing Quotas', ind: 'fishing', cost: 200, desc: 'Fishing income −15% but steady; tourism +.', mult: -0.15 },
  tourboard: { name: 'Tourism Board', ind: 'resort', cost: 700, desc: 'Resort, casino & landmark tourism +30%.', mult: 0.3 },
  techsub: { name: 'Tech Subsidies', ind: 'tech', cost: 900, desc: 'Tech campus income +30%.', mult: 0.3 },
  crafthub: { name: 'Artisan Guild Charter', ind: 'distillery', cost: 350, desc: 'Distilleries & textile mills +25% income.', mult: 0.25 },
};

// ---------------------------------------------------------------- laws
export const LAWS = {
  curfew: { name: 'Night Curfew', icon: '🌙', cost: 200, unlock: 400, desc: 'Citizens indoors after dark. Less crime, less nightlife.', fx: { crime: -0.22, happy: -3, incomeCom: -0.05 } },
  speed: { name: 'Speed Limits & Cameras', icon: '📸', cost: 150, unlock: 600, desc: 'Slower but safer roads; cameras raise fine income.', fx: { traffic: -0.08, happy: -1, fines: 1.0, accidents: -0.4 } },
  smoking: { name: 'Smoking Ban', icon: '🚭', cost: 100, unlock: 800, desc: 'Better public health, grumpy smokers.', fx: { health: 0.06, happy: -1, incomeCom: -0.02 } },
  recycle: { name: 'Recycling Mandate', icon: '♻️', cost: 150, unlock: 800, desc: 'Households sort their trash.', fx: { waste: -0.3, happy: -1, pollution: -0.05 } },
  cleanair: { name: 'Clean Air Act', icon: '🌫️', cost: 250, unlock: 1200, desc: 'Strict limits on emissions.', fx: { pollution: -0.4, incomeInd: -0.12, health: 0.04 } },
  noise: { name: 'Noise Ordinance', icon: '🔇', cost: 120, unlock: 1000, desc: 'Quiet hours for everyone.', fx: { noise: -0.35, incomeCom: -0.03, incomeInd: -0.04, happy: 1.5 } },
  firecode: { name: 'Fire Code', icon: '🧯', cost: 200, unlock: 1000, desc: 'Sprinklers and smoke alarms are compulsory.', fx: { fire: -0.4, incomeRes: -0.02 } },
  rent: { name: 'Rent Control', icon: '🏠', cost: 100, unlock: 1500, desc: 'Cheaper housing, thinner tax base.', fx: { incomeRes: -0.15, happy: 3, growth: 0.1 } },
  schooling: { name: 'Compulsory Education', icon: '📖', cost: 250, unlock: 1500, desc: 'Every child must attend school.', fx: { edu: 0.15, incomeInd: -0.05, incomeCom: -0.02 } },
  weapons: { name: 'Weapons Ban', icon: '🔫', cost: 180, unlock: 1500, desc: 'Fewer violent crimes.', fx: { crime: -0.15, happy: -1 } },
  prohibition: { name: 'Prohibition', icon: '🍺', cost: 220, unlock: 1000, desc: 'Ban alcohol. Healthier citizens — and a thriving black market.', fx: { health: 0.05, happy: -5, tourism: -0.3, crime: 0.08, fines: 0.8 } },
  heritage: { name: 'Heritage Protection', icon: '🏺', cost: 300, unlock: 2000, desc: 'Historic character preserved: tourists love it; growth slows.', fx: { tourism: 0.15, landValue: 0.08, growth: -0.1 } },
  safety: { name: 'Workplace Safety Act', icon: '🦺', cost: 200, unlock: 1500, desc: 'Safer factories, slightly lower margins.', fx: { fireInd: -0.3, incomeInd: -0.06, happy: 1 } },
  borders: { name: 'Open Borders', icon: '🛂', cost: 150, unlock: 1500, desc: 'Newcomers welcome. Faster growth, slightly more crime.', fx: { growth: 0.25, crime: 0.05 } },
  freebus: { name: 'Free Public Transit', icon: '🚌', cost: 600, unlock: 1500, desc: 'No fares; fewer cars on the road.', fx: { cars: -0.15, happy: 2 } },
  gambling: { name: 'Gambling Licenses', icon: '🎲', cost: 300, unlock: 4000, desc: 'Casinos earn +50% but crime rises.', fx: { casino: 0.5, crime: 0.1 } },
  anticorrupt: { name: 'Anti-Corruption Office', icon: '🔍', cost: 450, unlock: 3000, desc: 'Trims 4% off all expenses and lowers crime.', fx: { expenses: -0.04, crime: -0.05 } },
  forestprot: { name: 'Forest Protection', icon: '🌲', cost: 120, unlock: 1000, desc: 'Lumber mills may not clear woodland.', fx: { noCut: 1, tourism: 0.05, happy: 1 } },
};

// ---------------------------------------------------------------- milestones (CS-style: money + map-area permits)
export const MILESTONES = [
  { pop: 0, name: 'Little Hamlet', note: 'Roads, low-density zoning, power & water.', reward: 0, areas: 0 },
  { pop: 100, name: 'Worthy Village', note: 'Schools, clinics, police & fire stations.', reward: 5000, areas: 1 },
  { pop: 250, name: 'Tiny Town', note: 'Row homes, cemeteries, plazas & dog parks.', reward: 8000, areas: 0 },
  { pop: 500, name: 'Boom Town', note: 'Mixed use, avenues, libraries & solar.', reward: 10000, areas: 1 },
  { pop: 900, name: 'Busy Town', note: 'Offices, high density, post & cell towers.', reward: 15000, areas: 0 },
  { pop: 1500, name: 'Big Town', note: 'Hospitals, railways, shelters & laws.', reward: 20000, areas: 1 },
  { pop: 2500, name: 'Small City', note: 'Highways, universities, ports & resorts.', reward: 30000, areas: 1 },
  { pop: 4000, name: 'Big City', note: 'Metro, zoo, telecom & more landmarks.', reward: 40000, areas: 1 },
  { pop: 6500, name: 'Grand City', note: 'Amusement parks, cathedrals & refineries.', reward: 60000, areas: 2 },
  { pop: 10000, name: 'Capital City', note: 'Airport, opera house & the Capitol.', reward: 80000, areas: 2 },
  { pop: 15000, name: 'Colossal City', note: 'The whole map is yours to buy.', reward: 100000, areas: 3 },
  { pop: 20000, name: 'Metropolis', note: 'Nearly at the cap…', reward: 120000, areas: 3 },
  { pop: 25000, name: 'Megalopolis', note: 'Population cap reached. Perfect your city!', reward: 150000, areas: 0 },
];

// ---------------------------------------------------------------- districts
export const DISTRICT_COLORS = ['#e8c26a', '#6bd6a0', '#7ab8ff', '#ff8f6b', '#c792ea', '#f78fb3', '#4dd0e1', '#ffd54f', '#a1887f', '#9ccc65', '#ef5350', '#26a69a'];
export const DISTRICT_POLICIES = {
  smokedet: { name: 'Smoke Detectors', icon: '🚨', cost: 0.6, desc: 'Fire risk −40% in the district.', fx: { fire: -0.4 } },
  recycling: { name: 'Recycling Program', icon: '♻️', cost: 0.5, desc: 'District garbage −25%, +recycling income.', fx: { waste: -0.25 } },
  highrise: { name: 'High-Rise Ban', icon: '🚫', cost: 0, desc: 'Buildings cannot grow beyond level 2. Keeps the old-town skyline.', fx: { maxLevel: 2 } },
  heavy: { name: 'Heavy Traffic Ban', icon: '🚛', cost: 0, desc: 'Trucks avoid the district: less noise, slower industry.', fx: { noise: -0.25, trucks: 1 } },
  smallbiz: { name: 'Small Business Enthusiast', icon: '🧺', cost: 0, desc: 'Only small shops grow here; shops earn +15%.', fx: { smallbiz: 1 } },
  tourism: { name: 'Tourism District', icon: '📸', cost: 0.4, desc: 'Commerce +12% and more tourists; land value +.', fx: { incomeCom: 0.12, landValue: 4 } },
  greenbelt: { name: 'Green Belt', icon: '🌿', cost: 0.3, desc: 'Pollution −35%, noise −20%; industry −8%.', fx: { pollution: -0.35, noise: -0.2, incomeInd: -0.08 } },
  education: { name: 'Education Boost', icon: '🎒', cost: 1.0, desc: 'Education +15% for residents of the district.', fx: { edu: 0.15 } },
  freewifi: { name: 'Free Wi-Fi', icon: '📶', cost: 0.5, desc: 'Happiness +3, offices +8%.', fx: { happy: 3, incomeOff: 0.08 } },
  nightlife: { name: 'Nightlife', icon: '🎉', cost: 0.2, desc: 'Commerce +10% and tourism; noise and crime up.', fx: { incomeCom: 0.1, noise: 0.25, crime: 0.08 } },
  spec_agri: { name: 'Farming Industry', icon: '🌾', cost: 0, spec: 'agri', desc: 'Industrial zones in the district become farms (needs fertile land).' },
  spec_forest: { name: 'Forestry Industry', icon: '🌲', cost: 0, spec: 'forest', desc: 'Industrial zones become sawmills (needs forest).' },
  spec_ore: { name: 'Ore Industry', icon: '⛏️', cost: 0, spec: 'ore', desc: 'Industrial zones become mines (needs ore).' },
  spec_oil: { name: 'Oil Industry', icon: '🛢️', cost: 0, spec: 'oil', desc: 'Industrial zones become oil fields (needs oil).' },
};

// map areas: the 128×128 map is split into 4×4 areas of 32×32 tiles
export const AREA_N = 4;
export const AREA_SIZE = 32;
export function areaPrice(owned) { return Math.round(15000 * Math.pow(1.45, Math.max(0, owned - 4))); }

// ---------------------------------------------------------------- toolbar structure
export const CATEGORIES = [
  { id: 'terrain', name: 'Terrain', icon: '⛰️' },
  { id: 'roads', name: 'Roads', icon: '🛣️' },
  { id: 'zones', name: 'Zoning', icon: '🟩' },
  { id: 'areas', name: 'Areas', icon: '🗺️' },
  { id: 'lots', name: 'Buildings', icon: '🏠' },
  { id: 'power', name: 'Power', icon: '⚡' },
  { id: 'water', name: 'Water', icon: '💧' },
  { id: 'waste', name: 'Garbage', icon: '🗑️' },
  { id: 'health', name: 'Health', icon: '🏥' },
  { id: 'education', name: 'Education', icon: '🏫' },
  { id: 'police', name: 'Police', icon: '🚓' },
  { id: 'fire', name: 'Fire & Rescue', icon: '🚒' },
  { id: 'transit', name: 'Transport', icon: '🚌' },
  { id: 'civic', name: 'Civic & Comms', icon: '🏛️' },
  { id: 'parks', name: 'Parks', icon: '🌳' },
  { id: 'landmarks', name: 'Landmarks', icon: '🗽' },
  { id: 'industries', name: 'Industries', icon: '🏭' },
  { id: 'bulldoze', name: 'Bulldoze', icon: '🚜' },
];

export const TERRAIN_TOOLS = [
  { id: 'raise', name: 'Raise Land', icon: '⬆️', desc: 'Click-drag to build hills.' },
  { id: 'lower', name: 'Lower Land', icon: '⬇️', desc: 'Dig valleys and basins.' },
  { id: 'smooth', name: 'Smooth', icon: '〰️', desc: 'Soften rough terrain.' },
  { id: 'flatten', name: 'Flatten', icon: '➖', desc: 'Level to the height where you started.' },
  { id: 'water', name: 'Sea / Lake', icon: '🌊', desc: 'Flood the land with water.' },
  { id: 'river', name: 'River', icon: '🏞️', desc: 'Drag to carve a meandering river.' },
  { id: 'land', name: 'Fill Land', icon: '🏝️', desc: 'Turn water back into land.' },
  { id: 'forest', name: 'Plant Forest', icon: '🌲', desc: 'Paint trees.' },
  { id: 'clear', name: 'Clear Trees', icon: '🪓', desc: 'Remove trees.' },
  { id: 'park', name: 'Park', icon: '🌳', desc: 'Paint public parkland ($4/tile).' },
  { id: 'gen', name: 'Generate…', icon: '🎲', desc: 'Generate new random terrain.' },
];

export const OVERLAYS = [
  { id: 'none', name: 'Normal view' },
  { id: 'zones', name: 'Zoning' },
  { id: 'districts', name: 'Districts' },
  { id: 'areas', name: 'Map areas' },
  { id: 'resources', name: 'Natural resources' },
  { id: 'traffic', name: 'Traffic' },
  { id: 'transitlines', name: 'Public transport' },
  { id: 'power', name: 'Power grid' },
  { id: 'water', name: 'Water & sewage' },
  { id: 'pollution', name: 'Pollution' },
  { id: 'noise', name: 'Noise' },
  { id: 'crime', name: 'Crime' },
  { id: 'police', name: 'Police coverage' },
  { id: 'fire', name: 'Fire coverage' },
  { id: 'health', name: 'Healthcare' },
  { id: 'death', name: 'Deathcare' },
  { id: 'edu', name: 'Education' },
  { id: 'waste', name: 'Garbage collection' },
  { id: 'post', name: 'Post coverage' },
  { id: 'tele', name: 'Telecom coverage' },
  { id: 'shelter', name: 'Disaster shelters' },
  { id: 'happy', name: 'Happiness' },
  { id: 'landvalue', name: 'Land value' },
];
