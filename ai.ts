import type { GameState, Unit } from './types';
import { tileAt, cityAt, isWater, idx } from './types';
import { UNIT_TYPES, terrainYield } from './data';
import { cityRadiusOffsets } from './mapgen';
import { findPath, attackTile, foundCity, checkElimination } from './engine';

function rand() { return Math.random(); }

function chebyshev(ax: number, ay: number, bx: number, by: number) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function settleScore(state: GameState, x: number, y: number): number {
  const t = tileAt(state, x, y);
  if (!t || isWater(t)) return -1;
  if (t.terrain === 'mountains' || t.terrain === 'arctic') return -1;
  if (cityAt(state, x, y)) return -1;
  // keep spacing from existing cities
  for (const c of state.cities) {
    if (chebyshev(c.x, c.y, x, y) <= 3) return -1;
  }
  let score = 0;
  for (const [dx, dy] of cityRadiusOffsets()) {
    const tt = tileAt(state, x + dx, y + dy);
    if (!tt) continue;
    const yy = terrainYield(tt.terrain, tt.river);
    score += yy.food * 3 + yy.shields * 2 + yy.trade;
  }
  // slight preference for river / coast adjacency
  if (t.river) score += 4;
  return score;
}

function moveToward(state: GameState, unit: Unit, tx: number, ty: number) {
  const path = findPath(state, unit, tx, ty);
  if (!path || path.length === 0) return false;
  for (const step of path) {
    if (unit.movesLeft <= 0) return true;
    const enemyHere = state.units.some(u => u.x === step.x && u.y === step.y && u.civId !== unit.civId)
      || state.cities.some(c => c.x === step.x && c.y === step.y && c.civId !== unit.civId);
    if (enemyHere) {
      attackTile(state, unit, step.x, step.y);
      if (!state.units.includes(unit)) return false; // died
      return true;
    }
    unit.x = step.x; unit.y = step.y;
    unit.movesLeft = Math.max(0, unit.movesLeft - 1);
  }
  return true;
}

export function runAI(state: GameState, civId: number) {
  const civ = state.civs[civId];
  if (!civ.alive) return;

  const myUnits = state.units.filter(u => u.civId === civId);
  const myCities = state.cities.filter(c => c.civId === civId);

  // visible? only log things the player can see (handled by engine logs already)
  void idx;

  for (const unit of [...myUnits]) {
    if (!state.units.includes(unit)) continue; // died earlier this turn
    const def = UNIT_TYPES[unit.typeId];

    if (def.isSettler) {
      // evaluate current tile
      const here = settleScore(state, unit.x, unit.y);
      if (here > 20 && (rand() < 0.5 || unit.movesLeft <= 0)) {
        foundCity(state, unit);
        continue;
      }
      // search for a good site nearby
      let best: { x: number; y: number; s: number } | null = null;
      const R = 7;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = unit.x + dx, y = unit.y + dy;
          const s = settleScore(state, x, y);
          if (s < 0) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          const val = s - dist * 2 + rand() * 6;
          if (!best || val > best.s) best = { x, y, s: val };
        }
      }
      if (best) {
        if (best.x === unit.x && best.y === unit.y) {
          foundCity(state, unit);
          continue;
        }
        // step toward target using BFS to an adjacent free tile then continue
        // findPath targets the tile itself; if occupied by own unit, step adjacent
        let path = findPath(state, unit, best.x, best.y);
        if (!path) {
          // try adjacent tiles around target
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            path = findPath(state, unit, best.x + dx, best.y + dy);
            if (path) break;
          }
        }
        if (path) moveToward(state, unit, best.x, best.y);
        else {
          // wander
          wander(state, unit);
        }
      } else {
        // nowhere good: found here if land and no nearby city
        if (here > 0) foundCity(state, unit);
        else wander(state, unit);
      }
      continue;
    }

    // military unit
    // 1. attack adjacent enemy unit or city
    let acted = false;
    for (let dy = -1; dy <= 1 && !acted; dy++) {
      for (let dx = -1; dx <= 1 && !acted; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = unit.x + dx, y = unit.y + dy;
        const t = tileAt(state, x, y);
        if (!t || isWater(t)) continue;
        const enemy = state.units.find(u => u.x === x && u.y === y && u.civId !== unit.civId);
        const eCity = state.cities.find(c => c.x === x && c.y === y && c.civId !== unit.civId);
        if (enemy || eCity) {
          // crude odds check: don't suicide weak attackers into strong defense
          const a = UNIT_TYPES[unit.typeId].attack;
          let d = 1;
          if (enemy) d = UNIT_TYPES[enemy.typeId].defense;
          if (eCity && eCity.buildings.includes('walls')) d *= 2;
          if (a >= d * 0.8 || rand() < 0.25) {
            attackTile(state, unit, x, y);
            acted = true;
          }
        }
      }
    }
    if (acted || !state.units.includes(unit)) continue;

    // 2. hunt nearest enemy within 6 tiles
    let target: { x: number; y: number; dist: number } | null = null;
    for (const u of state.units) {
      if (u.civId === unit.civId) continue;
      const d = chebyshev(unit.x, unit.y, u.x, u.y);
      if (d <= 6 && (!target || d < target.dist)) target = { x: u.x, y: u.y, dist: d };
    }
    for (const c of state.cities) {
      if (c.civId === unit.civId) continue;
      const d = chebyshev(unit.x, unit.y, c.x, c.y);
      if (d <= 6 && (!target || d < target.dist)) target = { x: c.x, y: c.y, dist: d };
    }
    if (target) {
      moveToward(state, unit, target.x, target.y);
      continue;
    }

    // 3. garrison: defend nearest own city; else wander
    if (myCities.length > 0) {
      let home = myCities[0];
      let hd = chebyshev(unit.x, unit.y, home.x, home.y);
      for (const c of myCities) {
        const d = chebyshev(unit.x, unit.y, c.x, c.y);
        if (d < hd) { hd = d; home = c; }
      }
      if (hd === 0) {
        unit.fortified = true;
        unit.movesLeft = 0;
      } else if (hd <= 2) {
        moveToward(state, unit, home.x, home.y);
        if (unit.x === home.x && unit.y === home.y) { unit.fortified = true; unit.movesLeft = 0; }
      } else {
        // explore toward player-ish center
        wander(state, unit);
      }
    } else {
      wander(state, unit);
    }
  }

  checkElimination(state, civId);
}

function wander(state: GameState, unit: Unit) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  // bias toward unexplored / random
  for (let tries = 0; tries < 4 && unit.movesLeft > 0; tries++) {
    const [dx, dy] = dirs[Math.floor(rand() * dirs.length)];
    const x = unit.x + dx, y = unit.y + dy;
    const t = tileAt(state, x, y);
    if (!t || isWater(t)) continue;
    if (state.units.some(u => u.x === x && u.y === y && u.civId !== unit.civId)) continue;
    if (state.cities.some(c => c.x === x && c.y === y && c.civId !== unit.civId)) continue;
    unit.x = x; unit.y = y;
    unit.movesLeft = Math.max(0, unit.movesLeft - 1);
  }
  unit.movesLeft = 0;
}
