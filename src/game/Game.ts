/**
 * Game — the central orchestrator for ABYSSAL.
 *
 * Owns the engine, player, combat, level manager, enemies, projectiles,
 * effects, audio, story, and jumpscare systems. Bridges imperative game
 * state to the React UI through GameState.
 *
 * Lifecycle:
 *   new Game(container, settings)
 *   -> start()              (menu phase, orbit camera)
 *   -> startNewRun()        (triggers cutscene → level 1)
 *   -> after cutscene: beginLevel(1)
 *   -> pause()/resume()
 *   -> selectUpgrade(id)    (post-boss)
 *   -> descendToNextLevel() (after keycard + elevator)
 *   -> dispose()
 */
import * as THREE from 'three';
import { Engine } from '@/game/core/Engine';
import { InputManager } from '@/game/core/InputManager';
import { AssetFactory } from '@/game/core/AssetFactory';
import { Player } from '@/game/player/Player';
import { CombatController } from '@/game/combat/CombatController';
import { LevelManager, type MazeLevelSetup } from '@/game/waves/LevelManager';
import { WaveManager } from '@/game/waves/WaveManager';
import {
  Enemy,
  BossEnemy,
  createEnemy,
  createMazeEnemy,
  ProjectileManager,
  type EnemySpawnType,
} from '@/game/enemies/Enemy';
import { UpgradeSystem, type UpgradeDef } from '@/game/upgrades/UpgradeSystem';
import { Effects } from '@/game/effects/Effects';
import { AudioManager } from '@/game/audio/AudioManager';
import { StorySystem } from '@/game/story/StorySystem';
import { JumpscareSystem } from '@/game/horror/JumpscareSystem';
import { MazeBuilder, type MazeLevel } from '@/game/maze/MazeBuilder';
import { gameState } from '@/game/GameState';
import {
  DEFAULT_HUD,
  type GamePhase,
  type HudState,
  type Settings,
  type LoreEntry,
} from '@/game/types';
import { PALETTE, MAX_LEVELS } from '@/game/config';
import { clamp } from '@/game/utils';

interface Collectible {
  mesh: THREE.Object3D;
  entry: LoreEntry;
  collected: boolean;
  x: number;
  z: number;
}

export class Game {
  private engine: Engine;
  private input: InputManager;
  private assets: AssetFactory;
  private effects: Effects;
  private audio: AudioManager;
  private player: Player;
  private combat: CombatController;
  private levels: LevelManager;
  private waves: WaveManager; // used for boss waves / adds
  private upgrades: UpgradeSystem;
  private story: StorySystem;
  private jumpscares: JumpscareSystem;
  private projectiles: ProjectileManager;

  private container: HTMLElement;
  private settings: Settings;

  private rafId = 0;
  private running = false;
  private phase: GamePhase = 'menu';
  private pendingUpgradeChoices: UpgradeDef[] = [];

  private currentSetup: MazeLevelSetup | null = null;
  private currentMazeLevel: MazeLevel | null = null;
  private enemies: Enemy[] = [];
  private collectibles: Collectible[] = [];
  private keycardMesh: THREE.Object3D | null = null;
  private elevatorMesh: THREE.Object3D | null = null;
  private hasKeycard = false;

  private menuArena!: THREE.Group;

  // Atmospheric flicker
  private fogPulseTime = 0;
  private exposureBase = 0.95;

  // Score tracking
  private score = 0;
  private currency = 0;
  private kills = 0;
  private comboCount = 0;

  // UI flash decays
  private damageFlash = 0;
  private healFlash = 0;
  private staminaFlash = 0;
  private bannerTimer = 0;

  private hudAccumulator = 0;

  private boundPointerLockChange: (locked: boolean) => void;

