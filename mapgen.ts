import type { Tile, TerrainType } from './types';

// Deterministic RNG
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise with smoothing
function makeNoise(seed: number, w: number, h: number, cell: number) {
  const rng = mulberry32(seed);
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smooth(fx - x0), ty = smooth(fy - y0);
    const v00 = grid[y0 * gw + x0], v10 = grid[y0 * gw + x0 + 1];
    const v01 = grid[(y0 + 1) * gw + x0], v11 = grid[(y0 + 1) * gw + x0 + 1];
    const a = v00 + (v10 - v00) * tx;
    const b = v01 + (v11 - v01) * tx;
    return a + (b - a) * ty;
  };
}

export interface GenResult {
  width: number;
  height: number;
  tiles: Tile[];
  landmass: boolean[]; // main continent mask
}

export function generateMap(seed: number, width = 56, height = 36): GenResult {
  const elevA = makeNoise(seed, width, height, 9);
  const elevB = makeNoise(seed + 101, width, height, 4);
  const moist = makeNoise(seed + 202, width, height, 7);
  const rng = mulberry32(seed + 303);

  const tiles: Tile[] = [];
  const elev = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let e = elevA(x, y) * 0.72 + elevB(x, y) * 0.28;
      // push edges down slightly for ocean frame, but keep a pangaea feel
      const ex = Math.min(x, width - 1 - x) / (width / 2);
      const ey = Math.min(y, height - 1 - y) / (height / 2);
      const edge = Math.min(1, Math.min(ex, ey) * 2.2);
      e = e * (0.62 + 0.38 * edge);
      elev[y * width + x] = e;
    }
  }

  // choose threshold so land covers ~42%
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const landFrac = 0.44;
  const seaLevel = sorted[Math.floor(sorted.length * (1 - landFrac))];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = elev[y * width + x];
      const lat = y / (height - 1); // 0 top .. 1 bottom
      const temp = 1 - Math.abs(lat - 0.5) * 2; // 1 equator, 0 poles
      const m = moist(x, y);
      let terrain: TerrainType;
      if (e < seaLevel - 0.06) terrain = 'ocean';
      else if (e < seaLevel) terrain = 'coast';
      else {
        const rel = (e - seaLevel) / (1 - seaLevel + 1e-6);
        if (rel > 0.82) terrain = 'mountains';
        else if (rel > 0.62) terrain = 'hills';
        else if (temp < 0.12) terrain = 'arctic';
        else if (temp < 0.26) terrain = 'tundra';
        else if (m < 0.30 && temp > 0.45) terrain = 'desert';
        else if (m > 0.62) terrain = 'forest';
        else if (m > 0.42) terrain = 'grassland';
        else terrain = 'plains';
      }
      tiles.push({ x, y, terrain, river: false });
    }
  }

  // rivers: pick some high-elevation sources, walk downhill to the sea
  const riverCount = 6 + Math.floor(rng() * 4);
  for (let r = 0; r < riverCount; r++) {
    let x = 2 + Math.floor(rng() * (width - 4));
    let y = 2 + Math.floor(rng() * (height - 4));
    let steps = 0;
    while (steps++ < 60) {
      const t = tiles[y * width + x];
      if (t.terrain === 'ocean' || t.terrain === 'coast') break;
      if (t.terrain !== 'mountains') t.river = true;
      // move to lowest neighbor
      let bx = x, by = y, be = elev[y * width + x];
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
        if (elev[ny * width + nx] < be) { be = elev[ny * width + nx]; bx = nx; by = ny; }
      }
      if (bx === x && by === y) break;
      x = bx; y = by;
    }
  }

  // main landmass via flood fill
  const landmass = new Array<boolean>(width * height).fill(false);
  const isLand = (i: number) => {
    const t = tiles[i].terrain;
    return t !== 'ocean' && t !== 'coast';
  };
  let bestStart = -1, bestSize = 0;
  const visited = new Array<boolean>(width * height).fill(false);
  for (let i = 0; i < tiles.length; i++) {
    if (!isLand(i) || visited[i]) continue;
    const stack = [i];
    visited[i] = true;
    let size = 0;
    const members: number[] = [];
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      members.push(c);
      const cx = c % width, cy = Math.floor(c / width);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (!visited[n] && isLand(n)) { visited[n] = true; stack.push(n); }
      }
    }
    if (size > bestSize) { bestSize = size; bestStart = members[0]; }
  }
  if (bestStart >= 0) {
    const stack = [bestStart];
    landmass[bestStart] = true;
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % width, cy = Math.floor(c / width);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (!landmass[n] && isLand(n)) { landmass[n] = true; stack.push(n); }
      }
    }
  }

  return { width, height, tiles, landmass };
}

// City site scoring: sum of tile yields in city radius
export function cityRadiusOffsets(): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
      out.push([dx, dy]);
    }
  }
  return out;
}
