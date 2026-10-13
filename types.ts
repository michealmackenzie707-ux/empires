export type TerrainType =
  | 'ocean' | 'coast' | 'grassland' | 'plains' | 'desert'
  | 'forest' | 'hills' | 'mountains' | 'tundra' | 'arctic';

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  river: boolean;
}

export interface UnitTypeDef {
  id: string;
  name: string;
  glyph: string;
  attack: number;
  defense: number;
  moves: number;
  cost: number; // shields
  requiresTech?: string;
  isSettler?: boolean;
}

export interface BuildingDef {
  id: string;
  name: string;
  cost: number;
  requiresTech?: string;
  desc: string;
}

export interface TechDef {
  id: string;
  name: string;
  prereqs: string[];
  desc: string;
}

export interface Unit {
  id: number;
  typeId: string;
  civId: number;
  x: number;
  y: number;
  movesLeft: number;
  fortified: boolean;
  fortifiedTurns: number;
  skipping: boolean;
}

export interface City {
  id: number;
  name: string;
  civId: number;
  x: number;
  y: number;
  size: number;
  foodStored: number;
  shieldsStored: number;
  production: ProductionItem | null;
  buildings: string[]; // building ids
}

export interface ProductionItem {
  kind: 'unit' | 'building';
  id: string;
}

export interface CivDef {
  id: string;
  name: string;
  leader: string;
  color: string;
  colorDim: string;
  cityNames: string[];
  isPlayer: boolean;
}

export interface Civ extends CivDef {
  alive: boolean;
  gold: number;
  techs: string[];
  research: string | null; // tech id
  scienceStored: number;
  eliminated?: boolean;
}

export interface LogEntry {
  turn: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'war';
}

export interface GameState {
  seed: number;
  width: number;
  height: number;
  tiles: Tile[];
  civs: Civ[];
  units: Unit[];
  cities: City[];
  turn: number;
  year: number; // negative = BC
  nextUnitId: number;
  nextCityId: number;
  log: LogEntry[];
  // player-only fog
  explored: boolean[]; // tile idx
  visible: boolean[];  // tile idx
  phase: 'title' | 'playing' | 'choose-research' | 'victory' | 'defeat';
  selectedUnitId: number | null;
  openCityId: number | null;
  aiThinking: boolean;
}

export const idx = (x: number, y: number, w: number) => y * w + x;

export function tileAt(state: GameState, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return state.tiles[idx(x, y, state.width)];
}

export function unitAt(state: GameState, x: number, y: number): Unit[] {
  return state.units.filter(u => u.x === x && u.y === y);
}

export function cityAt(state: GameState, x: number, y: number): City | null {
  return state.cities.find(c => c.x === x && c.y === y) ?? null;
}

export function isWater(t: Tile | null): boolean {
  return !!t && (t.terrain === 'ocean' || t.terrain === 'coast');
}

export function formatYear(year: number): string {
  if (year < 0) return `${-year} BC`;
  if (year === 0) return '1 AD';
  return `${year} AD`;
}
