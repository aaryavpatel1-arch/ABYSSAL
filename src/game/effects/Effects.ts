/**
 * Effects — pooled particle systems, impact effects, and camera shake.
 * Everything uses simple geometry + shaders-free materials for perf.
 */
import * as THREE from 'three';
import { clamp, lerp, randRange } from '@/game/utils';
import { PALETTE } from '@/game/config';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  spin: number;
  fade: boolean;
  scaleDown: boolean;
  active: boolean;
}

export class Effects {
  private scene: THREE.Scene;
  private pool: Particle[] = [];
  private poolSize = 220;
  private sparkGeo: THREE.SphereGeometry;
  private bloodGeo: THREE.SphereGeometry;
  private flashLight: THREE.PointLight;

  // Camera shake
  private shakeTrauma = 0;
  private shakeOffset = new THREE.Vector3();
  private shakeTime = 0;

  // Sword trail
  private trailPoints: THREE.Vector3[] = [];
  private trail: THREE.Line | null = null;
  private trailMat: THREE.LineBasicMaterial;

  // Damage decals (pooled)
  private decals: THREE.Mesh[] = [];
  private decalGeo: THREE.CircleGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sparkGeo = new THREE.SphereGeometry(0.05, 4, 4);
    this.bloodGeo = new THREE.SphereGeometry(0.08, 5, 5);
    this.decalGeo = new THREE.CircleGeometry(0.45, 8);

    for (let i = 0; i < this.poolSize; i++) {
      const m = new THREE.Mesh(
        this.bloodGeo,
        new THREE.MeshBasicMaterial({
          color: 0x6b0f0f,
          transparent: true,
          opacity: 0,
        }),
      );
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.pool.push({
        mesh: m,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0,
        gravity: 0,
        spin: 0,
        fade: true,
        scaleDown: true,
        active: false,
      });
    }

    // Impact flash light
    this.flashLight = new THREE.PointLight(0xff5522, 0, 8, 2);
    this.flashLight.position.set(0, 1.5, 0);
    scene.add(this.flashLight);

