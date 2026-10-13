import type { UnitTypeDef, BuildingDef, TechDef, CivDef, TerrainType } from './types';

export const UNIT_TYPES: Record<string, UnitTypeDef> = {
  settler:  { id: 'settler', name: 'Settlers', glyph: 'S', attack: 0, defense: 1, moves: 1, cost: 40, isSettler: true },
  warrior:  { id: 'warrior', name: 'Warriors', glyph: 'W', attack: 1, defense: 1, moves: 1, cost: 10 },
  phalanx:  { id: 'phalanx', name: 'Phalanx',  glyph: 'P', attack: 1, defense: 2, moves: 1, cost: 20, requiresTech: 'bronze' },
  archer:   { id: 'archer',  name: 'Archers',  glyph: 'A', attack: 2, defense: 2, moves: 1, cost: 30, requiresTech: 'warrior_code' },
  legion:   { id: 'legion',  name: 'Legion',   glyph: 'L', attack: 3, defense: 1, moves: 1, cost: 20, requiresTech: 'iron' },
  chariot:  { id: 'chariot', name: 'Chariot',  glyph: 'C', attack: 3, defense: 1, moves: 2, cost: 40, requiresTech: 'wheel' },
  knight:   { id: 'knight',  name: 'Knights',  glyph: 'K', attack: 4, defense: 2, moves: 2, cost: 40, requiresTech: 'chivalry' },
  catapult: { id: 'catapult',name: 'Catapult', glyph: 'T', attack: 6, defense: 1, moves: 1, cost: 40, requiresTech: 'math' },
};

export const BUILDINGS: Record<string, BuildingDef> = {
  granary:    { id: 'granary', name: 'Granary', cost: 60, requiresTech: 'pottery', desc: 'Halves food needed for city growth.' },
  barracks:   { id: 'barracks', name: 'Barracks', cost: 40, desc: 'Units in this city heal to full strength each turn.' },
  walls:      { id: 'walls', name: 'City Walls', cost: 120, requiresTech: 'masonry', desc: 'Defenders in this city fight with double strength.' },
  library:    { id: 'library', name: 'Library', cost: 80, requiresTech: 'writing', desc: '+50% science output.' },
  marketplace:{ id: 'marketplace', name: 'Marketplace', cost: 80, requiresTech: 'currency', desc: '+50% gold output.' },
};

export const TECHS: Record<string, TechDef> = {
  pottery:      { id: 'pottery', name: 'Pottery', prereqs: [], desc: 'Unlocks the Granary.' },
  bronze:       { id: 'bronze', name: 'Bronze Working', prereqs: [], desc: 'Unlocks the Phalanx.' },
  warrior_code: { id: 'warrior_code', name: 'Warrior Code', prereqs: [], desc: 'Unlocks Archers.' },
  wheel:        { id: 'wheel', name: 'The Wheel', prereqs: [], desc: 'Unlocks the Chariot.' },
  masonry:      { id: 'masonry', name: 'Masonry', prereqs: [], desc: 'Unlocks City Walls.' },
  iron:         { id: 'iron', name: 'Iron Working', prereqs: ['bronze'], desc: 'Unlocks the Legion.' },
  writing:      { id: 'writing', name: 'Writing', prereqs: ['pottery'], desc: 'Unlocks the Library.' },
  chivalry:     { id: 'chivalry', name: 'Chivalry', prereqs: ['wheel', 'warrior_code'], desc: 'Unlocks Knights.' },
  currency:     { id: 'currency', name: 'Currency', prereqs: ['writing'], desc: 'Unlocks the Marketplace.' },
  math:         { id: 'math', name: 'Mathematics', prereqs: ['wheel', 'writing'], desc: 'Unlocks the Catapult.' },
};

export const TECH_ORDER = Object.keys(TECHS);

export function techCost(knownCount: number): number {
  return 12 + knownCount * 10;
}

export function availableTechs(known: string[]): TechDef[] {
  return TECH_ORDER
    .map(id => TECHS[id])
    .filter(t => !known.includes(t.id) && t.prereqs.every(p => known.includes(p)));
}

export interface Yield { food: number; shields: number; trade: number; }