  constructor(container: HTMLElement, settings: Settings) {
    this.container = container;
    this.settings = settings;
    this.engine = new Engine(container, settings);
    this.input = new InputManager(container);
    this.assets = new AssetFactory();
    this.effects = new Effects(this.engine.scene);
    this.audio = new AudioManager(settings);
    this.player = new Player(
      this.engine.camera,
      this.input,
      this.assets,
      this.effects,
      settings,
    );
    this.combat = new CombatController(this.player, this.input, this.effects, this.audio);
    this.levels = new LevelManager(this.engine.scene, this.assets);
    this.waves = new WaveManager(
      this.player,
      this.assets,
      this.effects,
      this.audio,
      this.engine.scene,
    );
    this.upgrades = new UpgradeSystem(this.player);
    this.story = new StorySystem();
    this.projectiles = new ProjectileManager(
      this.engine.scene,
      this.player,
      this.effects,
      this.audio,
    );
    this.jumpscares = new JumpscareSystem(
      this.audio,
      this.effects,
      this.player,
      this.player.flashlight,
    );

    this.player.setFootstepCallback((running) => this.audio.footstep(running));
    this.wireCallbacks();

    this.boundPointerLockChange = this.handlePointerLockChange.bind(this);
    this.input.setLockChangeHandler(this.boundPointerLockChange);

    this.buildMenuArena();

    gameState.setCodexEntries(this.story.codexEntries);
  }

  // ---- Setup ---------------------------------------------------------------

  private wireCallbacks(): void {
    this.combat.setCallbacks({
      onComboChange: (count) => {
        this.comboCount = count;
      },
      onEnemyKilled: (e) => {
        this.kills++;
        this.score += 50;
        if (e.isBoss) {
          this.onBossDefeated();
        }
      },
      onScore: (n) => {
        this.score += n;
      },
      onCurrency: (n) => {
        this.currency += n;
      },
      onStyleChange: (_rating, _meter) => {
        // pushed via HUD push
      },
    });

    this.waves.setCallbacks({
      onWaveStart: () => {},
      onWaveCleared: () => {},
      onVictory: () => {},
      onBossSpawn: () => {},
      onBossUpdate: () => {},
    });
  }

  private buildMenuArena(): void {
    this.menuArena = this.assets.createArena(34);
    this.engine.scene.add(this.menuArena);
  }

  // ---- Lifecycle -----------------------------------------------------------

  start(): void {
    this.running = true;
    this.audio.resume();
    this.audio.startAmbience();
    this.loop();
  }

  /** Trigger the opening cutscene, which transitions to level 1 on finish. */
  startNewRun(): void {
    this.audio.resume();
    this.player.reset();
    this.combat.reset();
    this.enemies.forEach((e) => e.dispose(this.engine.scene));
    this.enemies = [];
    this.projectiles.reset();
    this.story.reset();
    this.score = 0;
    this.currency = 0;
    this.kills = 0;
    this.comboCount = 0;
    this.hasKeycard = false;
    this.damageFlash = 0;
    this.healFlash = 0;
    this.staminaFlash = 0;
    this.levels.reset();
    gameState.setCodexEntries(this.story.codexEntries);
    this.setPhase('cutscene');
  }

  /** Begin a specific level (called after cutscene or on descent). */
  beginLevel(level: number): void {
    // Clear previous level
    this.clearLevelEntities();
    this.menuArena.visible = false;

    const setup = this.levels.buildLevel(level);
    this.currentSetup = setup;

    // Reset player to spawn
    if (setup.mazeLevel) {
      this.currentMazeLevel = setup.mazeLevel;
      this.player.collisionWalls = setup.mazeLevel.walls;
      this.player.position.set(setup.mazeLevel.spawnWorld.x, 1.7, setup.mazeLevel.spawnWorld.z);
      this.player.velocity.set(0, 0, 0);

      // Place collectibles in dead-ends
      this.placeCollectibles(setup);

      // Place keycard + elevator
      this.placeKeycardAndElevator(setup);

      // Seed jumpscare triggers from loot positions
      this.jumpscares.seedTriggers(setup.lootPositions);
    } else {
      // Boss arena — open circular bounds
      this.currentMazeLevel = null;
      this.player.collisionWalls = [];
      this.player.arenaBoundsRadius = 26;
      this.player.position.set(0, 1.7, 0);
      this.player.velocity.set(0, 0, 0);
      this.jumpscares.clearTriggers();

      // Grant boss weapon
      if (setup.bossWeapon) {
        this.player.weapon.switchTo(setup.bossWeapon.id as any);
        this.audio.bossWeaponUnlock();
        this.showBanner(setup.bossWeapon.name, setup.bossWeapon.description);
      }
    }

    // Spawn enemies
    this.spawnLevelEnemies(setup);

    this.hasKeycard = false;
    this.setPhase('playing');

    if (setup.isBoss) {
      this.showBanner(`BOSS — LEVEL ${level}`, 'The Warden awakens');
      this.audio.waveStart();
    } else {
      this.showBanner(`LEVEL ${level}`, setup.mazeLevel ? 'Find the keycard' : 'Descend');
      this.audio.waveStart();
    }

    this.input.requestLock();
  }

