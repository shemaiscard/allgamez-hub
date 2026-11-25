# AllGamez Hub

Gamez is a collection of 15 perceptual mini-games that test how well you judge angles, colors, areas, tempo and time without a ruler or a clock. Each round gives a score out of 100, and a run of five rounds ends with a letter rank you can share.

**Play it:** [alwaysgame.netlify.app](https://alwaysgame.netlify.app)

## The games

| Series | Focus | Games |
| --- | --- | --- |
| 1. Classic Instinct | Spatial and motion | Angle Draw, Line Split, Flash Count, Trajectory Drop, Steady Beat |
| 2. Color and Visual Acuity | Chroma and geometry | Hue Memory, Odd Tile Out, Area Match, Center of Mass, Alignment Level |
| 3. Time and Proportion | Tempo and ratios | Blind Stopwatch, Circle Fill, Speed Match, Grid Density, Interval Bisect |

## Modes

- **Daily series:** the targets come from the date, so every player gets the same puzzles each day.
- **Practice:** endless rounds with random targets.
- **Custom mix:** pick any five games and play them as one run.
- **Friend duel:** send a challenge link. The friend plays the same lineup, or swaps one or all five games, then sends a score back.

Progress, badges and daily streaks are saved in the browser. The app installs as a PWA and works offline after the first visit.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS 4, Motion, Lucide icons, vite-plugin-pwa (Workbox) and Bun.

## Run locally

```bash
bun install
bun run dev      # http://localhost:3000
bun run build    # production build in dist/
bun run test     # scoring, seeding and streak tests
bun run lint     # type check
```
