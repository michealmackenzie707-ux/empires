import type { GameState, Civ, Unit, City, Tile, ProductionItem } from './types';
import { idx, tileAt, cityAt, isWater, formatYear } from './types';
import { UNIT_TYPES, CIV_DEFS, terrainYield, terrainDefense, techCost, availableTechs, TECHS, productionName, productionCost } from './data';
import { generateMap, mulberry32, cityRadiusOffsets } from './mapgen';

let rng = Math.random;

export function log(state: GameState, text: string, tone: 'info' | 'good' | 'bad' | 'war' = 'info') {
  state.log.push({ turn: state.turn, text, tone });
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

export function advanceYear(year: number): number {
  if (year <= -2000) return year + 40;
  if (year <= -1) return year + 20;
  if (year < 1000) return year + 20;
  return year + 10;
}

export function createGame(seed: number): GameState {
  rng = mulberry32(seed ^ 0x9e3779b9);
  const { width, height, tiles, landmass } = generateMap(seed);
  const state: GameState = {
    seed, width, height, tiles,
    civs: [], units: [], cities: [],
    turn: 1, year: -4000,
    nextUnitId: 1, nextCityId: 1,
    log: [],
    explored: new Array(width * height).fill(false),
    visible: new Array(width * height).fill(false),
    phase: 'playing',
    selectedUnitId: null, openCityId: null,
    aiThinking: false,
  };

  state.civs = CIV_DEFS.map(d => ({
    ...d, alive: true, gold: 0, techs: [], research: null, scienceStored: 0,
  }));

  // Starting positions on main landmass, spread out
  const starts: { x: number; y: number }[] = [];
  const landTiles: Tile[] = tiles.filter((t, i) =>
    landmass[i] && t.terrain !== 'mountains' && t.terrain !== 'arctic' && t.terrain !== 'desert'
  );
  let guard = 0;
  while (starts.length < state.civs.length && guard++ < 4000 && landTiles.length > 0) {
    const t = landTiles[Math.floor(rng() * landTiles.length)];
    if (starts.every(s => Math.abs(s.x - t.x) + Math.abs(s.y - t.y) >= 18)) {
      starts.push({ x: t.x, y: t.y });
    }
  }
  // fallback: relax spacing
  guard = 0;
  while (starts.length < state.civs.length && guard++ < 4000) {
    const t = tiles[Math.floor(rng() * tiles.length)];
    const i = idx(t.x, t.y, width);
    if (!landmass[i] || isWater(t)) continue;
    if (starts.every(s => Math.abs(s.x - t.x) + Math.abs(s.y - t.y) >= 8)) {
      starts.push({ x: t.x, y: t.y });
    }
  }

  starts.forEach((s, i) => {
    spawnUnit(state, 'settler', i, s.x, s.y);
    spawnUnit(state, 'warrior', i, s.x, s.y);
  });

  // AI picks initial research
  for (let i = 1; i < state.civs.length; i++) {
    state.civs[i].research = aiPickResearch(state.civs[i]);
  }

  updateFog(state);
  const firstSettler = state.units.find(u => u.civId === 0 && u.typeId === 'settler');
  state.selectedUnitId = firstSettler?.id ?? null;

  log(state, '4000 BC — your wandering tribe is ready to found its first city.', 'info');
  return state;
}

export function spawnUnit(state: GameState, typeId: string, civId: number, x: number, y: number): Unit {
  const def = UNIT_TYPES[typeId];
  const u: Unit = {
    id: state.nextUnitId++, typeId, civId, x, y,
    movesLeft: def.moves, fortified: false, fortifiedTurns: 0, skipping: false,
  };
  state.units.push(u);
  return u;
}

// ---------------- Fog of war ----------------

export function updateFog(state: GameState) {
  state.visible.fill(false);
  const mark = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
      const i = idx(nx, ny, state.width);
      state.visible[i] = true;
      state.explored[i] = true;
    }
  };
  for (const u of state.units) if (u.civId === 0) mark(u.x, u.y);
  for (const c of state.cities) if (c.civId === 0) {
    mark(c.x, c.y);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
      const i = idx(nx, ny, state.width);
      state.visible[i] = true;
      state.explored[i] = true;
    }
  }
}

// ---------------- Movement & combat ----------------

export function canEnter(state: GameState, x: number, y: number): boolean {
  const t = tileAt(state, x, y);
  if (!t || isWater(t)) return false;
  return true;
}

