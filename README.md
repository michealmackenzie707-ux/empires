# Empires

A Civilization I-inspired turn-based 4X strategy game for the browser.

Built with React 19 + TypeScript + Vite. The game map renders to `<canvas>`;
UI panels use Tailwind CSS. All game logic is framework-free TypeScript in `src/game/`.

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build   # outputs to dist/
```

## Project layout

```
src/
  game/
    types.ts    # core data types (tiles, units, cities, civs)
    data.ts     # unit/building/tech definitions, terrain yields, civ roster
    mapgen.ts   # procedural map generation (value noise, rivers, continents)
    engine.ts   # game rules: movement, combat, cities, research, turns
    ai.ts       # rival empire AI (settling, hunting, garrisoning)
  components/
    MapCanvas.tsx   # canvas renderer: terrain, fog of war, units, cities
    Minimap.tsx     # overview minimap
    TopBar.tsx      # turn / year / gold / research bar
    LeftPanel.tsx   # empire stats, city list, chronicle log
    RightPanel.tsx  # unit actions, terrain inspector, end turn
    CityDialog.tsx  # city management (production, rush-buy)
    TechDialog.tsx  # research chooser
    Screens.tsx     # title screen + victory/defeat screen
```

## Gameplay

- Start in 4000 BC with Settlers and a Warrior
- Found cities, grow population, research 10 technologies
- 8 unit types, terrain defense bonuses, fortification, city capture with tech theft
- 3 AI rival empires (Babylonian, Egyptian, Aztec)
- Victory: eliminate all rivals, or highest score at turn 250
