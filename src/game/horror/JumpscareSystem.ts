/**
 * JumpscareSystem — environmental horror triggers.
 *
 * Triggers sudden audio stingers and brief visual shadow flashes when:
 *   - The player passes specific hidden maze tiles.
 *   - The player opens a keycard crate.
 * Also manages random environmental horror: light failures, and brief
 * screen-edge shadow flashes. Exposes a `jumpscareFlash` value (0..1) the
 * HUD renders as a full-screen flicker.
 */
import * as THREE from 'three';
import { AudioManager } from '@/game/audio/AudioManager';
import { Effects } from '@/game/effects/Effects';
import { Player } from '@/game/player/Player';
import { Flashlight } from '@/game/player/Flashlight';
import { JUMPSCARE_DURATION } from '@/game/config';
import { randRange } from '@/game/utils';

interface HiddenTrigger {
  x: number;
  z: number;
  triggered: boolean;
  radius: number;
}

export class JumpscareSystem {
  private audio: AudioManager;
  private effects: Effects;
  private player: Player;
  private flashlight: Flashlight;

  private triggers: HiddenTrigger[] = [];
  private flashTimer = 0; // counts down from JUMPSCARE_DURATION
  private shadowFlashTimer = 0;
  private randomEventTimer = randRange(12, 25);
  private lightFailureTimer = 0;

  /** 0..1 intensity for HUD rendering. */
  flashIntensity = 0;

  constructor(
    audio: AudioManager,
    effects: Effects,
    player: Player,
    flashlight: Flashlight,
  ) {
    this.audio = audio;
    this.effects = effects;
    this.player = player;
    this.flashlight = flashlight;
  }

  /** Seed hidden trigger tiles from maze loot positions / dead-ends. */
  seedTriggers(positions: { x: number; z: number }[]): void {
    this.triggers = positions.map((p) => ({
      x: p.x,
      z: p.z,
      triggered: false,
      radius: 2.0,
    }));
  }

  clearTriggers(): void {
    this.triggers = [];
  }

  /** Manually fire a jumpscare (e.g. opening a keycard crate). */
  fireJumpscare(intensity = 1): void {
    this.flashTimer = JUMPSCARE_DURATION;
    this.effects.addTrauma(0.7 * intensity);
    this.audio.jumpscareStinger();
    // Force a flashlight flicker
    this.flashlight.flicker();
  }

  get isFlashing(): boolean {
    return this.flashTimer > 0;
  }

  update(dt: number): void {
    const pos = this.player.position;

    // Check hidden tile triggers
    for (const t of this.triggers) {
      if (t.triggered) continue;
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < t.radius) {
        t.triggered = true;
        if (Math.random() < 0.5) {
          this.fireJumpscare(0.7);
        } else {
          // Subtle shadow flash instead of full jumpscare
          this.shadowFlashTimer = 0.3;
          this.audio.whisper();
        }
      }
    }

    // Decay flash timer
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashIntensity = Math.max(0, this.flashTimer / JUMPSCARE_DURATION);
    } else {
      this.flashIntensity = 0;
    }
    if (this.shadowFlashTimer > 0) this.shadowFlashTimer -= dt;

    // Random environmental horror events
    this.randomEventTimer -= dt;
    if (this.randomEventTimer <= 0) {
      this.randomEventTimer = randRange(15, 30);
      this.triggerRandomEvent();
    }

    // Light failure event decay
    if (this.lightFailureTimer > 0) {
      this.lightFailureTimer -= dt;
      // Force flicker during light failure
      if (Math.random() < 0.3) this.flashlight.flicker();
    }
  }

  private triggerRandomEvent(): void {
    const roll = Math.random();
    if (roll < 0.4) {
      // Light failure — flashlight dims for a few seconds
      this.lightFailureTimer = randRange(2, 4);
      this.audio.electricalBuzz();
    } else if (roll < 0.7) {
      // Distant shadow flash + whisper
      this.shadowFlashTimer = 0.4;
      this.audio.whisper();
    } else {
      // Mild jumpscare from behind
      this.flashTimer = JUMPSCARE_DURATION * 0.5;
      this.effects.addTrauma(0.3);
      this.audio.jumpscareStinger();
    }
  }

  reset(): void {
    this.triggers = [];
    this.flashTimer = 0;
    this.shadowFlashTimer = 0;
    this.flashIntensity = 0;
    this.randomEventTimer = randRange(12, 25);
    this.lightFailureTimer = 0;
  }
}