// BFS path within unit's remaining moves; returns path (excluding start) or null
export function findPath(state: GameState, unit: Unit, tx: number, ty: number): { x: number; y: number }[] | null {
  if (unit.x === tx && unit.y === ty) return null;
  const maxCost = Math.floor(unit.movesLeft + 1e-6);
  if (maxCost <= 0) return null;
  const w = state.width;
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const start = idx(unit.x, unit.y, w);
  dist.set(start, 0);
  const queue: number[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const cd = dist.get(cur)!;
    if (cd >= maxCost) continue;
    const cx = cur % w, cy = Math.floor(cur / w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx, ny = cy + dy;
      const t = tileAt(state, nx, ny);
      if (!t) continue;
      const ni = idx(nx, ny, w);
      if (dist.has(ni)) continue;
      // destination may hold an enemy (attack); intermediates must be enterable and free of enemies
      const isDest = nx === tx && ny === ty;
      if (!canEnter(state, nx, ny)) continue;
      if (!isDest) {
        const enemies = state.units.some(u => u.x === nx && u.y === ny && u.civId !== unit.civId);
        const enemyCity = state.cities.some(c => c.x === nx && c.y === ny && c.civId !== unit.civId);
        if (enemies || enemyCity) continue;
      }
      dist.set(ni, cd + 1);
      prev.set(ni, cur);
      queue.push(ni);
    }
  }
  const target = idx(tx, ty, w);
  if (!dist.has(target)) return null;
  const path: { x: number; y: number }[] = [];
  let cur = target;
  while (cur !== start) {
    path.unshift({ x: cur % w, y: Math.floor(cur / w) });
    cur = prev.get(cur)!;
  }
  return path;
}

export function defenseStrength(state: GameState, unit: Unit): number {
  const def = UNIT_TYPES[unit.typeId];
  let d = def.defense;
  const t = tileAt(state, unit.x, unit.y);
  if (t) d *= terrainDefense(t.terrain);
  if (t?.river) d *= 1.25;
  if (unit.fortified) d *= 1.5;
  const city = cityAt(state, unit.x, unit.y);
  if (city && city.civId === unit.civId) {
    if (city.buildings.includes('walls')) d *= 2;
  }
  return d;
}

export function attackTile(state: GameState, attacker: Unit, x: number, y: number): boolean {
  // returns true if attacker moved into the tile
  const defenders = state.units.filter(u => u.x === x && u.y === y && u.civId !== attacker.civId);
  if (defenders.length > 0) {
    // strongest defender fights
    let best = defenders[0];
    let bestD = -1;
    for (const d of defenders) {
      const s = defenseStrength(state, d);
      if (s > bestD) { bestD = s; best = d; }
    }
    const a = Math.max(0.5, UNIT_TYPES[attacker.typeId].attack);
    const d = Math.max(0.5, bestD);
    const aWins = rng() * (a + d) < a;
    attacker.movesLeft = 0;
    const isVisibleToPlayer = state.visible[idx(x, y, state.width)];
    if (aWins) {
      killUnit(state, best);
      const stillDef = state.units.some(u => u.x === x && u.y === y && u.civId !== attacker.civId);
      if (isVisibleToPlayer || attacker.civId === 0) {
        log(state, `${civName(state, attacker.civId)} ${UNIT_TYPES[attacker.typeId].name} destroy ${civName(state, best.civId)} ${UNIT_TYPES[best.typeId].name}.`, attacker.civId === 0 ? 'good' : 'war');
      }
      if (!stillDef) {
        attacker.x = x; attacker.y = y;
        tryCaptureCity(state, attacker, x, y);
        return true;
      }
      return false;
    } else {
      if (isVisibleToPlayer || attacker.civId === 0) {
        log(state, `${civName(state, attacker.civId)} ${UNIT_TYPES[attacker.typeId].name} destroyed by ${civName(state, best.civId)} ${UNIT_TYPES[best.typeId].name}.`, attacker.civId === 0 ? 'bad' : 'war');
      }
      killUnit(state, attacker);
      return false;
    }
  }
  // no defenders: walk in, maybe capture city
  attacker.x = x; attacker.y = y;
  attacker.movesLeft = Math.max(0, attacker.movesLeft - 1);
  attacker.fortified = false;
  tryCaptureCity(state, attacker, x, y);
  return true;
}

