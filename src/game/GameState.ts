/**
 * GameState — a tiny observable store that bridges the imperative game
 * engine and the declarative React UI. The engine pushes snapshots; React
 * components subscribe and re-render.
 *
 * CRITICAL: useSyncExternalStore requires getSnapshot to return a
 * reference-stable object when nothing changed (React compares with
 * Object.is). So we cache a single snapshot and only rebuild it on real
 * mutations — never return a fresh object literal on every call.
 */
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_HUD,
  DEFAULT_SETTINGS,
  type GamePhase,
  type HudState,
  type Settings,
  type UpgradeChoice,
  type RunResult,
  type CodexEntry,
  type LoreEntry,
} from '@/game/types';

type Listener = () => void;

class GameState {
  private phase: GamePhase = 'menu';
  private hud: HudState = { ...DEFAULT_HUD };
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private upgradeChoices: UpgradeChoice[] = [];
  private lastRun: RunResult | null = null;
  private fps = 60;
  private codexEntries: CodexEntry[] = [];
  private activeStoryEntry: LoreEntry | null = null;

  private listeners = new Set<Listener>();

  // Cached snapshot — rebuilt ONLY when state mutates. Returning this same
  // reference from getSnapshot is what keeps useSyncExternalStore stable.
  private snapshot: GameStateSnapshot = {
    phase: 'menu',
    hud: { ...DEFAULT_HUD },
    settings: { ...DEFAULT_SETTINGS },
    upgradeChoices: [],
    lastRun: null,
    fps: 60,
    codexEntries: [],
    activeStoryEntry: null,
  };

  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private emit(): void {
    this.rebuildSnapshot();
    this.listeners.forEach((l) => l());
  }

  /** Rebuild the cached snapshot from current fields. */
  private rebuildSnapshot(): void {
    this.snapshot = {
      phase: this.phase,
      hud: this.hud,
      settings: this.settings,
      upgradeChoices: this.upgradeChoices,
      lastRun: this.lastRun,
      fps: this.fps,
      codexEntries: this.codexEntries,
      activeStoryEntry: this.activeStoryEntry,
    };
  }

  getSnapshot = (): GameStateSnapshot => this.snapshot;

  setPhase(phase: GamePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit();
  }

  setHud(hud: Partial<HudState>): void {
    this.hud = { ...this.hud, ...hud };
    this.emit();
  }

  setSettings(settings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...settings };
    this.emit();
  }

  setUpgradeChoices(choices: UpgradeChoice[]): void {
    this.upgradeChoices = choices;
    this.emit();
  }

  setLastRun(run: RunResult): void {
    this.lastRun = run;
    this.emit();
  }

  setCodexEntries(entries: CodexEntry[]): void {
    this.codexEntries = entries;
    this.emit();
  }

  setActiveStoryEntry(entry: LoreEntry | null): void {
    this.activeStoryEntry = entry;
    this.emit();
  }

  setFps(fps: number): void {
    this.fps = fps;
    // FPS updates frequently — only emit if a listener is showing it
    if (this.settings.showFps) this.emit();
  }

  reset(): void {
    this.hud = { ...DEFAULT_HUD };
    this.upgradeChoices = [];
    this.lastRun = null;
    this.activeStoryEntry = null;
    this.emit();
  }
}

export interface GameStateSnapshot {
  phase: GamePhase;
  hud: HudState;
  settings: Settings;
  upgradeChoices: UpgradeChoice[];
  lastRun: RunResult | null;
  fps: number;
  codexEntries: CodexEntry[];
  activeStoryEntry: LoreEntry | null;
}

export const gameState = new GameState();

/** React hook to read the game state. */
export function useGameState(): GameStateSnapshot {
  return useSyncExternalStore(gameState.subscribe, gameState.getSnapshot);
}
