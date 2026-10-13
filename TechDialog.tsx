import type { GameState } from '../game/types';
import { availableTechs, TECHS } from '../game/data';
import { FlaskConical } from 'lucide-react';

interface Props {
  state: GameState;
  onPick: (techId: string) => void;
}

export function TechDialog({ state, onPick }: Props) {
  const player = state.civs[0];
  const avail = availableTechs(player.techs);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-[460px] border border-[#2a3a5f] bg-[#0c1220] font-mono shadow-2xl">
        <div className="border-b border-[#1a2540] px-4 py-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-[#34d399]" />
            <span className="font-display text-base tracking-[0.2em] text-[#f2f0e6]">CHOOSE RESEARCH</span>
          </div>
          <p className="mt-1 text-[10px] text-[#8a8f9e]">
            Your wise men await direction. {player.techs.length > 0 ? `Known: ${player.techs.map(t => TECHS[t].name).join(', ')}` : 'Your civilization knows nothing yet.'}
          </p>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {avail.length === 0 && (
            <p className="px-4 py-6 text-center text-[11px] text-[#8a8f9e]">All knowledge has been discovered.</p>
          )}
          {avail.map(t => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className="flex w-full items-center justify-between border-b border-[#1a2540] px-4 py-2.5 text-left transition-colors hover:bg-[#111a2b]"
            >
              <div>
                <div className="text-[11px] text-[#e8e4d8]">{t.name}</div>
                <div className="text-[9px] text-[#5a6378]">{t.desc}</div>
              </div>
              {t.prereqs.length > 0 && (
                <span className="text-[8px] text-[#3d4a68]">req: {t.prereqs.map(p => TECHS[p].name).join(', ')}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