export function tryCaptureCity(state: GameState, unit: Unit, x: number, y: number) {  const city = cityAt(state, x, y);
  if (!city || city.civId === unit.civId) return;
  const defendersLeft = state.units.some(u => u.x === x && u.y === y && u.civId === city.civId);
  if (defendersLeft) return;
  const oldCiv = city.civId;
  city.civId = unit.civId;
  city.size = Math.max(1, city.size - 1);
  city.foodStored = 0;
  city.shieldsStored = 0;
  city.production = null;
  // plunder
  const gold = Math.floor(rng() * 50) + 10;
  state.civs[unit.civId].gold += gold;
  if (state.civs[oldCiv]) state.civs[oldCiv].gold = Math.max(0, state.civs[oldCiv].gold - gold);
  log(state, `${civName(state, unit.civId)} forces capture ${city.name} from ${civPlural(state, oldCiv)}! (+${gold} gold)`, unit.civId === 0 ? 'good' : oldCiv === 0 ? 'bad' : 'war');
  // learn a tech sometimes (classic flavor)
  const victim = state.civs[oldCiv];
  const victor = state.civs[unit.civId];
  const stealable = victim.techs.filter(t => !victor.techs.includes(t));
  if (stealable.length > 0 && rng() < 0.5) {
    const t = stealable[Math.floor(rng() * stealable.length)];
    victor.techs.push(t);
    if (unit.civId === 0) log(state, `Your scribes study captured scrolls: you have learned ${TECHS[t].name}!`, 'good');
  }
  checkElimination(state, oldCiv);
  updateFog(state);
}

export function killUnit(state: GameState, unit: Unit) {
  const i = state.units.indexOf(unit);
  if (i >= 0) state.units.splice(i, 1);
  if (state.selectedUnitId === unit.id) state.selectedUnitId = null;
  if (unit.civId !== 0) checkElimination(state, unit.civId);
  else checkPlayerDefeat(state);
}

export function checkElimination(state: GameState, civId: number) {
  const civ = state.civs[civId];
  if (!civ || !civ.alive) return;
  const hasCity = state.cities.some(c => c.civId === civId);
  const hasUnits = state.units.some(u => u.civId === civId);
  if (!hasCity && !hasUnits) {
    civ.alive = false;
    civ.eliminated = true;
    log(state, `The ${civ.name} has been destroyed!`, civId === 0 ? 'bad' : 'good');
    if (civId !== 0) {
      const rivalsLeft = state.civs.filter(c => c.alive && !c.isPlayer).length;
      if (rivalsLeft === 0 && state.civs[0].alive) {
        state.phase = 'victory';
      }
    }
  }
}

export function checkPlayerDefeat(state: GameState) {
  const hasCity = state.cities.some(c => c.civId === 0);
  const hasUnits = state.units.some(u => u.civId === 0);
  if (!hasCity && !hasUnits && state.phase === 'playing') {
    state.civs[0].alive = false;
    state.phase = 'defeat';
  }
}

export function civName(state: GameState, civId: number): string {
  // possessive adjective form: "Your" / "Egyptian"
  const c = state.civs[civId];
  if (!c) return 'Unknown';
  return c.isPlayer ? 'Your' : c.name.split(' ')[0];
}

export function civPlural(state: GameState, civId: number): string {
  // noun form: "you" / "the Egyptians"
  const c = state.civs[civId];
  if (!c) return 'unknown';
  return c.isPlayer ? 'you' : `the ${c.name.split(' ')[0]}s`;
}

export function moveUnitAlong(state: GameState, unit: Unit, path: { x: number; y: number }[]): boolean {
  for (const step of path) {
    if (unit.movesLeft <= 0) return false;
    const hasEnemy = state.units.some(u => u !== unit && u.x === step.x && u.y === step.y && u.civId !== unit.civId)
      || state.cities.some(c => c.x === step.x && c.y === step.y && c.civId !== unit.civId);
    if (hasEnemy) {
      const entered = attackTile(state, unit, step.x, step.y);
      if (!state.units.includes(unit)) return false; // died
      if (!entered) return true;
      continue;
    }
    unit.x = step.x; unit.y = step.y;
    unit.movesLeft = Math.max(0, unit.movesLeft - 1);
    unit.fortified = false;
    unit.skipping = false;
  }
  if (unit.civId === 0) updateFog(state);
  return true;
}

export function foundCity(state: GameState, unit: Unit): boolean {
  const def = UNIT_TYPES[unit.typeId];
  if (!def.isSettler) return false;
  const t = tileAt(state, unit.x, unit.y);
  if (!t || isWater(t)) return false;
  if (cityAt(state, unit.x, unit.y)) return false;
  // not too close to another city
  for (const c of state.cities) {
    if (Math.abs(c.x - unit.x) <= 2 && Math.abs(c.y - unit.y) <= 2) return false;
  }
  const civ = state.civs[unit.civId];
  const usedNames = new Set(state.cities.map(c => c.name));
  const name = civ.cityNames.find(n => !usedNames.has(n)) ?? `${civ.name.split(' ')[0]} ${state.nextCityId}`;
  const city: City = {
    id: state.nextCityId++, name, civId: unit.civId,
    x: unit.x, y: unit.y, size: 1,
    foodStored: 0, shieldsStored: 0,
    production: { kind: 'unit', id: 'warrior' },
    buildings: [],
  };
  state.cities.push(city);
  killUnit(state, unit);
  if (city.civId === 0) {
    log(state, `${name} founded! The ${civ.name} rises.`, 'good');
    updateFog(state);
  }
  return true;
}

