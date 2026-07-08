# VoxelCraft: Aurora Realms

> An original, AAA-inspired Minecraft-style voxel sandbox built with **Three.js**, **TypeScript**, and **Vite** — designed as a polished browser game rather than a static tech demo.

![Three.js](https://img.shields.io/badge/Three.js-000000?logo=three.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

## Live Demo

Production deployment: **coming online during release**

This README is updated with the stable Vercel URL after deployment.

## Overview

**VoxelCraft: Aurora Realms** is a handcrafted browser voxel sandbox inspired by the joy of Minecraft-like exploration, but implemented from scratch with Three.js rendering primitives and TypeScript game systems. The world is procedurally generated, rendered with instanced voxel meshes, and supports real gameplay: movement, collision, mining, placing, inventory counts, day/night lighting, water, foliage, particles, HUD, minimap, cinematic camera, and mobile controls.

The goal is to feel like a polished playable vertical slice: an instantly understandable voxel world with enough atmosphere, responsiveness, and systemic interaction to be fun immediately.

## Highlights

- **Real playable voxel sandbox** — not a static scene or screenshot.
- **Procedural island terrain** — value-noise + fractal Brownian motion terrain, island falloff, beaches, lagoons, ore pockets, and scenic elevation changes.
- **Instanced voxel rendering** — exposed-face culling and one instanced mesh per block type for efficient rendering.
- **Mine and build loop** — raycast block targeting, highlight outline, left-click mining, right-click placing, inventory accounting, and particle feedback.
- **12 authored block identities** — moss grass, rich soil, blue granite, shore sand, water, cedar log, glow leaves, sky glass, star ore, aether crystal, sun lantern, and castle brick.
- **Procedural textures** — all block textures are generated in code; no external asset downloads are required.
- **Physics-based avatar** — gravity, jump, sprint, creative flight, and AABB collision against voxels.
- **Cinematic lighting** — dynamic sky dome, day/night cycle, moving sun and moon, fog, stars, emissive crystals, and lantern glow.
- **Environmental detail** — voxel trees, flowers, clouds, water, fireflies, and a hand-authored spawn plaza.
- **Premium HUD** — glassmorphism hotbar, live biome/altitude/world stats, toasts, and a live minimap.
- **Camera modes** — first-person pointer lock, third-person toggle, and cinematic tour mode.
- **Responsive/mobile support** — touch joystick and mobile jump/mine/place/camera controls.

## Gameplay Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move |
| Mouse | Look around after entering pointer lock |
| Click canvas | Lock pointer / focus the world |
| `Space` | Jump, or fly up in creative flight |
| `Shift` | Sprint |
| Left click | Mine the highlighted block |
| Right click | Place the selected block |
| `1`–`9` | Select hotbar slot |
| `M` | Toggle minimap |
| `V` | Toggle first/third-person camera |
| `F` | Toggle creative flight |
| `Esc` | Pause / show menu |
| Mobile joystick | Move on touch devices |
| Mobile buttons | Jump, mine, place, and look controls |

## Tech Stack

- **Three.js** — WebGL renderer, instanced meshes, PBR-ish standard materials, shadows, fog, custom sky shader, tone mapping.
- **TypeScript** — game state, world generation, physics, rendering, UI, and QA hooks.
- **Vite** — fast local development and production bundling.
- **pnpm** — locked package manager workflow.
- **Vercel** — production static deployment.

## Architecture

The implementation is intentionally compact and inspectable:

```text
voxelcraft/
├── index.html              # Vite HTML shell
├── package.json            # scripts and dependencies
├── vercel.json             # reproducible Vercel build settings
├── src/
│   ├── main.ts             # world generation, renderer, controls, physics, HUD
│   ├── style.css           # responsive glassmorphism UI and mobile controls
│   ├── assets/             # reserved for future authored assets
│   ├── player/             # reserved for future player modules
│   ├── render/             # reserved for future renderer modules
│   ├── ui/                 # reserved for future UI modules
│   └── world/              # reserved for future world modules
└── public/                 # static public assets
```

Core systems currently live in `src/main.ts` so the vertical slice is easy to review as one cohesive game loop. The folder structure leaves room to split world generation, rendering, UI, and player code into modules as the project grows.

## Local Development

### Requirements

- Node.js 22+
- pnpm 11+

This repo was built and verified with Node `v22.22.1` and pnpm `11.9.0`.

### Install

```bash
pnpm install
```

### Run the dev server

```bash
pnpm dev
```

Open:

```text
http://127.0.0.1:5188/
```

### Typecheck and production build

```bash
pnpm build
```

### Preview the production build

```bash
pnpm preview
```

Open:

```text
http://127.0.0.1:5189/
```

## Deployment

The project includes a `vercel.json` for reproducible Vercel builds:

```json
{
  "framework": "vite",
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

Deploy manually with:

```bash
pnpm dlx vercel@latest deploy --prod
```

Vercel auto-detects this as a Vite static app and serves the compiled `dist/` output.

## Verification Evidence

The current build has been exercised locally with real browser checks:

- `pnpm build` completed successfully with TypeScript + Vite production build.
- Browser loaded the game at `http://127.0.0.1:5188/` with title `VoxelCraft: Aurora Realms`.
- Generated world contained `38,104` blocks in the verified run.
- Spawn, gravity, movement, and collision were checked through runtime QA hooks.
- Mining and placing were verified by block-count and inventory deltas:
  - grass inventory `32 → 33` after mining
  - world block count `38104 → 38103` after mining
  - world block count `38103 → 38104` after placing
  - grass inventory `33 → 32` after placing
- Runtime error hook returned an empty array during verification.

## Roadmap Ideas

- Chunk streaming and infinite terrain paging.
- Save/load world state.
- More block families, tools, crafting, and structure generation.
- Ambient audio and positional sound effects.
- Multiplayer prototype with authoritative server reconciliation.
- Modularize current vertical-slice systems into separate world/render/player/ui packages.

## License

No open-source license has been selected yet. All rights are reserved unless a license file is added later.

## Credits

Built as an original Three.js voxel sandbox vertical slice. It is inspired by the genre language of Minecraft-like games but does not use Minecraft assets, code, textures, names, or copyrighted content.
