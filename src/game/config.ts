/**
 * Tunable gameplay constants. Kept in one place for easy iteration.
 */

// Arena
export const ARENA_RADIUS = 34;
export const ARENA_WALL_HEIGHT = 9;
export const ARENA_CELL = 6; // pillar grid spacing

// Player movement
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 4.6;
export const SPRINT_SPEED = 8.4;
export const CROUCH_SPEED = 2.4;
export const ACCEL = 55;
export const FRICTION = 12;
export const JUMP_VELOCITY = 6.6;
export const GRAVITY = 18;
export const MAX_FALL = 26;
export const STAMINA_SPRINT_DRAIN = 14; // per sec
export const STAMINA_REGEN = 11; // per sec
export const STAMINA_JUMP_COST = 12;
export const STAMINA_DODGE_COST = 28;
export const STAMINA_REGEN_DELAY = 0.8; // sec after sprint/dodge before regen
export const DODGE_SPEED = 13;
export const DODGE_DURATION = 0.34;
export const DODGE_COOLDOWN = 0.95;
export const DODGE_I_FRAMES = 0.26; // invuln window during dodge
export const PARRY_WINDOW = 0.22; // sec window to parry after pressing
export const PARRY_COOLDOWN = 1.4;
export const PARRY_DAMAGE = 55;

// Combat
export const COMBO_WINDOW = 1.0; // sec between hits to keep combo
export const COMBO_MAX = 99;

// Health
export const HEALTH_REGEN = 0; // passive regen off by default; upgrades can enable
export const HEALTH_REGEN_DELAY = 6.0;
export const HEALTH_REGEN_RATE = 3.5;

// Flashlight
export const FLASHLIGHT_INTENSITY = 3.2;
export const FLASHLIGHT_BATTERY_DRAIN = 1.6; // per sec while on
export const FLASHLIGHT_BATTERY_MAX = 100;
export const FLASHLIGHT_BATTERY_REGEN = 2.2; // passive regen when off
export const FLASHLIGHT_REACH = 30;

// Waves (legacy — kept for compatibility but superseded by level flow)
export const WAVE_INTERMISSION = 6; // sec between waves
export const BOSS_EVERY = 5; // boss on every Nth wave

// ---- Maze / Level system -------------------------------------------------
export const MAZE_CELL_SIZE = 4.2; // world units per maze cell
export const MAZE_WALL_HEIGHT = 4;
export const MAZE_BASE_COLS = 11; // odd number, grows with level
export const MAZE_BASE_ROWS = 11;
export const MAZE_MAX_COLS = 21;
export const MAZE_MAX_ROWS = 21;
export const MAZE_GROWTH = 2; // cols/rows increase every N levels
export const MAZE_DEAD_END_LOOT_CHANCE = 0.35;
export const KEYCARD_LEVEL = true; // keycard required to unlock descent
export const MAX_LEVELS = 50; // 50+ level depth target
export const BOSS_LEVEL_INTERVAL = 10; // boss arena every Nth level
export const LEVEL_ENEMY_BASE = 3; // base enemy count per maze level
export const LEVEL_ENEMY_GROWTH = 1.4; // enemies added per level
export const LEVEL_HEALTH_SCALE = 1.18; // enemy HP multiplier per level
export const LEVEL_DAMAGE_SCALE = 1.08; // enemy damage multiplier per level

// ---- Boss weapon drops ---------------------------------------------------
export const BOSS_WEAPONS: Record<number, { id: string; name: string; description: string }> = {
  10: { id: 'greatsword', name: 'Abyssal Greatsword', description: 'Heavy blade with a parry-slam shockwave' },
  20: { id: 'energyblade', name: 'Energy Blade', description: 'Deflects projectiles back at foes' },
  30: { id: 'plasmachain', name: 'Plasma Chainblade', description: 'Whirling chain that hits all around you' },
  40: { id: 'voidreaper', name: 'Void Reaper', description: 'Phantom scythe that cleaves through enemies' },
  50: { id: 'leviathan', name: 'Leviathan Fang', description: 'The ultimate blade of the deep' },
};

// ---- Style meter ---------------------------------------------------------
export const STYLE_DECAY = 2.2; // points per sec decay
export const STYLE_HIT_GAIN = 12;
export const STYLE_PARRY_GAIN = 28;
export const STYLE_KILL_GAIN = 20;
export const STYLE_RATINGS = ['C', 'B', 'A', 'S', 'ULTRA'] as const;
export const STYLE_THRESHOLDS = [0, 30, 60, 100, 160]; // cumulative points

// ---- Jumpscare -----------------------------------------------------------
export const JUMPSCARE_DURATION = 0.5; // sec visual flash
export const JUMPSCARE_TRIGGER_CHANCE = 0.5; // chance when entering a hidden tile

// Colors / palette
export const PALETTE = {
  fog: 0x0a0a12,
  ambient: 0x1a1822,
  ground: 0x141417,
  pillar: 0x202028,
  wall: 0x16161c,
  blood: 0x6b0f0f,
  ember: 0xff5722,
  bloodGlow: 0xb91c1c,
  bossGlow: 0x7c1d1d,
  health: 0xb91c1c,
  stamina: 0x3b82f6,
  accent: 0xea580c,
  parry: 0xeab308,
};
