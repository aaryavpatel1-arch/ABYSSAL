/**
 * Engine — owns the renderer, scene, camera, lighting, fog, and the
 * animation clock. Pure rendering infrastructure; gameplay lives in Game.
 */
import * as THREE from 'three';
import { PALETTE, ARENA_RADIUS } from '@/game/config';
import type { Settings } from '@/game/types';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly clock = new THREE.Clock();
  readonly canvas: HTMLCanvasElement;

  // Atmospheric lights
  readonly ambient: THREE.AmbientLight;
  readonly hemi: THREE.HemisphereLight;
  readonly moonLight: THREE.DirectionalLight;

  private fog: THREE.FogExp2;
  private container: HTMLElement;
  private settings: Settings;
  private disposed = false;
  private fpsSamples: number[] = [];

  constructor(container: HTMLElement, settings: Settings) {
    this.container = container;
    this.settings = settings;

    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.fog = new THREE.FogExp2(PALETTE.fog, 0.035);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      container.clientWidth / container.clientHeight,
      0.05,
      200,
    );
    this.camera.position.set(0, 1.7, 0);
    // The camera must be in the scene graph so its children (flashlight,
    // weapon view-model) are reached by the renderer.
    this.scene.add(this.camera);

    // Lighting setup — dark, moody
    this.ambient = new THREE.AmbientLight(PALETTE.ambient, 0.35);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0x202838, 0x05050a, 0.25);
    this.scene.add(this.hemi);

    // Single dim "moonlight" directional light for soft shadows
    this.moonLight = new THREE.DirectionalLight(0x5a6a8a, 0.5);
    this.moonLight.position.set(-20, 38, 14);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(2048, 2048);
    this.moonLight.shadow.camera.near = 1;
    this.moonLight.shadow.camera.far = 120;
    this.moonLight.shadow.camera.left = -ARENA_RADIUS;
    this.moonLight.shadow.camera.right = ARENA_RADIUS;
    this.moonLight.shadow.camera.top = ARENA_RADIUS;
    this.moonLight.shadow.camera.bottom = -ARENA_RADIUS;
    this.moonLight.shadow.bias = -0.0006;
    this.moonLight.shadow.normalBias = 0.04;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    window.addEventListener('resize', this.handleResize);
  }

  setSettings(s: Settings): void {
    this.settings = s;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
  }

  /** Fog density pulse for atmospheric horror ambience. */
  setFogDensity(d: number): void {
    this.fog.density = d;
  }

  getFogDensity(): number {
    return this.fog.density;
  }

  setExposure(e: number): void {
    this.renderer.toneMappingExposure = e;
  }

  handleResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  getDelta(): number {
    return Math.min(this.clock.getDelta(), 0.05); // clamp big frame gaps
  }

  getElapsedTime(): number {
    return this.clock.getElapsedTime();
  }

  getFps(): number {
    const dt = this.clock.getDelta();
    if (dt > 0) {
      this.fpsSamples.push(1 / dt);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
    }
    if (this.fpsSamples.length === 0) return 60;
    const sum = this.fpsSamples.reduce((a, b) => a + b, 0);
    return sum / this.fpsSamples.length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
