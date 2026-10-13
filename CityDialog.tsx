import type { GameState } from '../game/types';
import { UNIT_TYPES, BUILDINGS, productionOptions, productionCost } from '../game/data';
import { cityYields, foodBox, rushCost } from '../game/engine';
import { X, Wheat, Hammer, Landmark, Zap } from 'lucide-react';

interface Props {
  state: GameState;
  cityId: number;
  onClose: () => void;
  onAction: (fn: (s: GameState) => void) => void;
}

export function CityDialog({ state, cityId, onClose, onAction }: Props) {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return null;
  const civ = state.civs[city.civId];
  const isMine = city.civId === 0;
  const y = cityYields(state, city);
  const box = foodBox(city);
  const rc = isMine ? rushCost(state, city) : null;
  const options = isMine ? productionOptions(city, civ.techs) : [];
  const garrison = state.units.filter(u => u.x === city.x && u.y === city.y && u.civId === city.civId);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[520px] border border-[#2a3a5f] bg-[#0c1220] font-mono shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1a2540] px-4 py-2.5">
          <div>
            <span className="font-display text-lg tracking-[0.15em] text-[#f2f0e6]">{city.name}</span>
            <span className="ml-3 text-[10px] tracking-wider" style={{ color: civ.color }}>
              {civ.name.toUpperCase()} · SIZE {city.size}
            </span>
          </div>
          <button onClick={onClose} className="text-[#8a8f9e] hover:text-[#fbbf24]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-3 gap-px bg-[#1a2540]">
          <div className="bg-[#0c1220] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-[#5a6378]"><Wheat size={10} /> FOOD</div>
            <div className="mt-1 text-[13px] text-[#e8e4d8]">
              {y.surplus >= 0 ? '+' : ''}{y.surplus}<span className="text-[9px] text-[#5a6378]">/turn</span>
            </div>
            <div className="relative mt-1.5 h-1 overflow-hidden bg-[#1a2540]">
              <div className="absolute inset-y-0 left-0 bg-[#34d399]" style={{ width: `${Math.min(100, (city.foodStored / box) * 100)}%` }} />
            </div>
            <div className="mt-1 text-[8px] text-[#5a6378]">{city.foodStored}/{box} to grow</div>
          </div>
          <div className="bg-[#0c1220] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-[#5a6378]"><Hammer size={10} /> PRODUCTION</div>
            <div className="mt-1 text-[13px] text-[#e8e4d8]">+{y.shields}<span className="text-[9px] text-[#5a6378]">/turn</span></div>
            {city.production && (
              <>
                <div className="relative mt-1.5 h-1 overflow-hidden bg-[#1a2540]">
                  <div className="absolute inset-y-0 left-0 bg-[#b98a3e]" style={{ width: `${Math.min(100, (city.shieldsStored / productionCost(city.production)) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[8px] text-[#5a6378]">{city.shieldsStored}/{productionCost(city.production)}</div>
              </>
            )}
          </div>
          <div className="bg-[#0c1220] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-[#5a6378]"><Landmark size={10} /> TRADE</div>
            <div className="mt-1 text-[13px] text-[#e8e4d8]">{y.trade}</div>
            <div className="mt-1 text-[8px] text-[#5a6378]">
              <span className="text-[#34d399]">+{y.science} sci</span> · <span className="text-[#fbbf24]">+{y.gold} gold</span>
            </div>
          </div>
        </div>

        {isMine && (
          <div className="grid grid-cols-2 gap-4 px-4 py-3">
            <div>
              <div className="mb-1.5 text-[9px] tracking-[0.2em] text-[#5a6378]">PRODUCING</div>
              <div className="max-h-[180px] overflow-y-auto border border-[#1a2540]">
                {options.map(o => {
                  const active = city.production?.kind === o.kind && city.production.id === o.id;
                  const label = o.kind === 'unit' ? UNIT_TYPES[o.id].name : BUILDINGS[o.id].name;
                  const cost = productionCost(o);
                  const detail = o.kind === 'unit'
                    ? `${UNIT_TYPES[o.id].attack}A/${UNIT_TYPES[o.id].defense}D/${UNIT_TYPES[o.id].moves}M`
                    : '';
                  return (
                    <button
                      key={o.kind + o.id}
                      onClick={() => onAction(s => {
                        const c = s.cities.find(cc => cc.id === cityId);
                        if (c) { c.production = { ...o }; }
                      })}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[10px] transition-colors ${
                        active ? 'bg-[#fbbf24] text-[#1a1408] font-bold' : 'text-[#e8e4d8] hover:bg-[#111a2b]'
                      }`}
                    >
                      <span>{label}{detail ? <span className={`ml-1.5 text-[8px] ${active ? 'text-[#1a1408]/70' : 'text-[#5a6378]'}`}>{detail}</span> : null}</span>
                      <span className={active ? 'text-[#1a1408]/70' : 'text-[#5a6378]'}>{cost}</span>
                    </button>
                  );
                })}
              </div>
              {rc !== null && (
                <button
                  onClick={() => onAction(s => {
                    const c = s.cities.find(cc => cc.id === cityId);
                    if (!c || !c.production) return;
                    const cost2 = rushCost(s, c);
                    if (cost2 === null || s.civs[0].gold < cost2) return;
                    s.civs[0].gold -= cost2;
                    c.shieldsStored = productionCost(c.production);
                  })}
                  disabled={civ.gold < (rc ?? 0)}
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 border border-[#fbbf24]/40 bg-[#1a1408] py-1.5 text-[10px] tracking-wider text-[#fbbf24] transition-colors hover:bg-[#fbbf24] hover:text-[#1a1408] disabled:opacity-30"
                >
                  <Zap size={10} /> RUSH BUILD — {rc} GOLD
                </button>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-[9px] tracking-[0.2em] text-[#5a6378]">CITY IMPROVEMENTS</div>
              {city.buildings.length === 0 && <p className="text-[10px] text-[#5a6378]">None yet.</p>}
              {city.buildings.map(b => (
                <div key={b} className="mb-1 border-l-2 border-[#b98a3e] bg-[#111a2b] px-2 py-1">
                  <div className="text-[10px] text-[#e8e4d8]">{BUILDINGS[b].name}</div>
                  <div className="text-[8px] text-[#5a6378]">{BUILDINGS[b].desc}</div>
                </div>
              ))}
              <div className="mb-1.5 mt-3 text-[9px] tracking-[0.2em] text-[#5a6378]">GARRISON</div>
              {garrison.length === 0 && <p className="text-[10px] text-[#f87171]">Unguarded!</p>}
              <div className="flex flex-wrap gap-1">
                {garrison.map(u => (
                  <span key={u.id} className="border border-[#1a2540] bg-[#111a2b] px-1.5 py-0.5 text-[9px] text-[#e8e4d8]">
                    {UNIT_TYPES[u.typeId].name}{u.fortified ? ' (F)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
