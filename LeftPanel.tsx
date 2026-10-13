import type { GameState } from '../game/types';
import { UNIT_TYPES, productionCost } from '../game/data';
import { cityYields, score } from '../game/engine';
import { Landmark } from 'lucide-react';

interface Props {
  state: GameState;
  onOpenCity: (id: number) => void;
}

export function LeftPanel({ state, onOpenCity }: Props) {
  const player = state.civs[0];
  const myCities = state.cities.filter(c => c.civId === 0);
  const myUnits = state.units.filter(u => u.civId === 0);
  const scienceRate = myCities.reduce((s, c) => s + cityYields(state, c).science, 0);
  const goldRate = myCities.reduce((s, c) => s + cityYields(state, c).gold, 0);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#1a2540] bg-[#0c1220] font-mono">
      <Section title="EMPIRE">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 text-[11px]">
          <Stat label="LEADER" value={player.leader} />
          <Stat label="SCORE" value={String(score(state, 0))} />
          <Stat label="CITIES" value={String(myCities.length)} />
          <Stat label="UNITS" value={String(myUnits.length)} />
          <Stat label="SCIENCE" value={`+${scienceRate}/t`} accent="#34d399" />
          <Stat label="INCOME" value={`+${goldRate}/t`} accent="#fbbf24" />
          <Stat label="TECHS" value={String(player.techs.length)} />
          <Stat label="RIVALS" value={String(state.civs.filter(c => c.alive && !c.isPlayer).length)} />
        </div>
      </Section>

      <Section title="CITIES" grow>
        <div className="flex-1 overflow-y-auto px-2 py-1.5">
          {myCities.length === 0 && (
            <p className="px-1 py-2 text-[10px] leading-relaxed text-[#5a6378]">
              No cities yet. Move your Settlers to fertile land and press FOUND CITY.
            </p>
          )}
          {myCities.map(c => {
            const y = cityYields(state, c);
            const cost = c.production ? productionCost(c.production) : 0;
            const pct = c.production ? Math.min(100, (c.shieldsStored / cost) * 100) : 0;
            return (
              <button
                key={c.id}
                onClick={() => onOpenCity(c.id)}
                className="mb-1 block w-full border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[#1a2540] hover:bg-[#111a2b]"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-[#e8e4d8]">
                    <Landmark size={11} className="text-[#8a8f9e]" />
                    {c.name} <span className="text-[#8a8f9e]">·{c.size}</span>
                  </span>
                  <span className="text-[10px] text-[#8a8f9e]">
                    {c.production ? (c.production.kind === 'unit' ? UNIT_TYPES[c.production.id].name : c.production.id.toUpperCase()) : '—'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="relative h-[3px] flex-1 overflow-hidden bg-[#1a2540]">
                    <span className="absolute inset-y-0 left-0 bg-[#b98a3e]" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-[9px] text-[#5a6378]">
                    {y.food}F {y.shields}S {y.trade}T
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="CHRONICLE" grow>
        <div className="flex-1 overflow-y-auto px-3 py-1.5">
          {[...state.log].reverse().slice(0, 40).map((e, i) => (
            <p
              key={i}
              className="mb-1 text-[10px] leading-snug"
              style={{
                color: e.tone === 'good' ? '#34d399' : e.tone === 'bad' ? '#f87171' : e.tone === 'war' ? '#fbbf24' : '#8a8f9e',
                opacity: Math.max(0.35, 1 - i * 0.05),
              }}
            >
              <span className="text-[#3d4a68]">[{e.turn}]</span> {e.text}
            </p>
          ))}
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, children, grow }: { title: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={`flex flex-col border-b border-[#1a2540] ${grow ? 'min-h-0 flex-1' : ''}`}>
      <div className="border-b border-[#1a2540] px-3 py-1.5 text-[9px] font-semibold tracking-[0.22em] text-[#5a6378]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[8px] tracking-[0.18em] text-[#5a6378]">{label}</div>
      <div className="text-[11px]" style={{ color: accent ?? '#e8e4d8' }}>{value}</div>
    </div>
  );
}