export function terrainYield(terrain: TerrainType, river: boolean): Yield {
  let y: Yield;
  switch (terrain) {
    case 'ocean':     y = { food: 1, shields: 0, trade: 2 }; break;
    case 'coast':     y = { food: 1, shields: 0, trade: 2 }; break;
    case 'grassland': y = { food: 2, shields: 0, trade: 0 }; break;
    case 'plains':    y = { food: 1, shields: 1, trade: 0 }; break;
    case 'forest':    y = { food: 1, shields: 2, trade: 0 }; break;
    case 'hills':     y = { food: 0, shields: 2, trade: 0 }; break;
    case 'mountains': y = { food: 0, shields: 1, trade: 0 }; break;
    case 'desert':    y = { food: 0, shields: 1, trade: 0 }; break;
    case 'tundra':    y = { food: 1, shields: 0, trade: 0 }; break;
    case 'arctic':    y = { food: 0, shields: 0, trade: 0 }; break;
  }
  if (river) y = { ...y, trade: y.trade + 1 };
  return y;
}

export function terrainDefense(terrain: TerrainType): number {
  switch (terrain) {
    case 'forest': return 1.5;
    case 'hills': return 2.0;
    case 'mountains': return 3.0;
    default: return 1.0;
  }
}

export const CIV_DEFS: CivDef[] = [
  {
    id: 'rome', name: 'Roman Empire', leader: 'Caesar', color: '#e03e2d', colorDim: '#7a2019',
    isPlayer: true,
    cityNames: ['Rome','Antium','Cumae','Neapolis','Ravenna','Arretium','Mediolanum','Arpinum','Circei','Setia','Satricum','Ardea','Ostia','Velitrae','Tarentum'],
  },
  {
    id: 'babylon', name: 'Babylonian Empire', leader: 'Hammurabi', color: '#4d9de0', colorDim: '#26547c',
    isPlayer: false,
    cityNames: ['Babylon','Sumer','Uruk','Nineveh','Akkad','Eridu','Kish','Lagash','Nippur','Ur','Sippar','Borsippa','Isin','Larsa','Mari'],
  },
  {
    id: 'egypt', name: 'Egyptian Empire', leader: 'Ramesses', color: '#e9b949', colorDim: '#8a6d1f',
    isPlayer: false,
    cityNames: ['Thebes','Memphis','Heliopolis','Alexandria','Elephantine','Abydos','Giza','Tanis','Hierakonpolis','Bubastis','Mendes','Edfu','Crocodilopolis','Aswan','Luxor'],
  },
  {
    id: 'aztec', name: 'Aztec Empire', leader: 'Montezuma', color: '#3fae6a', colorDim: '#1d6b3d',
    isPlayer: false,
    cityNames: ['Tenochtitlan','Teotihuacan','Tlatelolco','Texcoco','Tlaxcala','Calixtlahuaca','Xochicalco','Tula','Cholula','Malinalco','Tlacopan','Azcapotzalco'],
  },
];

export const PLAYER_CIV_INDEX = 0;

export function productionName(item: { kind: 'unit' | 'building'; id: string } | null): string {
  if (!item) return '—';
  return item.kind === 'unit' ? UNIT_TYPES[item.id].name : BUILDINGS[item.id].name;
}

export function productionCost(item: { kind: 'unit' | 'building'; id: string }): number {
  return item.kind === 'unit' ? UNIT_TYPES[item.id].cost : BUILDINGS[item.id].cost;
}

export function productionOptions(city: { buildings: string[] }, knownTechs: string[]): { kind: 'unit' | 'building'; id: string }[] {
  const out: { kind: 'unit' | 'building'; id: string }[] = [];
  for (const u of Object.values(UNIT_TYPES)) {
    if (!u.requiresTech || knownTechs.includes(u.requiresTech)) out.push({ kind: 'unit', id: u.id });
  }
  for (const b of Object.values(BUILDINGS)) {
    if (city.buildings.includes(b.id)) continue;
    if (b.requiresTech && !knownTechs.includes(b.requiresTech)) continue;
    out.push({ kind: 'building', id: b.id });
  }
  return out;
}