// ---------------- City economics ----------------

export interface CityYields { food: number; shields: number; trade: number; science: number; gold: number; surplus: number; }

export function cityYields(state: GameState, city: City): CityYields {
  const offs = cityRadiusOffsets();
  // collect workable tiles, sort by value, assign one per citizen
  const options: { food: number; shields: number; trade: number; score: number }[] = [];
  for (const [dx, dy] of offs) {
    const t = tileAt(state, city.x + dx, city.y + dy);
    if (!t) continue;
    if (dx === 0 && dy === 0) {
      const base = terrainYield(t.terrain, t.river);
      options.push({
        food: Math.max(2, base.food), shields: Math.max(1, base.shields),
        trade: base.trade + 1, score: 1e9, // center always worked, seat of government
      });
      continue;
    }
    const y = terrainYield(t.terrain, t.river);
    options.push({ ...y, score: y.food * 3 + y.shields * 2 + y.trade });
  }
  options.sort((a, b) => b.score - a.score);
  const worked = options.slice(0, city.size + 1); // center + one tile per citizen
  let food = 0, shields = 0, trade = 0;
  for (const w of worked) { food += w.food; shields += w.shields; trade += w.trade; }
  const consumed = city.size * 2;
  let science = Math.ceil(trade * 0.5);
  let gold = trade - Math.floor(trade * 0.5);
  if (city.buildings.includes('library')) science = Math.floor(science * 1.5);
  if (city.buildings.includes('marketplace')) gold = Math.floor(gold * 1.5);
  return { food, shields, trade, science, gold, surplus: food - consumed };
}

export function foodBox(city: City): number {
  const box = (city.size + 1) * 10;
  return city.buildings.includes('granary') ? Math.ceil(box / 2) : box;
}

export function rushCost(_state: GameState, city: City): number | null {
  if (!city.production) return null;
  const remaining = productionCost(city.production) - city.shieldsStored;
  if (remaining <= 0) return null;
  return remaining * (city.shieldsStored === 0 ? 3 : 2);
}

export function processCity(state: GameState, city: City) {
  const civ = state.civs[city.civId];
  const y = cityYields(state, city);

  // growth
  city.foodStored += y.surplus;
  const box = foodBox(city);
  if (city.foodStored >= box) {
    city.size += 1;
    city.foodStored -= box;
    if (city.civId === 0) log(state, `${city.name} grows to size ${city.size}.`, 'good');
  } else if (city.foodStored < 0) {
    if (city.size > 1) {
      city.size -= 1;
      city.foodStored = 0;
      if (city.civId === 0) log(state, `Famine strikes ${city.name}!`, 'bad');
    } else city.foodStored = 0;
  }

  // production
  if (city.production) {
    city.shieldsStored += y.shields;
    const cost = productionCost(city.production);
    if (city.shieldsStored >= cost) {
      city.shieldsStored -= cost;
      completeProduction(state, city, city.production);
      city.production = defaultProduction(state, city);
    }
  } else {
    city.production = defaultProduction(state, city);
  }

  // economy
  civ.gold += y.gold;
  civ.scienceStored += y.science;

  // barracks healing
  if (city.buildings.includes('barracks')) {
    for (const u of state.units) {
      if (u.civId === city.civId && u.x === city.x && u.y === city.y) {
        u.movesLeft = UNIT_TYPES[u.typeId].moves;
      }
    }
  }
}

export function completeProduction(state: GameState, city: City, item: ProductionItem) {
  if (item.kind === 'unit') {
    const u = spawnUnit(state, item.id, city.civId, city.x, city.y);
    u.movesLeft = 0;
    if (city.civId === 0) log(state, `${city.name}: ${UNIT_TYPES[item.id].name} built.`, 'good');
  } else {
    city.buildings.push(item.id);
    if (city.civId === 0) log(state, `${city.name}: ${item.id === 'walls' ? 'City Walls' : item.id.charAt(0).toUpperCase() + item.id.slice(1)} completed.`, 'good');
  }
}

