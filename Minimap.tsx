import { useEffect, useRef } from 'react';
import type { GameState } from '../game/types';
import { idx, isWater } from '../game/types';

const TERRAIN_MINI: Record<string, string> = {
  ocean: '#16293d', coast: '#1f3a52', grassland: '#4d7a38', plains: '#a5944f',
  desert: '#d3bd7f', forest: '#2c5a30', hills: '#7d6743', mountains: '#7a7264',
  tundra: '#a8ab97', arctic: '#dfe3d9',
};

interface Props {
  state: GameState;
  onJump: (x: number, y: number) => void;
}

export function Minimap({ state, onJump }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const sx = W / state.width, sy = H / state.height;
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const i = idx(x, y, state.width);
        if (!state.explored[i]) continue;
        const t = state.tiles[i];
        ctx.fillStyle = TERRAIN_MINI[t.terrain];
        ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
        if (!state.visible[i] && !isWater(t)) {
          ctx.fillStyle = 'rgba(5,8,16,0.45)';
          ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
        }
      }
    }
    // cities
    for (const c of state.cities) {
      const i = idx(c.x, c.y, state.width);
      if (!state.explored[i]) continue;
      ctx.fillStyle = state.civs[c.civId].color;
      ctx.fillRect(c.x * sx - 1, c.y * sy - 1, 3, 3);
    }
    // units (player + visible enemies)
    for (const u of state.units) {
      const i = idx(u.x, u.y, state.width);
      if (!state.visible[i]) continue;
      ctx.fillStyle = state.civs[u.civId].color;
      ctx.fillRect(u.x * sx, u.y * sy, 2, 2);
    }
  }, [state]);

  return (
    <canvas
      ref={ref}
      width={264}
      height={170}
      className="block w-full cursor-pointer border border-[#1a2540]"
      onClick={(e) => {
        const rect = ref.current!.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width;
        const fy = (e.clientY - rect.top) / rect.height;
        onJump(Math.floor(fx * state.width), Math.floor(fy * state.height));
      }}
    />
  );
}
