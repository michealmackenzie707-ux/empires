import type { GameState } from '../game/types';
import { formatYear } from '../game/types';
import { score } from '../game/engine';
import { Trophy, Skull } from 'lucide-react';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#050810] font-mono">
      {/* decorative horizon */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(to top, rgba(185,138,62,0.08), transparent)' }} />
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#f2f0e6]"
            style={{
              width: 2, height: 2,
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 23 + 7) % 55}%`,
              opacity: 0.08 + ((i * 7) % 10) / 40,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 text-center">
        <div className="text-[10px] tracking-[0.5em] text-[#5a6378]">A GAME OF ANCIENT EMPIRES</div>
        <h1 className="font-display mt-4 text-7xl tracking-[0.18em] text-[#f2f0e6]">EMPIRES</h1>
        <div className="mx-auto mt-4 h-px w-64 bg-gradient-to-r from-transparent via-[#b98a3e] to-transparent" />
        <p className="mx-auto mt-5 max-w-md text-[11px] leading-relaxed text-[#8a8f9e]">
          4000 BC. Lead your tribe from a single band of settlers to a civilization
          that stands the test of time. Found cities, research technology, raise armies,
          and outlast three rival empires.
        </p>
        <button
          onClick={onStart}
          className="mt-8 border border-[#fbbf24] bg-transparent px-10 py-3 text-[12px] font-bold tracking-[0.35em] text-[#fbbf24] transition-all hover:bg-[#fbbf24] hover:text-[#1a1408]"
        >
          BEGIN 4000 BC
        </button>
        <div className="mt-8 grid grid-cols-3 gap-6 text-left text-[9px] leading-relaxed text-[#5a6378]">
          <div><span className="text-[#b98a3e]">EXPLORE</span><br />Drag to pan, scroll to zoom. Click a unit, then a highlighted tile.</div>
          <div><span className="text-[#b98a3e]">EXPAND</span><br />Found cities with Settlers. Cities work the land and build.</div>
          <div><span className="text-[#b98a3e]">EXTERMINATE</span><br />Capture every rival capital — or outscore all rivals by turn 250.</div>
        </div>
      </div>
    </div>
  );
}

export function EndScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const won = state.phase === 'victory';
  const playerScore = score(state, 0);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 font-mono">
      <div className="w-[420px] border border-[#2a3a5f] bg-[#0c1220] px-8 py-8 text-center">
        {won ? (
          <Trophy size={36} className="mx-auto text-[#fbbf24]" />
        ) : (
          <Skull size={36} className="mx-auto text-[#f87171]" />
        )}
        <h2 className="font-display mt-4 text-3xl tracking-[0.2em] text-[#f2f0e6]">
          {won ? 'VICTORY' : 'DEFEAT'}
        </h2>
        <p className="mt-3 text-[11px] leading-relaxed text-[#8a8f9e]">
          {won
            ? `In ${formatYear(state.year)}, the ${state.civs[0].name} stands unchallenged. Your name will echo through the ages.`
            : `In ${formatYear(state.year)}, the ${state.civs[0].name} fades into history. The chroniclers will remember what was lost.`}
        </p>
        <div className="mt-5 space-y-1 border-t border-[#1a2540] pt-4">
          {state.civs.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between text-[10px]">
              <span style={{ color: c.color }}>{c.name}</span>
              <span className={c.alive ? 'text-[#e8e4d8]' : 'text-[#5a6378] line-through'}>
                {score(state, i)} pts
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-[#5a6378]">Final score: <span className="text-[#fbbf24]">{playerScore}</span></div>
        <button
          onClick={onRestart}
          className="mt-6 w-full bg-[#fbbf24] py-2.5 text-[11px] font-bold tracking-[0.3em] text-[#1a1408] transition-colors hover:bg-[#ffd05a]"
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