export function defaultProduction(state: GameState, city: City): ProductionItem {
  const civ = state.civs[city.civId];
  const known = civ.techs;
  // keep a defender
  const defenders = state.units.filter(u => u.civId === city.civId && u.x === city.x && u.y === city.y && !UNIT_TYPES[u.typeId].isSettler);
  if (defenders.length === 0) {
    const bestDef = known.includes('bronze') ? 'phalanx' : 'warrior';
    return { kind: 'unit', id: bestDef };
  }
  if (!city.buildings.includes('granary') && known.includes('pottery') && city.size >= 2) return { kind: 'building', id: 'granary' };
  if (!city.buildings.includes('barracks') && city.size >= 2) return { kind: 'building', id: 'barracks' };
  if (!city.buildings.includes('library') && known.includes('writing')) return { kind: 'building', id: 'library' };
  if (!city.buildings.includes('marketplace') && known.includes('currency')) return { kind: 'building', id: 'marketplace' };
  if (!city.buildings.includes('walls') && known.includes('masonry') && city.size >= 4) return { kind: 'building', id: 'walls' };
  // settlers for expansion
  const myCities = state.cities.filter(c => c.civId === city.civId).length;
  const mySettlers = state.units.filter(u => u.civId === city.civId && UNIT_TYPES[u.typeId].isSettler).length;
  if (city.size >= 3 && myCities + mySettlers < 6 && rng() < 0.5) return { kind: 'unit', id: 'settler' };
  // military
  const best = known.includes('math') ? 'catapult'
    : known.includes('chivalry') ? 'knight'
    : known.includes('iron') ? 'legion'
    : known.includes('warrior_code') ? 'archer'
    : known.includes('bronze') ? 'phalanx' : 'warrior';
  return { kind: 'unit', id: best };
}

// ---------------- Research ----------------

export function processResearch(state: GameState, civ: Civ) {
  if (!civ.research) {
    civ.research = civ.isPlayer ? null : aiPickResearch(civ);
    if (!civ.research) { civ.scienceStored = 0; return; }
  }
  const cost = techCost(civ.techs.length);
  if (civ.scienceStored >= cost) {
    civ.scienceStored -= cost;
    civ.techs.push(civ.research);
    const name = TECHS[civ.research].name;
    if (civ.isPlayer) {
      log(state, `You have discovered ${name}!`, 'good');
      civ.research = null;
      state.phase = 'choose-research';
    } else {
      civ.research = aiPickResearch(civ);
    }
  }
}

export function aiPickResearch(civ: Civ): string | null {
  const avail = availableTechs(civ.techs);
  if (avail.length === 0) return null;
  const priority = ['bronze', 'iron', 'wheel', 'chivalry', 'math', 'warrior_code', 'pottery', 'masonry', 'writing', 'currency'];
  for (const p of priority) {
    const found = avail.find(t => t.id === p);
    if (found) return found.id;
  }
  return avail[0].id;
}

// ---------------- Turn processing ----------------

import { runAI } from './ai';

export function endTurn(state: GameState) {
  state.aiThinking = true;
  state.selectedUnitId = null;

  // AI civs act
  for (let i = 1; i < state.civs.length; i++) {
    if (state.civs[i].alive) runAI(state, i);
  }

  // all cities produce, research advances
  for (const city of [...state.cities]) processCity(state, city);
  for (const civ of state.civs) if (civ.alive) processResearch(state, civ);

  // reset player units
  for (const u of state.units) {
    const def = UNIT_TYPES[u.typeId];
    u.movesLeft = def.moves;
    if (u.fortified) u.fortifiedTurns++;
    u.skipping = false;
  }

  state.turn += 1;
  state.year = advanceYear(state.year);
  updateFog(state);
  state.aiThinking = false;

  checkPlayerDefeat(state);
  // score limit ending
  if (state.turn > 250 && state.phase === 'playing') {
    const playerScore = score(state, 0);
    const best = Math.max(...state.civs.map((_, i) => score(state, i)));
    state.phase = playerScore >= best ? 'victory' : 'defeat';
  }

  // auto-select first unit with moves
  if (state.phase === 'playing') selectNextUnit(state);
  if (state.phase === 'choose-research') void 0;
}

export function selectNextUnit(state: GameState): Unit | null {
  const candidates = state.units.filter(u => u.civId === 0 && u.movesLeft > 0 && !u.fortified && !u.skipping);
  const next = candidates[0] ?? null;
  state.selectedUnitId = next?.id ?? null;
  return next;
}

export function score(state: GameState, civId: number): number {
  let s = 0;
  for (const c of state.cities) if (c.civId === civId) s += c.size * 2 + c.buildings.length * 3;
  s += state.civs[civId].techs.length * 5;
  s += state.units.filter(u => u.civId === civId).length;
  return s;
}

export { formatYear, productionName };
