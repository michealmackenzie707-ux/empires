import { useRef, useState, useCallback } from 'react';
import type { GameState } from './game/types';
import { idx, cityAt } from './game/types';
import { UNIT_TYPES } from './game/data';
import { createGame, endTurn, findPath, moveUnitAlong, selectNextUnit } from './game/engine';
import { MapCanvas, type HoverInfo } from './components/MapCanvas';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { CityDialog } from './components/CityDialog';
import { TechDialog } from './components/TechDialog';
import { TitleScreen, EndScreen } from './components/Screens';

export default function App() {
  const stateRef = useRef<GameState | null>(null);
  const [, setVersion] = useState(0);
  const [started, setStarted] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [centerOn, setCenterOn] = useState<{ x: number; y: number; seq: number } | null>(null);
  const seqRef = useRef(0);

  const bump = useCallback(() => setVersion(v => v + 1), []);

  const mutate = useCallback((fn: (s: GameState) => void) => {
    if (!stateRef.current) return;
    fn(stateRef.current);
    bump();
  }, [bump]);

  const newGame = useCallback(() => {
    stateRef.current = createGame((Math.random() * 0xffffffff) >>> 0);
    setStarted(true);
    setHover(null);
    bump();
  }, [bump]);

  const centerOnTile = useCallback((x: number, y: number) => {
    setCenterOn({ x, y, seq: ++seqRef.current });
  }, []);

  const handleTileClick = useCallback((x: number, y: number) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'playing' && s.phase !== 'choose-research') return;
    if (s.aiThinking) return;

    const sel = s.units.find(u => u.id === s.selectedUnitId && u.civId === 0);

    // move / attack with selected unit
    if (sel && (x !== sel.x || y !== sel.y)) {
      const path = findPath(s, sel, x, y);
      if (path) {
        moveUnitAlong(s, sel, path);
        if (s.units.includes(sel) && sel.movesLeft <= 0) {
          selectNextUnit(s);
          const next = s.units.find(u => u.id === s.selectedUnitId);
          if (next) centerOnTile(next.x, next.y);
        }
        bump();
        return;
      }
    }

    // select own unit on tile (prefer one with moves)
    const mine = s.units.filter(u => u.x === x && u.y === y && u.civId === 0);
    if (mine.length > 0) {
      const withMoves = mine.find(u => u.movesLeft > 0 && !u.fortified) ?? mine[0];
      s.selectedUnitId = withMoves.id;
      bump();
      return;
    }

    // open own city
    const city = cityAt(s, x, y);
    if (city && city.civId === 0 && s.visible[idx(x, y, s.width)]) {
      s.openCityId = city.id;
      bump();
      return;
    }
  }, [bump, centerOnTile]);

  const handleEndTurn = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.aiThinking) return;
    if (!s.civs[0].research) {
      s.phase = 'choose-research';
      bump();
      return;
    }
    // small delay so the "rivals moving" state paints
    s.aiThinking = true;
    bump();
    setTimeout(() => {
      endTurn(s);
      bump();
      const next = s.units.find(u => u.id === s.selectedUnitId);
      if (next) centerOnTile(next.x, next.y);
    }, 120);
  }, [bump, centerOnTile]);

  const handlePickResearch = useCallback((techId: string) => {
    const s = stateRef.current;
    if (!s) return;
    s.civs[0].research = techId;
    s.phase = 'playing';
    selectNextUnit(s);
    bump();
  }, [bump]);

  if (!started || !stateRef.current) {
    return <TitleScreen onStart={newGame} />;
  }

  const state = stateRef.current;
  const player = state.civs[0];
  const needResearch = (state.phase === 'choose-research') || (state.phase === 'playing' && !player.research);
  const over = state.phase === 'victory' || state.phase === 'defeat';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050810] text-[#e8e4d8]">
      <TopBar
        state={state}
        onOpenResearch={() => mutate(s => { if (!s.civs[0].research) s.phase = 'choose-research'; else { s.civs[0].research = null; s.phase = 'choose-research'; } })}
        onNewGame={newGame}
      />
      <div className="flex min-h-0 flex-1">
        <LeftPanel
          state={state}
          onOpenCity={(id) => mutate(s => {
            const c = s.cities.find(cc => cc.id === id);
            if (c) { s.openCityId = id; centerOnTile(c.x, c.y); }
          })}
        />
        <main className="relative min-w-0 flex-1">
          <MapCanvas
            state={state}
            onTileClick={handleTileClick}
            onHover={setHover}
            centerOn={centerOn}
          />
          {/* status strip */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 border border-[#1a2540] bg-[#050810]/85 px-3 py-1 font-mono text-[9px] tracking-[0.2em] text-[#8a8f9e]">
            {state.aiThinking
              ? 'RIVAL EMPIRES ARE MOVING…'
              : state.selectedUnitId
                ? `${UNIT_TYPES[state.units.find(u => u.id === state.selectedUnitId)?.typeId ?? 'warrior'].name.toUpperCase()} AWAITING ORDERS`
                : 'SELECT A UNIT OR CITY'}
          </div>
        </main>
        <RightPanel
          state={state}
          hover={hover}
          onAction={mutate}
          onEndTurn={handleEndTurn}
          onJump={centerOnTile}
        />
      </div>

      {state.openCityId !== null && !over && (
        <CityDialog
          state={state}
          cityId={state.openCityId}
          onClose={() => mutate(s => { s.openCityId = null; })}
          onAction={mutate}
        />
      )}
      {needResearch && !over && <TechDialog state={state} onPick={handlePickResearch} />}
      {over && <EndScreen state={state} onRestart={newGame} />}
    </div>
  );
}
