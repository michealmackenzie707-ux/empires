import type { GameState, Tile, Unit } from '../game/types';
import { idx } from '../game/types';
import { UNIT_TYPES, terrainYield } from '../game/data';
import { selectNextUnit, foundCity } from '../game/engine';
import { Minimap } from './Minimap';
import { Shield, Sword, Footprints, Flag, Moon, SkipForward, Trash2 } from 'lucide-react';

export interface HoverTileInfo {
  x: number; y: number; tile: Tile; units: Unit[];
}

interface Props {
  state: GameState;
  hover: HoverTileInfo | null;
  onAction: (fn: (s: GameState) => void) => void;
  onEndTurn: () => void;
  onJump: (x: number, y: number) => void;
}

export function RightPanel({ state, hover, onAction, onEndTurn, onJump }: Props) {
  const sel = state.units.find(u => u.id === state.selectedUnitId && u.civId === 0);
  const selDef = sel ? UNIT_TYPES[sel.typeId] : null;
  const unitsWaiting = state.units.filter(u => u.civId === 0 && u.movesLeft > 0 && !u.fortified && !u.skipping).length;

  return (
    <aside className="flex w-[284px] shrink-0 flex-col border-l border-[#1a2540] bg-[#0c1220] font-mono">
      <div className="border-b border-[#1a2540] p-2">
        <Minimap state={state} onJump={onJump} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-[#1a2540]">
          <div className="border-b border-[#1a2540] px-3 py-1.5 text-[9px] font-semibold tracking-[0.22em] text-[#5a6378]">
            SELECTED UNIT
          </div>
          {sel && selDef ? (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#f2f0e6]">{selDef.name}</span>
                <span className="text-[10px] text-[#8a8f9e]">({sel.x},{sel.y})</span>
              </div>
              <div className="mt-1.5 flex gap-4 text-[10px] text-[#8a8f9e]">
                <span className="flex items-center gap-1"><Sword size={10} className="text-[#f87171]" /> {selDef.attack}</span>
                <span className="flex items-center gap-1"><Shield size={10} className="text-[#4d9de0]" /> {selDef.defense}{sel.fortified ? ' ×1.5' : ''}</span>
                <span className="flex items-center gap-1"><Footprints size={10} className="text-[#34d399]" /> {Math.floor(sel.movesLeft)}/{selDef.moves}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {selDef.isSettler && (
                  <ActionBtn icon={<Flag size={10} />} label="FOUND CITY"
                    onClick={() => onAction(s => { const u = s.units.find(x => x.id === sel.id); if (u) foundCity(s, u); })} />
                )}
                {!sel.fortified && !selDef.isSettler && (
                  <ActionBtn icon={<Shield size={10} />} label="FORTIFY"
                    onClick={() => onAction(s => { const u = s.units.find(x => x.id === sel.id); if (u) { u.fortified = true; u.movesLeft = 0; } })} />
                )}
                {sel.fortified && (
                  <ActionBtn icon={<Moon size={10} />} label="WAKE"
                    onClick={() => onAction(s => { const u = s.units.find(x => x.id === sel.id); if (u) { u.fortified = false; u.fortifiedTurns = 0; } })} />
                )}
                <ActionBtn icon={<SkipForward size={10} />} label="SKIP"
                  onClick={() => onAction(s => { const u = s.units.find(x => x.id === sel.id); if (u) { u.skipping = true; u.movesLeft = 0; } selectNextUnit(s); })} />
                <ActionBtn icon={<Trash2 size={10} />} label="DISBAND"
                  onClick={() => onAction(s => { const i = s.units.findIndex(x => x.id === sel.id); if (i >= 0) s.units.splice(i, 1); s.selectedUnitId = null; })} />
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-[#5a6378]">
                Click a highlighted tile to move. Click an enemy to attack.
              </p>
            </div>
          ) : (
            <p className="px-3 py-3 text-[10px] leading-relaxed text-[#5a6378]">
              {unitsWaiting > 0 ? 'Select one of your units on the map.' : 'No unit selected.'}
            </p>
          )}
        </div>

        <div>
          <div className="border-b border-[#1a2540] px-3 py-1.5 text-[9px] font-semibold tracking-[0.22em] text-[#5a6378]">
            TERRAIN
          </div>
          <div className="px-3 py-2 text-[10px] leading-relaxed">
            {hover && state.explored[idx(hover.x, hover.y, state.width)] ? (
              <HoverInfoView state={state} hover={hover} />
            ) : (
              <span className="text-[#5a6378]">Hover the map to inspect terrain.</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#1a2540] p-2">
        <button
          onClick={() => onAction(s => { selectNextUnit(s); })}
          disabled={unitsWaiting === 0}
          className="mb-1.5 w-full border border-[#1a2540] bg-[#111a2b] py-1.5 text-[10px] tracking-[0.18em] text-[#e8e4d8] transition-colors hover:border-[#fbbf24]/50 disabled:opacity-30"
        >
          NEXT UNIT ({unitsWaiting})
        </button>
        <button
          onClick={onEndTurn}
          disabled={state.aiThinking}
          className="w-full bg-[#fbbf24] py-2 text-[11px] font-bold tracking-[0.25em] text-[#1a1408] transition-colors hover:bg-[#ffd05a] disabled:opacity-40"
        >
          {state.aiThinking ? 'RIVALS MOVING…' : 'END TURN'}
        </button>
      </div>
    </aside>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 border border-[#1a2540] bg-[#111a2b] px-1 py-1.5 text-[9px] tracking-wider text-[#e8e4d8] transition-colors hover:border-[#fbbf24]/50 hover:text-[#fbbf24]"
    >
      {icon} {label}
    </button>
  );
}

function HoverInfoView({ state, hover }: { state: GameState; hover: HoverTileInfo }) {
  const t = hover.tile;
  const y = terrainYield(t.terrain, t.river);
  const i = idx(hover.x, hover.y, state.width);
  const visible = state.visible[i];
  const city = state.cities.find(c => c.x === hover.x && c.y === hover.y);
  return (
    <div>
      <div className="mb-1 text-[11px] capitalize text-[#e8e4d8]">
        {t.terrain}{t.river ? ' · river' : ''}
        <span className="text-[#5a6378]"> ({hover.x},{hover.y})</span>
      </div>
      <div className="text-[#8a8f9e]">{y.food} food · {y.shields} shields · {y.trade} trade</div>
      {city && visible && (
        <div className="mt-1" style={{ color: state.civs[city.civId].color }}>
          {city.name} — {state.civs[city.civId].name.split(' ')[0]} (size {city.size})
        </div>
      )}
      {visible && hover.units.length > 0 && (
        <div className="mt-1 text-[#8a8f9e]">
          {hover.units.map(u => (
            <div key={u.id} style={{ color: state.civs[u.civId].color }}>
              {UNIT_TYPES[u.typeId].name} — {state.civs[u.civId].name.split(' ')[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
