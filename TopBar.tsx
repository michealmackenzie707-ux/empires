import type { GameState } from '../game/types';
import { formatYear } from '../game/types';
import { TECHS, techCost } from '../game/data';
import { score } from '../game/engine';
import { Coins, FlaskConical, Hourglass } from 'lucide-react';

interface Props {
  state: GameState;
  onOpenResearch: () => void;
  onNewGame: () => void;
}

export function TopBar({ state, onOpenResearch, onNewGame }: Props) {
  const player = state.civs[0];
  const cost = player.research ? techCost(player.techs.length) : 0;
  const pct = player.research ? Math.min(100, Math.floor((player.scienceStored / cost) * 100)) : 0;

  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-[#1a2540] bg-[#0c1220] px-4 font-mono text-[11px] tracking-wider">
      <div className="flex items-center gap-2">
        <span className="font-display text-sm tracking-[0.25em] text-[#f2f0e6]">EMPIRES</span>
      </div>
      <span className="text-[#3d4a68]">|</span>
      <div className="flex items-center gap-1.5 text-[#fbbf24]">
        <Hourglass size={12} />
        <span className="text-[#e8e4d8]">TURN {state.turn}</span>
        <span className="text-[#8a8f9e]">· {formatYear(state.year)}</span>
      </div>
      <span className="text-[#3d4a68]">|</span>
      <div className="flex items-center gap-1.5">
        <Coins size={12} className="text-[#fbbf24]" />
        <span className="text-[#e8e4d8]">{player.gold}</span>
        <span className="text-[#8a8f9e]">GOLD</span>
      </div>
      <button
        onClick={onOpenResearch}
        className="flex items-center gap-1.5 border border-[#1a2540] bg-[#111a2b] px-2 py-1 text-left transition-colors hover:border-[#fbbf24]/50"
      >
        <FlaskConical size={12} className="text-[#34d399]" />
        <span className="text-[#e8e4d8]">{player.research ? TECHS[player.research].name.toUpperCase() : 'CHOOSE RESEARCH'}</span>
        {player.research && (
          <span className="relative h-1 w-16 overflow-hidden bg-[#1a2540]">
            <span className="absolute inset-y-0 left-0 bg-[#34d399]" style={{ width: `${pct}%` }} />
          </span>
        )}
      </button>
      <div className="ml-auto flex items-center gap-3">
        {state.civs.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1" title={`${c.name} — ${c.alive ? `score ${score(state, i)}` : 'eliminated'}`}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: c.color, opacity: c.alive ? 1 : 0.2 }}
            />
            <span className={c.alive ? 'text-[#8a8f9e]' : 'text-[#3d4a68] line-through'}>
              {c.name.split(' ')[0].toUpperCase()}
            </span>
          </div>
        ))}
        <span className="text-[#3d4a68]">|</span>
        <button onClick={onNewGame} className="text-[#8a8f9e] transition-colors hover:text-[#fbbf24]">
          NEW GAME
        </button>
      </div>
    </header>
  );
}
