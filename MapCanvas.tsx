import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, Unit, Tile } from '../game/types';
import { idx, tileAt, cityAt, isWater } from '../game/types';
import { UNIT_TYPES } from '../game/data';
import { findPath } from '../game/engine';

const TS = 34; // base tile size px

const TERRAIN_COLORS: Record<string, string> = {
  ocean: '#16293d',
  coast: '#1f3a52',
  grassland: '#4d7a38',
  plains: '#a5944f',
  desert: '#d3bd7f',
  forest: '#2c5a30',
  hills: '#7d6743',
  mountains: '#7a7264',
  tundra: '#a8ab97',
  arctic: '#dfe3d9',
};

export interface HoverInfo {
  x: number; y: number; tile: Tile;
  units: Unit[];
}

interface Props {
  state: GameState;
  onTileClick: (x: number, y: number) => void;
  onHover: (info: HoverInfo | null) => void;
  centerOn: { x: number; y: number; seq: number } | null;
}

export function MapCanvas({ state, onTileClick, onHover, centerOn }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [, force] = useState(0);

  const toScreen = useCallback((tx: number, ty: number) => {
    const { x, y, zoom } = cam.current;
    return { sx: tx * TS * zoom - x, sy: ty * TS * zoom - y };
  }, []);

  const toTile = useCallback((sx: number, sy: number) => {
    const { x, y, zoom } = cam.current;
    return { tx: Math.floor((sx + x) / (TS * zoom)), ty: Math.floor((sy + y) / (TS * zoom)) };
  }, []);

  const centerOnTile = useCallback((tx: number, ty: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const z = cam.current.zoom;
    cam.current.x = tx * TS * z - el.clientWidth / 2;
    cam.current.y = ty * TS * z - el.clientHeight / 2;
    clampCam(state, el, cam.current);
    force(v => v + 1);
  }, [state]);

  // initial center on first unit
  useEffect(() => {
    const u = state.units.find(u => u.civId === 0);
    if (u) centerOnTile(u.x, u.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seed]);

  useEffect(() => {
    if (centerOn) centerOnTile(centerOn.x, centerOn.y);
  }, [centerOn, centerOnTile]);

  // keyboard pan
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const step = 90;
      if (e.key === 'ArrowLeft' || e.key === 'a') cam.current.x -= step;
      else if (e.key === 'ArrowRight' || e.key === 'd') cam.current.x += step;
      else if (e.key === 'ArrowUp' || e.key === 'w') cam.current.y -= step;
      else if (e.key === 'ArrowDown' || e.key === 's') cam.current.y += step;
      else return;
      e.preventDefault();
      clampCam(state, el, cam.current);
      force(v => v + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let raf = 0;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const draw = (time: number) => {
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr; canvas.height = ch * dpr;
        canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050810';
      ctx.fillRect(0, 0, cw, ch);

      const { x: camX, y: camY, zoom } = cam.current;
      const ts = TS * zoom;
      const x0 = Math.max(0, Math.floor(camX / ts));
      const y0 = Math.max(0, Math.floor(camY / ts));
      const x1 = Math.min(state.width - 1, Math.ceil((camX + cw) / ts));
      const y1 = Math.min(state.height - 1, Math.ceil((camY + ch) / ts));

      // terrain pass
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const i = idx(tx, ty, state.width);
          const t = state.tiles[i];
          const sx = tx * ts - camX, sy = ty * ts - camY;
          const explored = state.explored[i];
          if (!explored) {
            // unexplored void with faint grain
            ctx.fillStyle = '#070b14';
            ctx.fillRect(sx, sy, ts + 1, ts + 1);
            if ((tx * 7 + ty * 13) % 11 === 0) {
              ctx.fillStyle = 'rgba(148,163,184,0.05)';
              ctx.fillRect(sx + ts / 2, sy + ts / 2, 2, 2);
            }
            continue;
          }
          ctx.fillStyle = TERRAIN_COLORS[t.terrain];
          ctx.fillRect(sx, sy, ts + 1, ts + 1);
          drawTerrainDetail(ctx, t, sx, sy, ts, tx, ty);
          // grid hairline
          ctx.strokeStyle = 'rgba(5,8,16,0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, ts, ts);
        }
      }

      // fog overlay for explored-not-visible
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const i = idx(tx, ty, state.width);
          if (!state.explored[i] || state.visible[i]) continue;
          const sx = tx * ts - camX, sy = ty * ts - camY;
          ctx.fillStyle = 'rgba(5,8,16,0.52)';
          ctx.fillRect(sx, sy, ts + 1, ts + 1);
        }
      }

      // selected unit: reachable highlight + path preview
      const sel = state.units.find(u => u.id === state.selectedUnitId);
      if (sel && sel.movesLeft > 0) {
        const range = Math.floor(sel.movesLeft);
        for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            const tx = sel.x + dx, ty = sel.y + dy;
            const t = tileAt(state, tx, ty);
            if (!t || isWater(t)) continue;
            const i = idx(tx, ty, state.width);
            if (!state.visible[i]) continue;
            const sx = tx * ts - camX, sy = ty * ts - camY;
            const enemy = state.units.some(u => u.x === tx && u.y === ty && u.civId !== 0)
              || state.cities.some(c => c.x === tx && c.y === ty && c.civId !== 0);
            ctx.fillStyle = enemy ? 'rgba(224,62,45,0.28)' : 'rgba(251,191,36,0.14)';
            ctx.fillRect(sx + 1, sy + 1, ts - 1, ts - 1);
          }
        }
        // path to hover
        const hov = hoverRef.current;
        if (hov) {
          const path = findPath(state, sel, hov.x, hov.y);
          if (path && path.length > 0) {
            ctx.strokeStyle = 'rgba(251,191,36,0.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(sel.x * ts + ts / 2 - camX, sel.y * ts + ts / 2 - camY);
            for (const p of path) ctx.lineTo(p.x * ts + ts / 2 - camX, p.y * ts + ts / 2 - camY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // cities
      ctx.textAlign = 'center';
      for (const c of state.cities) {
        const i = idx(c.x, c.y, state.width);
        if (!state.explored[i]) continue;
        if (c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) continue;
        const sx = c.x * ts - camX, sy = c.y * ts - camY;
        const civ = state.civs[c.civId];
        const visible = state.visible[i];
        // keep icon: parchment square, civ-color roof
        const s = ts * 0.62;
        ctx.fillStyle = '#efe8d4';
        ctx.fillRect(sx + (ts - s) / 2, sy + (ts - s) / 2, s, s);
        ctx.fillStyle = civ.color;
        ctx.beginPath();
        ctx.moveTo(sx + ts / 2 - s / 2, sy + (ts - s) / 2);
        ctx.lineTo(sx + ts / 2, sy + (ts - s) / 2 - s * 0.42);
        ctx.lineTo(sx + ts / 2 + s / 2, sy + (ts - s) / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#050810';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + (ts - s) / 2, sy + (ts - s) / 2, s, s);
        // pop number
        ctx.fillStyle = '#1a1408';
        ctx.font = `700 ${Math.max(9, ts * 0.32)}px "JetBrains Mono", monospace`;
        ctx.fillText(String(c.size), sx + ts / 2, sy + ts / 2 + s * 0.28);
        // name label
        const label = `${c.name} ${c.size}`;
        ctx.font = `600 ${Math.max(9, ts * 0.28)}px "JetBrains Mono", monospace`;
        const lw = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(5,8,16,0.78)';
        ctx.fillRect(sx + ts / 2 - lw / 2, sy + ts + 1, lw, Math.max(11, ts * 0.34));
        ctx.fillStyle = visible ? civ.color : '#8a8f9e';
        ctx.fillText(label, sx + ts / 2, sy + ts + 1 + Math.max(9, ts * 0.26));
        // city radius when player's city selected
        if (state.openCityId === c.id) {
          ctx.strokeStyle = 'rgba(251,191,36,0.55)';
          ctx.lineWidth = 1.5;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
            ctx.strokeRect((c.x + dx) * ts - camX, (c.y + dy) * ts - camY, ts, ts);
          }
        }
      }

      // units
      const pulse = 0.5 + 0.5 * Math.sin(time / 350);
      for (const u of state.units) {
        const i = idx(u.x, u.y, state.width);
        if (!state.visible[i]) continue;
        if (u.x < x0 - 1 || u.x > x1 + 1 || u.y < y0 - 1 || u.y > y1 + 1) continue;
        // hide units stacked under a city unless selected
        const cityHere = cityAt(state, u.x, u.y);
        const stack = state.units.filter(o => o.x === u.x && o.y === u.y);
        if (cityHere && u.id !== state.selectedUnitId && stack[0].id !== u.id) continue;
        if (cityHere && u.id !== state.selectedUnitId && stack[0].id === u.id && stack.length === 1) continue;
        const sx = u.x * ts - camX, sy = u.y * ts - camY;
        const civ = state.civs[u.civId];
        const us = ts * 0.56;
        const ux = sx + (ts - us) / 2, uy = sy + (ts - us) / 2 - ts * 0.06;
        // chip
        ctx.fillStyle = civ.color;
        roundRect(ctx, ux, uy, us, us, us * 0.22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(5,8,16,0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // glyph
        ctx.fillStyle = '#0a0f1c';
        ctx.font = `800 ${Math.max(10, us * 0.62)}px "JetBrains Mono", monospace`;
        ctx.fillText(UNIT_TYPES[u.typeId].glyph, ux + us / 2, uy + us * 0.72);
        // fortified mark
        if (u.fortified) {
          ctx.fillStyle = 'rgba(5,8,16,0.9)';
          ctx.font = `700 ${Math.max(8, ts * 0.24)}px "JetBrains Mono", monospace`;
          ctx.fillText('F', sx + ts - ts * 0.2, sy + ts * 0.3);
        }
        // selection ring
        if (u.id === state.selectedUnitId) {
          ctx.strokeStyle = `rgba(251,191,36,${0.6 + 0.4 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4);
        }
        // stack count badge
        if (stack.length > 1 && stack[0].id === u.id) {
          ctx.fillStyle = '#050810';
          ctx.beginPath();
          ctx.arc(ux + us, uy, ts * 0.17, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fbbf24';
          ctx.font = `700 ${Math.max(8, ts * 0.24)}px "JetBrains Mono", monospace`;
          ctx.fillText(String(stack.length), ux + us, uy + ts * 0.09);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state, toScreen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { tx, ty } = toTile(e.clientX - rect.left, e.clientY - rect.top);
    if (tx >= 0 && ty >= 0 && tx < state.width && ty < state.height) {
      hoverRef.current = { x: tx, y: ty };
      const tile = state.tiles[idx(tx, ty, state.width)];
      const units = state.units.filter(u => u.x === tx && u.y === ty && state.visible[idx(tx, ty, state.width)]);
      onHover({ x: tx, y: ty, tile, units });
    } else {
      hoverRef.current = null;
      onHover(null);
    }
    if (drag.current) {
      const dx = e.clientX - drag.current.sx, dy = e.clientY - drag.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
      if (drag.current.moved) {
        cam.current.x = drag.current.cx - dx;
        cam.current.y = drag.current.cy - dy;
        clampCam(state, wrapRef.current!, cam.current);
        force(v => v + 1);
      }
    }
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (drag.current && !drag.current.moved) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { tx, ty } = toTile(e.clientX - rect.left, e.clientY - rect.top);
      if (tx >= 0 && ty >= 0 && tx < state.width && ty < state.height) {
        onTileClick(tx, ty);
      }
    }
    drag.current = null;
  };
  const handleWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const old = cam.current.zoom;
    const next = Math.min(2.2, Math.max(0.55, old * (e.deltaY > 0 ? 0.9 : 1.11)));
    if (next === old) return;
    // zoom toward cursor
    cam.current.x = (cam.current.x + mx) * (next / old) - mx;
    cam.current.y = (cam.current.y + my) * (next / old) - my;
    cam.current.zoom = next;
    clampCam(state, wrapRef.current!, cam.current);
    force(v => v + 1);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden" style={{ cursor: drag.current?.moved ? 'grabbing' : 'crosshair' }}>
      <canvas
        ref={canvasRef}
        className="block"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { hoverRef.current = null; onHover(null); drag.current = null; }}
        onWheel={handleWheel}
      />
    </div>
  );
}

function clampCam(state: GameState, el: HTMLElement, c: { x: number; y: number; zoom: number }) {
  const maxX = state.width * TS * c.zoom - el.clientWidth;
  const maxY = state.height * TS * c.zoom - el.clientHeight;
  c.x = Math.max(-120, Math.min(maxX + 120, c.x));
  c.y = Math.max(-120, Math.min(maxY + 120, c.y));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTerrainDetail(ctx: CanvasRenderingContext2D, t: Tile, sx: number, sy: number, ts: number, tx: number, ty: number) {
  const u = ts / 34; // scale factor
  ctx.save();
  switch (t.terrain) {
    case 'forest': {
      ctx.fillStyle = '#1e4223';
      const spots = [[0.3, 0.55], [0.62, 0.38], [0.55, 0.72]];
      for (const [fx, fy] of spots) {
        const cx = sx + fx * ts, cy = sy + fy * ts;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7 * u);
        ctx.lineTo(cx + 5 * u, cy + 4 * u);
        ctx.lineTo(cx - 5 * u, cy + 4 * u);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'mountains': {
      ctx.fillStyle = '#8f8676';
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.5, sy + ts * 0.2);
      ctx.lineTo(sx + ts * 0.82, sy + ts * 0.75);
      ctx.lineTo(sx + ts * 0.18, sy + ts * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e9e7dd';
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.5, sy + ts * 0.2);
      ctx.lineTo(sx + ts * 0.62, sy + ts * 0.42);
      ctx.lineTo(sx + ts * 0.5, sy + ts * 0.5);
      ctx.lineTo(sx + ts * 0.4, sy + ts * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'hills': {
      ctx.strokeStyle = 'rgba(60,46,28,0.7)';
      ctx.lineWidth = 1.5 * u;
      for (const fy of [0.4, 0.65]) {
        ctx.beginPath();
        ctx.arc(sx + ts * 0.5, sy + ts * (fy + 0.22), ts * 0.22, Math.PI, 0);
        ctx.stroke();
      }
      break;
    }
    case 'desert': {
      ctx.fillStyle = 'rgba(122,98,50,0.55)';
      for (const [fx, fy] of [[0.3, 0.35], [0.66, 0.55], [0.4, 0.72]]) {
        ctx.beginPath();
        ctx.arc(sx + fx * ts, sy + fy * ts, 1.4 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'ocean':
    case 'coast': {
      if ((tx * 3 + ty * 5) % 4 === 0) {
        ctx.strokeStyle = t.terrain === 'ocean' ? 'rgba(122,166,205,0.22)' : 'rgba(140,190,220,0.35)';
        ctx.lineWidth = 1 * u;
        for (const fy of [0.35, 0.65]) {
          ctx.beginPath();
          ctx.arc(sx + ts * 0.5, sy + ts * fy, ts * 0.18, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
      }
      break;
    }
    case 'grassland': {
      if ((tx + ty) % 3 === 0) {
        ctx.strokeStyle = 'rgba(220,230,180,0.25)';
        ctx.lineWidth = 1 * u;
        ctx.beginPath();
        ctx.moveTo(sx + ts * 0.35, sy + ts * 0.6);
        ctx.lineTo(sx + ts * 0.4, sy + ts * 0.45);
        ctx.moveTo(sx + ts * 0.55, sy + ts * 0.7);
        ctx.lineTo(sx + ts * 0.6, sy + ts * 0.55);
        ctx.stroke();
      }
      break;
    }
    case 'tundra':
    case 'arctic': {
      if ((tx * 5 + ty * 3) % 5 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(sx + ts * 0.4, sy + ts * 0.45, 2 * u, 2 * u);
        ctx.fillRect(sx + ts * 0.6, sy + ts * 0.65, 2 * u, 2 * u);
      }
      break;
    }
  }
  if (t.river) {
    ctx.strokeStyle = '#5a9fd4';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(sx + ts * 0.15, sy + ts * 0.1);
    ctx.quadraticCurveTo(sx + ts * 0.55, sy + ts * 0.4, sx + ts * 0.4, sy + ts * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}
