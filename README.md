# ABYSSAL — Horror Melee Survival

A browser-based **first-person horror melee combat game** built with **Three.js + TypeScript + React + Vite**. Survive 12 escalating waves of creatures in a fog-shrouded arena, parry and dodge through melee combat, choose boons between waves, and slay the Warden.

No external 3D models or audio files — all geometry, textures, and sound are **generated procedurally** at runtime, so the game is fully self-contained and deploys cleanly to GitHub Pages.

---

## Play

- **Local dev:** `npm install` then `npm run dev`
- **Production build:** `npm run build` → static files in `dist/`
- **GitHub Pages:** push to `main`; the included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically. The Vite `base` is set to `'./'` so it works under any project subpath.

> Click **Enter the Arena** to start. The browser will request pointer lock — click the canvas if it doesn't grab automatically.

---

## Controls

| Input | Action |
|-------|--------|
| **WASD** | Move |
| **Mouse** | Look |
| **Shift** | Sprint (drains stamina) |
| **Space** | Jump / Dodge (tap while moving to dodge with i-frames) |
| **LMB** | Attack — chain hits to build combos |
| **RMB** | Parry — time it during an enemy's windup to stagger & deal heavy damage + restore stamina |
| **F** | Toggle flashlight (battery drains while on, regenerates while off) |
| **Esc** | Pause |

---

## Features

- **First-person controller** — mouse look, WASD, sprint, jump, gravity, arena collision, head bob.
- **Melee combat** — combos, arc-based hit detection, knockback, parrying (timed window), dodging (i-frames), lifesteal.
- **Enemy AI** — finite-state machine: Patrol → Alert → Chase → Attack → Stagger → Dead. Three enemy types + a boss:
  - **Shambler** (grunt) — slow, durable
  - **Stalker** — fast, fragile, aggressive
  - **Brute** — heavy hitter, high health
  - **The Warden** (boss) — two phases, enrage below 50% HP, periodic roars, appears every 5th wave
- **Wave survival** — 12 waves with scaling counts & enemy mix, paced spawns, intermissions.
- **Upgrade system** — after each cleared wave, pick 1 of 3 randomized boons (common/rare/epic) that modify damage, attack speed, health, stamina, move speed, dodge cooldown, regen, lifesteal, or unlock new weapons.
- **Atmosphere** — exponential fog, dynamic shadows, dim moonlight, flashlight spotlight with shadows + battery + flicker, ember lanterns, grain & vignette overlays, exposure dips at low health.
- **Effects** — pooled blood/spark particles, camera shake (trauma-based), sword trail, ground blood decals, impact point-light flashes.
- **Audio** — fully synthesized via Web Audio API: swing whooshes, impacts, parry clangs, enemy growls (spatial panning), boss roars, ambience drone + wind + heartbeat, UI sounds. No audio files.
- **UI** — main menu, settings (volume/sensitivity/FOV/invert-Y/FPS), HUD (health/stamina bars, combo, cooldown pips, boss bar, wave banners, score), pause menu, upgrade screen, victory/death screen with run stats.
- **Performance** — pooled particles, single shadow-casting spotlight, capped pixel ratio, manual three.js chunking, throttled HUD updates.

---

## Project Structure

```
src/
  game/
    Game.ts              # Central orchestrator + render loop
    GameState.ts         # Observable store bridging engine <-> React
    types.ts             # Shared types & defaults
    config.ts            # Tunable constants
    utils.ts             # Math/easing helpers
    core/
      Engine.ts          # Renderer, scene, camera, fog, lights, shadows
      InputManager.ts    # Keyboard/mouse/pointer-lock
      AssetFactory.ts    # Procedural arena/enemy/weapon meshes & materials
    player/
      Player.ts          # FP controller: movement, stamina, dodge, stats
      Weapon.ts          # Weapon defs + view-model animation
      Flashlight.ts      # SpotLight + battery + flicker
    combat/
      CombatController.ts# Attacks, combos, parry, hit detection
    enemies/
      Enemy.ts           # Base AI state machine + Grunt/Stalker/Brute/Boss
    waves/
      WaveManager.ts     # Wave composition, spawning, boss scheduling
    upgrades/
      UpgradeSystem.ts   # Upgrade definitions + random rolls
    effects/
      Effects.ts         # Particles, camera shake, trail, decals
    audio/
      AudioManager.ts    # Synthesized SFX + ambience (Web Audio)
  ui/
    HUD.tsx              # In-game overlay
    MainMenu.tsx         # Title screen
    SettingsScreen.tsx   # Settings
    PauseMenu.tsx        # Pause overlay
    UpgradeScreen.tsx    # Boon selection
    EndScreen.tsx        # Victory/death + stats
  App.tsx                # Root: mounts engine + renders UI by phase
  main.tsx               # React entry
  index.css              # Horror theme styles
```

---

## Continuing Development

The codebase is modular by design:

- **Add an enemy type:** create a subclass of `Enemy` in `src/game/enemies/Enemy.ts`, give it a body via `AssetFactory`, and register it in `createEnemy()`. Add it to the wave composition in `WaveManager.buildWave()`.
- **Add an upgrade:** append an `UpgradeDef` to `UPGRADES` in `src/game/upgrades/UpgradeSystem.ts` with an `apply(player)` callback.
- **Add a weapon:** add an entry to `WEAPONS` in `src/game/player/Weapon.ts` and a viewmodel in `AssetFactory`.
- **Tune gameplay:** most balance knobs live in `src/game/config.ts`.
- **Add persistence:** the project includes Supabase support; wire a high-score table through the existing `GameState.lastRun`.