    // Trail material/line
    this.trailMat = new THREE.LineBasicMaterial({
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0,
      linewidth: 2,
    });
  }

  private spawn(opts: {
    pos: THREE.Vector3;
    color: number;
    geo: 'spark' | 'blood';
    count: number;
    speed: number;
    spread: number;
    life: number;
    gravity: number;
    size?: number;
    scaleDown?: boolean;
    upBias?: number;
  }): void {
    let spawned = 0;
    for (let i = 0; i < this.pool.length && spawned < opts.count; i++) {
      const p = this.pool[i];
      if (p.active) continue;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.geometry = opts.geo === 'spark' ? this.sparkGeo : this.bloodGeo;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(opts.color);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      const s = opts.size ?? 1;
      p.mesh.scale.setScalar(s * randRange(0.6, 1.2));
      p.mesh.position.copy(opts.pos);
      const ang = Math.random() * Math.PI * 2;
      const up = randRange(0.3, 1) * (opts.upBias ?? 1);
      const sp = randRange(0.4, 1) * opts.speed;
      p.vx = Math.cos(ang) * sp;
      p.vy = up * sp;
      p.vz = Math.sin(ang) * sp;
      p.life = opts.life * randRange(0.7, 1.1);
      p.maxLife = p.life;
      p.gravity = opts.gravity;
      p.spin = randRange(-6, 6);
      p.fade = true;
      p.scaleDown = opts.scaleDown ?? true;
      spawned++;
    }
  }

  bloodBurst(pos: THREE.Vector3, amount = 14, upBias = 1): void {
    this.spawn({
      pos,
      color: PALETTE.blood,
      geo: 'blood',
      count: amount,
      speed: 4.5,
      spread: 1,
      life: 0.7,
      gravity: 14,
      size: 1,
      upBias,
    });
    this.flash(pos, 0x6b0f0f, 2.2, 6);
  }

  sparkBurst(pos: THREE.Vector3, color = 0xffaa44, amount = 10): void {
    this.spawn({
      pos,
      color,
      geo: 'spark',
      count: amount,
      speed: 6,
      spread: 1,
      life: 0.4,
      gravity: 6,
      size: 0.7,
      upBias: 0.6,
    });
    this.flash(pos, color, 3, 5);
  }

  parrySpark(pos: THREE.Vector3): void {
    this.spawn({
      pos,
      color: PALETTE.parry,
      geo: 'spark',
      count: 22,
      speed: 8,
      spread: 1,
      life: 0.5,
      gravity: 4,
      size: 0.6,
    });
    this.flash(pos, PALETTE.parry, 4, 7);
  }

  deathBurst(pos: THREE.Vector3, color = 0x331111): void {
    this.spawn({
      pos,
      color,
      geo: 'blood',
      count: 24,
      speed: 5,
      spread: 1,
      life: 1.0,
      gravity: 12,
      size: 1.3,
    });
    this.spawn({
      pos,
      color: 0x550000,
      geo: 'spark',
      count: 12,
      speed: 3,
      spread: 1,
      life: 0.8,
      gravity: 2,
      size: 0.8,
      upBias: 0.4,
    });
    this.flash(pos, 0x880000, 3, 9);
  }

  /** Brief point-light flash at a position. */
  private flash(pos: THREE.Vector3, color: number, intensity: number, dist: number): void {
    this.flashLight.color.setHex(color);
    this.flashLight.intensity = intensity;
    this.flashLight.distance = dist;
    this.flashLight.position.copy(pos);
  }

  // ---- Camera shake -------------------------------------------------------

  addTrauma(amount: number): void {
    this.shakeTrauma = clamp(this.shakeTrauma + amount, 0, 1);
  }

  getShakeOffset(): THREE.Vector3 {
    return this.shakeOffset;
  }

  // ---- Sword trail --------------------------------------------------------

  updateTrail(active: boolean, tipWorld: THREE.Vector3): void {
    if (active) {
      this.trailPoints.push(tipWorld.clone());
      if (this.trailPoints.length > 8) this.trailPoints.shift();
      if (this.trailPoints.length >= 2) {
        if (this.trail) {
          this.scene.remove(this.trail);
          this.trail.geometry.dispose();
        }
        const geo = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        this.trail = new THREE.Line(geo, this.trailMat);
        this.scene.add(this.trail);
        this.trailMat.opacity = 0.6;
      }
    } else {
      this.trailPoints = [];
      if (this.trailMat.opacity > 0) this.trailMat.opacity = lerp(this.trailMat.opacity, 0, 0.3);
      if (this.trailMat.opacity < 0.02 && this.trail) {
        this.scene.remove(this.trail);
        this.trail.geometry.dispose();
        this.trail = null;
      }
    }
  }

  // ---- Ground decals (blood pools on death) -------------------------------

  addBloodDecal(pos: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3a0606,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const d = new THREE.Mesh(this.decalGeo, mat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(pos.x, 0.03, pos.z);
    d.scale.setScalar(randRange(0.7, 1.4));
    this.scene.add(d);
    this.decals.push(d);
    if (this.decals.length > 30) {
      const old = this.decals.shift();
      if (old) {
        this.scene.remove(old);
        (old.material as THREE.Material).dispose();
      }
    }
  }

  // ---- Update -------------------------------------------------------------

  update(dt: number): void {
    // Particles
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * dt;
      const lifeFrac = p.life / p.maxLife;
      if (p.fade) {
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = lifeFrac;
      }
      if (p.scaleDown) {
        p.mesh.scale.setScalar(Math.max(0.01, lifeFrac));
      }
    }

    // Flash decay
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 18);
    }

    // Camera shake — trauma squared for snappy feel
    if (this.shakeTrauma > 0.001) {
      this.shakeTime += dt;
      const t = this.shakeTrauma * this.shakeTrauma;
      const amp = 0.22 * t;
      this.shakeOffset.set(
        Math.sin(this.shakeTime * 37.0) * amp,
        Math.sin(this.shakeTime * 51.0) * amp * 0.7,
        Math.sin(this.shakeTime * 29.0) * amp,
      );
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.6);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    // Trail opacity decay
    if (!this.trail && this.trailMat.opacity > 0) {
      this.trailMat.opacity = Math.max(0, this.trailMat.opacity - dt * 4);
    }
  }

  dispose(): void {
    this.pool.forEach((p) => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.sparkGeo.dispose();
    this.bloodGeo.dispose();
    this.decalGeo.dispose();
    this.decals.forEach((d) => {
      this.scene.remove(d);
      (d.material as THREE.Material).dispose();
    });
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
    }
    this.trailMat.dispose();
    this.scene.remove(this.flashLight);
  }
}
