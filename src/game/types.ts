/**
 * Central type definitions shared across the game.
 */

export type GamePhase =
  | 'menu'
  | 'cutscene'
  | 'playing'
  | 'paused'
  | 'upgrade'
  | 'codex'
  | 'story'
  | 'gameover'
  | 'victory';

export interface Settings {
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  sensitivity: number; // 0.1..3
  invertY: boolean;
  fov: number; // 70..100
  showFps: boolean;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
}

export interface HudState {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  wave: number; // kept for compatibility, maps to level
  level: number; // current level depth (1-based)
  levelDepth: number; // total levels planned
  enemiesRemaining: number;
  enemiesTotalThisWave: number;
  score: number;
  kills: number;
  currency: number;
  comboCount: number;
  comboTimer: number; // 0..1 fraction of time remaining
  weaponName: string;
  parryReady: boolean; // true when parry available
  parryCooldown: number; // 0..1
  dodgeReady: boolean;
  dodgeCooldown: number; // 0..1
  bossActive: boolean;
  bossName: string;
  bossHealth: number;
  bossMaxHealth: number;
  waveBanner: string;
  bannerSubtext: string;
  damageFlash: number; // 0..1 red vignette intensity
  healFlash: number; // 0..1 green vignette intensity
  staminaFlash: number; // 0..1
  hitMarker: number; // 0..1 intensity of hit marker
  parryFlash: number; // 0..1
  // Maze / level
  flashlightBattery: number; // 0..100
  hasKeycard: boolean;
  isBossLevel: boolean;
  bossWeaponName: string; // weapon granted for boss level
  // Style meter
  styleRating: string; // '', 'C', 'B', 'A', 'S', 'ULTRA'
  styleMeter: number; // 0..1 build toward next rating
  // Jumpscare
  jumpscareFlash: number; // 0..1
  // Codex
  codexCount: number;
  codexTotal: number;
}

export interface UpgradeChoice {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
  icon: string; // lucide icon name
}

export interface RunResult {
  waveReached: number;
  levelReached: number;
  kills: number;
  score: number;
  victory: boolean;
}

// A lightweight handle for enemies that the UI/serialization cares about.
export interface EnemyMeta {
  id: number;
  type: string;
  isBoss: boolean;
}

// ---- Lore / Codex ---------------------------------------------------------

export type CollectibleType = 'audio_log' | 'terminal' | 'note';

export interface LoreEntry {
  id: string;
  title: string;
  type: CollectibleType;
  text: string;
  /** Which level range this can appear in (inclusive). */
  minLevel: number;
  maxLevel: number;
}

export interface CodexEntry {
  entry: LoreEntry;
  collected: boolean;
}

// ---- Boss weapon drops ----------------------------------------------------

export interface BossWeaponDrop {
  level: number;
  weaponId: string;
  weaponName: string;
  description: string;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.5,
  sensitivity: 1.0,
  invertY: false,
  fov: 80,
  showFps: false,
};

export const DEFAULT_HUD: HudState = {
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  wave: 0,
  level: 0,
  levelDepth: 50,
  enemiesRemaining: 0,
  enemiesTotalThisWave: 0,
  score: 0,
  kills: 0,
  currency: 0,
  comboCount: 0,
  comboTimer: 0,
  weaponName: 'Rusted Cleaver',
  parryReady: true,
  parryCooldown: 0,
  dodgeReady: true,
  dodgeCooldown: 0,
  bossActive: false,
  bossName: '',
  bossHealth: 0,
  bossMaxHealth: 0,
  waveBanner: '',
  bannerSubtext: '',
  damageFlash: 0,
  healFlash: 0,
  staminaFlash: 0,
  hitMarker: 0,
  parryFlash: 0,
  flashlightBattery: 100,
  hasKeycard: false,
  isBossLevel: false,
  bossWeaponName: '',
  styleRating: '',
  styleMeter: 0,
  jumpscareFlash: 0,
  codexCount: 0,
  codexTotal: 0,
};