  private placeCollectibles(setup: MazeLevelSetup): void {
    if (!setup.mazeLevel) return;
    const positions = setup.lootPositions;
    for (const pos of positions) {
      const entry = this.story.pickEntryForLevel(setup.level);
      if (!entry) continue;
      const mesh = this.createCollectibleMesh(entry.type, pos.x, pos.z);
      this.engine.scene.add(mesh);
      this.collectibles.push({ mesh, entry, collected: false, x: pos.x, z: pos.z });
    }
  }

  private createCollectibleMesh(type: string, x: number, z: number): THREE.Object3D {
    let mesh: THREE.Object3D;
    if (type === 'audio_log') {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x1a3a5a, emissive: 0x0a1a2a, emissiveIntensity: 0.4 }),
      );
    } else if (type === 'terminal') {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.6, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, emissive: 0x2a1a0a, emissiveIntensity: 0.4 }),
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x5a4a3a, side: THREE.DoubleSide, emissive: 0x2a1a0a, emissiveIntensity: 0.2 }),
      );
    }
    mesh.position.set(x, 1.0, z);
    mesh.castShadow = true;
    return mesh;
  }

  private placeKeycardAndElevator(setup: MazeLevelSetup): void {
    if (!setup.mazeLevel) return;
    // Keycard
    if (setup.keycardWorld) {
      this.keycardMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.25, 0.05),
        new THREE.MeshStandardMaterial({
          color: 0xeab308,
          emissive: 0xeab308,
          emissiveIntensity: 0.6,
        }),
      );
      this.keycardMesh.position.set(setup.keycardWorld.x, 1.0, setup.keycardWorld.z);
      this.keycardMesh.castShadow = true;
      this.engine.scene.add(this.keycardMesh);
    }
    // Elevator (near spawn)
    if (setup.elevatorWorld) {
      this.elevatorMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.1, 24),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a3a,
          emissive: 0x1a1a2a,
          emissiveIntensity: 0.3,
        }),
      );
      this.elevatorMesh.position.set(setup.elevatorWorld.x, 0.06, setup.elevatorWorld.z);
      this.engine.scene.add(this.elevatorMesh);
    }
  }

  private spawnLevelEnemies(setup: MazeLevelSetup): void {
    if (setup.isBoss) {
      // Spawn the boss
      const boss = createEnemy('boss', this.player, this.assets, this.effects, this.audio) as BossEnemy;
      const ang = Math.random() * Math.PI * 2;
      const pos = new THREE.Vector3(Math.cos(ang) * 18, 0, Math.sin(ang) * 18);
      boss.spawn(pos, this.engine.scene);
      this.enemies.push(boss);
      return;
    }

    // Maze enemies
    for (let i = 0; i < setup.enemyCount; i++) {
      const type = setup.enemyTypes[i % setup.enemyTypes.length] as EnemySpawnType;
      const e = createMazeEnemy(
        type,
        this.player,
        this.assets,
        this.effects,
        this.audio,
        this.projectiles,
        setup.healthScale,
        setup.damageScale,
      );
      // Spawn at a far open cell
      if (setup.mazeLevel) {
        const far = MazeBuilder.farOpenCell(setup.mazeLevel, { x: this.player.position.x, z: this.player.position.z }, 10);
        if (far) {
          e.spawn(new THREE.Vector3(far.x, 0, far.z), this.engine.scene);
        } else {
          e.spawn(new THREE.Vector3(0, 0, 0), this.engine.scene);
        }
      }
      this.enemies.push(e);
    }
  }

  private clearLevelEntities(): void {
    for (const e of this.enemies) e.dispose(this.engine.scene);
    this.enemies = [];
    for (const c of this.collectibles) this.engine.scene.remove(c.mesh);
    this.collectibles = [];
    if (this.keycardMesh) {
      this.engine.scene.remove(this.keycardMesh);
      this.keycardMesh = null;
    }
    if (this.elevatorMesh) {
      this.engine.scene.remove(this.elevatorMesh);
      this.elevatorMesh = null;
    }
    this.projectiles.reset();
  }

  setPhase(phase: GamePhase): void {
    this.phase = phase;
    gameState.setPhase(phase);
    if (phase === 'playing') {
      this.input.requestLock();
    } else {
      this.input.exitLock();
    }
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase !== 'paused' && this.phase !== 'codex') return;
    this.setPhase('playing');
  }

  openCodex(): void {
    if (this.phase !== 'paused') return;
    this.setPhase('codex');
  }

  closeStoryModal(): void {
    gameState.setActiveStoryEntry(null);
    if (this.phase === 'story') this.setPhase('playing');
  }

  /** Show upgrade choices after a boss is defeated. */
  private enterUpgradePhase(): void {
    if (this.phase === 'gameover' || this.phase === 'victory') return;
    this.pendingUpgradeChoices = this.upgrades.rollChoices(3);
    gameState.setUpgradeChoices(
      this.pendingUpgradeChoices.map((u) => ({
        id: u.id,
        name: u.name,
        description: u.description,
        rarity: u.rarity,
        icon: u.icon,
      })),
    );
    this.setPhase('upgrade');
  }

  selectUpgrade(id: string): void {
    const def = this.pendingUpgradeChoices.find((u) => u.id === id);
    if (!def) return;
    this.upgrades.apply(this.player, def);
    this.audio.upgradeSelect();
    this.player.heal(25);
    this.healFlash = 0.6;
    this.pendingUpgradeChoices = [];
    // Descend to next level after boss
    const nextLevel = this.levels.currentLevel + 1;
    if (nextLevel > MAX_LEVELS) {
      this.endRun(true);
    } else {
      this.beginLevel(nextLevel);
    }
  }

  /** Called when the boss enemy is killed. */
  private onBossDefeated(): void {
    this.showBanner('BOSS DEFEATED', 'Choose your boon');
    this.audio.waveCleared();
    // Heal as reward
    this.player.heal(30);
    this.healFlash = 0.6;
    // Enter upgrade phase after a short delay
    setTimeout(() => this.enterUpgradePhase(), 1500);
  }

  /** Descend to the next level (called when player reaches elevator with keycard). */
  private descendToNextLevel(): void {
    const nextLevel = this.levels.currentLevel + 1;
    this.audio.elevatorDescend();
    if (nextLevel > MAX_LEVELS) {
      this.endRun(true);
      return;
    }
    this.beginLevel(nextLevel);
  }

  private endRun(victory: boolean): void {
    this.input.exitLock();
    gameState.setLastRun({
      waveReached: this.levels.currentLevel,
      levelReached: this.levels.currentLevel,
      kills: this.kills,
      score: this.score,
      victory,
    });
    if (victory) {
      this.audio.victory();
      this.setPhase('victory');
    } else {
      this.audio.gameOver();
      this.setPhase('gameover');
    }
  }

  restart(): void {
    this.startNewRun();
  }

  toMenu(): void {
    this.clearLevelEntities();
    this.levels.reset();
    this.player.reset();
    this.menuArena.visible = true;
    this.player.collisionWalls = [];
    this.player.arenaBoundsRadius = 34;
    this.setPhase('menu');
  }

  // ---- Input events --------------------------------------------------------

  private handlePointerLockChange(locked: boolean): void {
    if (!locked && this.phase === 'playing') {
      this.setPhase('paused');
    }
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.engine.setSettings(settings);
    this.player.setSettings(settings);
    this.audio.setSettings(settings);
    gameState.setSettings(settings);
  }

  // ---- Main loop -----------------------------------------------------------

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = this.engine.getDelta();

    if (this.phase === 'playing') {
      this.updatePlaying(dt);
    } else if (this.phase === 'menu') {
      this.effects.update(dt);
      this.updateMenuCamera(dt);
    } else {
      this.effects.update(dt);
    }

    // Atmospheric fog pulse always
    this.fogPulseTime += dt;
    const fogPulse =
      0.045 + Math.sin(this.fogPulseTime * 0.3) * 0.006 + Math.sin(this.fogPulseTime * 1.7) * 0.003;
    this.engine.setFogDensity(fogPulse);

    this.engine.render();
    this.input.endFrame();

    if (this.settings.showFps) {
      gameState.setFps(this.engine.getFps());
    }

    // Throttled HUD push (~20/sec) to avoid React thrash
    this.hudAccumulator += dt;
    if (this.hudAccumulator >= 0.05 && this.phase === 'playing') {
      this.hudAccumulator = 0;
      this.pushHud();
    }
  };

  private updatePlaying(dt: number): void {
    // Pause toggle
    if (this.input.wasPressed('Escape')) {
      this.pause();
      return;
    }
    // Codex toggle
    if (this.input.wasPressed('KeyJ')) {
      this.openCodex();
      return;
    }

    const prevHealth = this.player.health;
    const prevStamina = this.player.stamina;

    // Combat must run before movement (dodge suppresses jump)
    this.combat.setEnemies(this.getHittables());
    this.combat.update(dt);
    this.player.update(dt);
    this.projectiles.update(dt);

    // Update enemies
    for (const e of this.enemies) e.update(dt);

    // Cull dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.isFullyDead) {
        e.dispose(this.engine.scene);
        this.enemies.splice(i, 1);
      }
    }

    this.effects.update(dt);
    this.jumpscares.update(dt);

    // Interact: check collectibles, keycard, elevator
    this.checkInteractions();

    // Audio listener
    const fwd = this.player.getForwardXZ(new THREE.Vector3());
    this.audio.updateListener(this.player.position.x, this.player.position.z, fwd.x, fwd.z);

    // Flash triggers
    if (this.player.health < prevHealth) this.damageFlash = clamp(this.damageFlash + 0.5, 0, 1);
    if (this.player.health > prevHealth) this.healFlash = clamp(this.healFlash + 0.4, 0, 1);
    if (this.player.stamina < prevStamina - 15) this.staminaFlash = 0.5;

    // Decay flashes
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    this.healFlash = Math.max(0, this.healFlash - dt * 2);
    this.staminaFlash = Math.max(0, this.staminaFlash - dt * 2);

    if (this.bannerTimer > 0) this.bannerTimer -= dt;

    // Exposure dips when low health
    const lowHp = clamp(1 - this.player.health / this.player.maxHealth, 0, 1);
    this.engine.setExposure(this.exposureBase - lowHp * 0.25);

    // Death check
    if (this.player.isDead()) {
      this.endRun(false);
    }

    // Flashlight flicker when enemies near
    const near = this.enemies.some(
      (e) => e.alive && e.position.distanceTo(this.player.position) < 4,
    );
    if (near && Math.random() < 0.02) this.player.flashlight.flicker();

    // Level clear check (maze: all enemies dead + has keycard → prompt descent)
    if (this.currentSetup && !this.currentSetup.isBoss) {
      const anyAlive = this.enemies.some((e) => e.alive);
      if (!anyAlive && this.enemies.length === 0 && !this.hasKeycard) {
        // All enemies dead but no keycard — highlight it
      }
    }
  }

  private checkInteractions(): void {
    const pos = this.player.position;

    // Collectibles
    for (const c of this.collectibles) {
      if (c.collected) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < 1.5 && this.input.wasPressed('KeyE')) {
        c.collected = true;
        this.engine.scene.remove(c.mesh);
        const entry = this.story.collect(c.entry.id);
        if (entry) {
          this.audio.lorePickup();
          gameState.setActiveStoryEntry(entry);
          gameState.setCodexEntries(this.story.codexEntries);
          this.setPhase('story');
        }
        return;
      }
    }

    // Keycard pickup
    if (this.keycardMesh && !this.hasKeycard) {
      const d = Math.hypot(this.keycardMesh.position.x - pos.x, this.keycardMesh.position.z - pos.z);
      if (d < 1.5) {
        // Auto-pickup keycard on contact
        this.hasKeycard = true;
        this.engine.scene.remove(this.keycardMesh);
        this.keycardMesh = null;
        this.audio.keycardPickup();
        this.showBanner('KEYCARD ACQUIRED', 'Reach the elevator to descend');
      }
    }

    // Elevator descent (requires keycard)
    if (this.elevatorMesh && this.hasKeycard) {
      const d = Math.hypot(this.elevatorMesh.position.x - pos.x, this.elevatorMesh.position.z - pos.z);
      if (d < 1.5) {
        this.descendToNextLevel();
      }
    }
  }

  private updateMenuCamera(dt: number): void {
    void dt;
    const t = this.engine.getElapsedTime();
    this.engine.camera.position.set(
      Math.cos(t * 0.08) * 14,
      4 + Math.sin(t * 0.1) * 1.5,
      Math.sin(t * 0.08) * 14,
    );
    this.engine.camera.lookAt(0, 2, 0);
  }

  private showBanner(text: string, sub: string): void {
    this.bannerTimer = 3.0;
    gameState.setHud({ waveBanner: text, bannerSubtext: sub });
  }

  private pushHud(): void {
    const boss = this.enemies.find((e) => e instanceof BossEnemy && e.alive) as BossEnemy | undefined;
    const bossActive = !!boss && boss.alive;
    const setup = this.currentSetup;
    const hud: Partial<HudState> = {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      wave: this.levels.currentLevel,
      level: this.levels.currentLevel,
      levelDepth: MAX_LEVELS,
      enemiesRemaining: this.enemies.filter((e) => e.alive).length,
      enemiesTotalThisWave: this.enemies.length,
      score: this.score,
      kills: this.kills,
      currency: this.currency,
      comboCount: this.comboCount,
      comboTimer: this.combat.comboTimerFraction,
      weaponName: this.player.weapon.def.name,
      parryReady: this.combat.parryReady,
      parryCooldown: this.combat.parryCooldownFraction,
      dodgeReady: this.combat.dodgeReady,
      dodgeCooldown: this.combat.dodgeCooldownFraction,
      bossActive,
      bossName: bossActive ? boss.config.name : '',
      bossHealth: bossActive ? boss.health : 0,
      bossMaxHealth: bossActive ? boss.maxHealth : 0,
      damageFlash: this.damageFlash,
      healFlash: this.healFlash,
      staminaFlash: this.staminaFlash,
      hitMarker: this.combat.getHitMarker(),
      parryFlash: this.combat.getParryFlash(),
      flashlightBattery: this.player.flashlight.battery,
      hasKeycard: this.hasKeycard,
      isBossLevel: setup?.isBoss ?? false,
      bossWeaponName: setup?.bossWeapon?.name ?? '',
      styleRating: this.combat.styleRating,
      styleMeter: this.combat.styleMeter,
      jumpscareFlash: this.jumpscares.flashIntensity,
      codexCount: this.story.collectedCount,
      codexTotal: this.story.totalEntries,
    };
    gameState.setHud(hud);
  }

  getHittables() {
    return this.enemies.filter((e) => e.alive);
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.exitLock();
    this.clearLevelEntities();
    this.projectiles.dispose();
    this.player.dispose();
    this.effects.dispose();
    this.assets.dispose();
    this.audio.dispose();
    this.input.dispose();
    this.engine.dispose();
  }
}
