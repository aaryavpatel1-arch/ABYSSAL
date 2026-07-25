/**
 * AssetFactory — procedural meshes & materials for the horror arena,
 * enemies, and weapons. No external assets required.
 */
import * as THREE from 'three';
import { PALETTE } from '@/game/config';

export class AssetFactory {
  // Shared materials
  readonly groundMat: THREE.MeshStandardMaterial;
  readonly wallMat: THREE.MeshStandardMaterial;
  readonly pillarMat: THREE.MeshStandardMaterial;
  readonly metalMat: THREE.MeshStandardMaterial;
  readonly fleshMat: THREE.MeshStandardMaterial;
  readonly boneMat: THREE.MeshStandardMaterial;

  constructor() {
    this.groundMat = new THREE.MeshStandardMaterial({
      color: PALETTE.ground,
      roughness: 0.96,
      metalness: 0.0,
    });
    this.wallMat = new THREE.MeshStandardMaterial({
      color: PALETTE.wall,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.pillarMat = new THREE.MeshStandardMaterial({
      color: PALETTE.pillar,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.metalMat = new THREE.MeshStandardMaterial({
      color: 0x6b6b73,
      roughness: 0.4,
      metalness: 0.85,
    });
    this.fleshMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a1f,
      roughness: 0.85,
      metalness: 0.05,
      emissive: 0x1a0606,
      emissiveIntensity: 0.4,
    });
    this.boneMat = new THREE.MeshStandardMaterial({
      color: 0xc9c2b0,
      roughness: 0.6,
      metalness: 0.05,
    });
  }

  // ---- Arena ---------------------------------------------------------------

  createArena(radius: number): THREE.Group {
    const g = new THREE.Group();
    g.name = 'arena';

    // Ground
    const groundGeo = new THREE.CircleGeometry(radius, 80);
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    g.add(ground);

    // Subtle radial blood-stain decal via a second dark disc
    const stainGeo = new THREE.CircleGeometry(radius * 0.92, 64);
    const stainMat = new THREE.MeshBasicMaterial({
      color: 0x0a0405,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const stain = new THREE.Mesh(stainGeo, stainMat);
    stain.rotation.x = -Math.PI / 2;
    stain.position.y = 0.01;
    g.add(stain);

    // Cracks/ember rings via emissive line loop near center
    const ringGeo = new THREE.RingGeometry(radius * 0.18, radius * 0.22, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.ember,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.name = 'emberRing';
    g.add(ring);

    // Outer wall (cylinder shell)
    const wallGeo = new THREE.CylinderGeometry(
      radius,
      radius,
      9,
      80,
      1,
      true,
    );
    const wall = new THREE.Mesh(wallGeo, this.wallMat);
    wall.position.y = 4.5;
    wall.castShadow = false;
    wall.receiveShadow = true;
    wall.name = 'arenaWall';
    g.add(wall);

    // Wall cap ring
    const capGeo = new THREE.TorusGeometry(radius, 0.4, 6, 80);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x2a1010,
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0x3a0a0a,
      emissiveIntensity: 0.6,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 9;
    cap.rotation.x = Math.PI / 2;
    cap.name = 'wallCap';
    g.add(cap);

    // Pillars in a ring
    const pillarCount = 10;
    for (let i = 0; i < pillarCount; i++) {
      const ang = (i / pillarCount) * Math.PI * 2;
      const r = radius * 0.78;
      const p = this.createPillar();
      p.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      p.rotation.y = ang;
      g.add(p);
    }

    // Scattered rubble blocks
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * (radius * 0.7);
      const s = 0.5 + Math.random() * 1.3;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * 0.6, s),
        this.pillarMat,
      );
      block.position.set(Math.cos(ang) * r, s * 0.3, Math.sin(ang) * r);
      block.rotation.y = Math.random() * Math.PI;
      block.castShadow = true;
      block.receiveShadow = true;
      g.add(block);
    }

    // Hanging chains from the ceiling-less void: thin vertical emissive lines
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = radius * 0.5;
      const chainMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.7,
      });
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 12, 6),
        chainMat,
      );
      chain.position.set(Math.cos(ang) * r, 5.5, Math.sin(ang) * r);
      g.add(chain);
      // lantern ember at the bottom
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff5a1a }),
      );
      lantern.position.set(Math.cos(ang) * r, -0.4 + 5.5 - 6, Math.sin(ang) * r);
      lantern.name = `emberLantern${i}`;
      g.add(lantern);
    }

    return g;
  }

  createPillar(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.9, 1.1, 8, 8);
    const m = new THREE.Mesh(geo, this.pillarMat);
    m.position.y = 4;
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'pillar';
    return m;
  }

  // ---- Weapons (view models) ----------------------------------------------

  createCleaverViewmodel(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'cleaverView';

    // ---- Blade: tapered wedge using a custom BufferGeometry ----
    // A proper blade shape: wide at the guard, tapering to a point,
    // with a slight curve. Built as a flat extruded shape.
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);          // base near guard
    bladeShape.lineTo(0.09, 0);       // base width
    bladeShape.lineTo(0.07, 0.55);    // taper in
    bladeShape.lineTo(0.02, 0.72);    // near tip
    bladeShape.lineTo(0, 0.78);       // tip
    bladeShape.lineTo(-0.02, 0.72);   // other side near tip
    bladeShape.lineTo(-0.05, 0.55);   // taper
    bladeShape.lineTo(-0.06, 0);      // base
    bladeShape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.004,
      bevelSegments: 1,
    });
    // Center the extrude depth
    bladeGeo.translate(0, 0, -0.009);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xb8c0cc,
      roughness: 0.22,
      metalness: 0.95,
      emissive: 0x0a0a0a,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;
    g.add(blade);

    // ---- Edge highlight strip (emissive) ----
    const edgeGeo = new THREE.BoxGeometry(0.012, 0.74, 0.03);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xeef4ff,
      transparent: true,
      opacity: 0.55,
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, 0.39, 0);
    g.add(edge);

    // ---- Crossguard ----
    const guardGeo = new THREE.BoxGeometry(0.22, 0.045, 0.05);
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x4a3020,
      roughness: 0.5,
      metalness: 0.6,
    });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.set(0, -0.02, 0);
    guard.castShadow = true;
    g.add(guard);

    // Guard quillon ends (small spheres)
    const qGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const qL = new THREE.Mesh(qGeo, guardMat);
    qL.position.set(-0.12, -0.02, 0);
    const qR = new THREE.Mesh(qGeo, guardMat);
    qR.position.set(0.12, -0.02, 0);
    g.add(qL, qR);

    // ---- Handle (wrapped grip) ----
    const handleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.26, 12);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x2a1410,
      roughness: 0.92,
      metalness: 0.05,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0, -0.17, 0);
    handle.castShadow = true;
    g.add(handle);

    // Grip wrap rings (subtle detail)
    const wrapMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a06,
      roughness: 0.95,
      metalness: 0.0,
    });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.03, 0.006, 4, 10),
        wrapMat,
      );
      ring.position.set(0, -0.08 - i * 0.055, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }

    // ---- Pommel ----
    const pommelGeo = new THREE.SphereGeometry(0.035, 10, 10);
    const pommel = new THREE.Mesh(pommelGeo, guardMat);
    pommel.position.set(0, -0.32, 0);
    pommel.castShadow = true;
    g.add(pommel);

    g.traverse((o) => {
      o.castShadow = true;
    });
    return g;
  }

  /** Serrated machete — short, wide, brutal blade with saw teeth. */
  createMacheteViewmodel(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'macheteView';

    // Blade — chunky, curved-back shape (like a kukri/machete hybrid)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.13, 0);
    bladeShape.lineTo(0.15, 0.28);
    bladeShape.lineTo(0.1, 0.5);
    bladeShape.lineTo(0, 0.58);
    bladeShape.lineTo(-0.04, 0.5);
    bladeShape.lineTo(-0.02, 0.28);
    bladeShape.lineTo(-0.03, 0);
    bladeShape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.005,
      bevelSegments: 1,
    });
    bladeGeo.translate(0, 0, -0.015);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x9a9fa8,
      roughness: 0.35,
      metalness: 0.88,
      emissive: 0x080404,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    g.add(blade);

    // Saw teeth along the back edge (small cones)
    const toothGeo = new THREE.ConeGeometry(0.018, 0.04, 4);
    const toothMat = bladeMat;
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(toothGeo, toothMat);
      t.position.set(-0.03 - i * 0.006, 0.08 + i * 0.08, 0);
      t.rotation.z = -0.6;
      g.add(t);
    }

    // Notched edge highlight
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xdde6f0,
      transparent: true,
      opacity: 0.45,
    });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.5, 0.045), edgeMat);
    edge.position.set(0.06, 0.3, 0);
    g.add(edge);

    // Simple guard
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x3a2818,
      roughness: 0.5,
      metalness: 0.6,
    });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), guardMat);
    guard.position.set(0, -0.03, 0);
    g.add(guard);

    // Wrapped handle
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10),
      new THREE.MeshStandardMaterial({
        color: 0x1e0e08,
        roughness: 0.95,
        metalness: 0.05,
      }),
    );
    handle.position.set(0, -0.18, 0);
    g.add(handle);

    // Pommel
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), guardMat);
    pommel.position.set(0, -0.35, 0);
    g.add(pommel);

    g.traverse((o) => {
      o.castShadow = true;
    });
    return g;
  }

  /** Abyssal glaive — long polearm with a curved sweeping blade. */
  createGlaiveViewmodel(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'glaiveView';

    // Pole — long dark shaft
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x14100c,
      roughness: 0.7,
      metalness: 0.3,
    });
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 1.5, 10),
      poleMat,
    );
    pole.position.set(0, 0.1, 0);
    g.add(pole);

    // Blade — crescent/curved glaive head
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.bezierCurveTo(0.16, 0.12, 0.2, 0.34, 0.06, 0.52);
    bladeShape.bezierCurveTo(0.02, 0.56, 0, 0.56, -0.02, 0.5);
    bladeShape.bezierCurveTo(0.08, 0.34, 0.06, 0.16, -0.02, 0.04);
    bladeShape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.003,
      bevelSegments: 1,
    });
    bladeGeo.translate(0, 0, -0.007);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x5a6470,
      roughness: 0.18,
      metalness: 0.98,
      emissive: 0x0c1018,
      emissiveIntensity: 0.5,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0.8, 0);
    g.add(blade);

    // Emissive edge
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x88f0ff,
      transparent: true,
      opacity: 0.4,
    });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.42, 0.02), edgeMat);
    edge.position.set(0.1, 1.02, 0);
    g.add(edge);

    // Socket collar where blade meets pole
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8),
      new THREE.MeshStandardMaterial({
        color: 0x2a2218,
        roughness: 0.5,
        metalness: 0.7,
      }),
    );
    collar.position.set(0, 0.78, 0);
    g.add(collar);

    // Grip wrapping near the bottom
    const wrapMat = new THREE.MeshStandardMaterial({
      color: 0x0c0604,
      roughness: 0.95,
      metalness: 0.0,
    });
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.026, 0.007, 4, 10),
        wrapMat,
      );
      ring.position.set(0, -0.5 - i * 0.06, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }

    // End cap
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      poleMat,
    );
    cap.position.set(0, -0.66, 0);
    g.add(cap);

    g.traverse((o) => {
      o.castShadow = true;
    });
    return g;
  }

  /** War Maul — heavy two-handed hammer with a spiked head. */
  createWarMaulViewmodel(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'maulView';

    // Shaft
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x2a1c10,
      roughness: 0.7,
      metalness: 0.2,
    });
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 1.1, 10),
      shaftMat,
    );
    shaft.position.set(0, 0.0, 0);
    g.add(shaft);

    // Head — large block
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a52,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0x100808,
      emissiveIntensity: 0.3,
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), headMat);
    head.position.set(0, 0.62, 0);
    g.add(head);

    // Face plates (darker bands)
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a20,
      roughness: 0.4,
      metalness: 0.95,
    });
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.24), bandMat);
    band1.position.set(0, 0.52, 0);
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.24), bandMat);
    band2.position.set(0, 0.72, 0);
    g.add(band1, band2);

    // Spikes on all four sides of the head
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a92,
      roughness: 0.25,
      metalness: 0.95,
    });
    const spikeGeo = new THREE.ConeGeometry(0.04, 0.16, 6);
    const dirs = [
      { x: 0.14, z: 0, ry: 0 },
      { x: -0.14, z: 0, ry: Math.PI },
      { x: 0, z: 0.14, ry: Math.PI / 2 },
      { x: 0, z: -0.14, ry: -Math.PI / 2 },
    ];
    for (const d of dirs) {
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      s.position.set(d.x, 0.62, d.z);
      s.rotation.y = d.ry;
      s.rotation.x = -Math.PI / 2;
      g.add(s);
    }
    // Top spike
    const topSpike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 6), spikeMat);
    topSpike.position.set(0, 0.82, 0);
    g.add(topSpike);

    // Grip wrapping
    const wrapMat = new THREE.MeshStandardMaterial({
      color: 0x140a06,
      roughness: 0.95,
      metalness: 0.0,
    });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.038, 0.008, 4, 10),
        wrapMat,
      );
      ring.position.set(0, -0.3 - i * 0.08, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }

    // Pommel knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), shaftMat);
    knob.position.set(0, -0.58, 0);
    g.add(knob);

    g.traverse((o) => {
      o.castShadow = true;
    });
    return g;
  }

  /** A shambling humanoid silhouette. */
  createGruntBody(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'grunt';

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.7, 4, 10),
      this.fleshMat,
    );
    torso.position.y = 1.3;
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 12),
      this.fleshMat,
    );
    head.position.y = 2.0;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // Eyes — emissive
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.09, 2.03, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.09;
    g.add(eyeL, eyeR);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.14, 0.6, 4, 8);
    const armL = new THREE.Mesh(armGeo, this.fleshMat);
    armL.position.set(-0.5, 1.4, 0.1);
    armL.rotation.z = 0.3;
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.5;
    armR.rotation.z = -0.3;
    g.add(armL, armR);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.16, 0.55, 4, 8);
    const legL = new THREE.Mesh(legGeo, this.fleshMat);
    legL.position.set(-0.2, 0.55, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.2;
    g.add(legL, legR);
    (g as any).legL = legL;
    (g as any).legR = legR;
    (g as any).armL = armL;
    (g as any).armR = armR;

    return g;
  }

  /** Fast, hunched creature. */
  createStalkerBody(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'stalker';

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x1a1419,
        roughness: 0.6,
        metalness: 0.2,
        emissive: 0x120408,
        emissiveIntensity: 0.5,
      }),
    );
    torso.position.y = 1.0;
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.4, 8),
      this.fleshMat,
    );
    head.position.y = 1.45;
    head.rotation.x = Math.PI;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.07, 1.4, 0.2);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;
    g.add(eyeL, eyeR);

    // Long arms reaching forward
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.85, 4, 6);
    const armL = new THREE.Mesh(armGeo, this.fleshMat);
    armL.position.set(-0.36, 1.05, 0.25);
    armL.rotation.x = 1.1;
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.36;
    g.add(armL, armR);
    (g as any).armL = armL;
    (g as any).armR = armR;

    // Legs (thin)
    const legGeo = new THREE.CapsuleGeometry(0.12, 0.5, 4, 6);
    const legL = new THREE.Mesh(legGeo, this.fleshMat);
    legL.position.set(-0.16, 0.45, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legL, legR);
    (g as any).legL = legL;
    (g as any).legR = legR;

    return g;
  }

  /** Heavy brute. */
  createBruteBody(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'brute';

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.6, 0.9, 6, 12),
      new THREE.MeshStandardMaterial({
        color: 0x241014,
        roughness: 0.95,
        metalness: 0.1,
        emissive: 0x1a0606,
        emissiveIntensity: 0.5,
      }),
    );
    torso.position.y = 1.5;
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 12),
      this.fleshMat,
    );
    head.position.y = 2.25;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // Horns
    const hornMat = this.boneMat;
    const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 6);
    const hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(-0.22, 2.5, 0);
    hornL.rotation.z = 0.5;
    const hornR = hornL.clone();
    hornR.position.x = 0.22;
    hornR.rotation.z = -0.5;
    g.add(hornL, hornR);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 2.28, 0.3);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    g.add(eyeL, eyeR);

    // Massive arms
    const armGeo = new THREE.CapsuleGeometry(0.22, 0.7, 4, 8);
    const armL = new THREE.Mesh(armGeo, this.fleshMat);
    armL.position.set(-0.7, 1.55, 0.1);
    armL.rotation.z = 0.5;
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.7;
    armR.rotation.z = -0.5;
    g.add(armL, armR);
    (g as any).armL = armL;
    (g as any).armR = armR;

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.24, 0.6, 4, 8);
    const legL = new THREE.Mesh(legGeo, this.fleshMat);
    legL.position.set(-0.28, 0.65, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.28;
    g.add(legL, legR);
    (g as any).legL = legL;
    (g as any).legR = legR;

    return g;
  }

  /** Towering boss. */
  createBossBody(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'boss';

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.85, 1.6, 8, 16),
      new THREE.MeshStandardMaterial({
        color: 0x1a0a0e,
        roughness: 0.85,
        metalness: 0.15,
        emissive: 0x4a0a0a,
        emissiveIntensity: 0.7,
      }),
    );
    torso.position.y = 2.4;
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16),
      this.fleshMat,
    );
    head.position.y = 3.6;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // Crown of horns
    const hornMat = this.boneMat;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.7, 6),
        hornMat,
      );
      horn.position.set(
        Math.cos(ang) * 0.4,
        3.95,
        Math.sin(ang) * 0.4,
      );
      horn.rotation.x = Math.sin(ang) * 0.4;
      horn.rotation.z = -Math.cos(ang) * 0.4;
      g.add(horn);
    }

    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a00 });
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.18, 3.62, 0.42);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.18;
    g.add(eyeL, eyeR);

    // Huge arms
    const armGeo = new THREE.CapsuleGeometry(0.32, 1.2, 6, 10);
    const armL = new THREE.Mesh(armGeo, this.fleshMat);
    armL.position.set(-1.0, 2.5, 0.15);
    armL.rotation.z = 0.5;
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 1.0;
    armR.rotation.z = -0.5;
    g.add(armL, armR);
    (g as any).armL = armL;
    (g as any).armR = armR;

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.36, 1.0, 6, 10);
    const legL = new THREE.Mesh(legGeo, this.fleshMat);
    legL.position.set(-0.4, 1.05, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.4;
    g.add(legL, legR);
    (g as any).legL = legL;
    (g as any).legR = legR;

    // Aura ring at feet
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.8, 32),
      new THREE.MeshBasicMaterial({
        color: PALETTE.bossGlow,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.03;
    aura.name = 'bossAura';
    g.add(aura);

    return g;
  }

  /** Corrupted Sentry — hovering ranged enemy with glowing eye core. */
  createSentryBody(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'sentry';

    // Hovering torso (upright capsule)
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.7, 8, 12),
      new THREE.MeshStandardMaterial({
        color: 0x0a1a2a,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0x0a2244,
        emissiveIntensity: 0.4,
      }),
    );
    torso.position.y = 1.0;
    torso.castShadow = true;
    g.add(torso);

    // Glowing core / eye
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x44ddff }),
    );
    core.position.set(0, 1.1, 0.35);
    core.name = 'head';
    g.add(core);
    const coreLight = new THREE.PointLight(0x44ddff, 1.2, 6, 2);
    coreLight.position.copy(core.position);
    g.add(coreLight);

    // Arms raised (casting pose)
    const armGeo = new THREE.CapsuleGeometry(0.14, 0.5, 6, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x0a1422, roughness: 0.5, metalness: 0.5 });
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.5, 1.1, 0.1);
    armL.rotation.x = -1.3;
    armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.5, 1.1, 0.1);
    armR.rotation.x = -1.3;
    armR.castShadow = true;
    g.add(armL, armR);
    (g as any).armL = armL;
    (g as any).armR = armR;

    // Lower body tapers (no legs — hovers)
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.6, 12),
      armMat,
    );
    skirt.position.y = 0.5;
    g.add(skirt);

    return g;
  }

  /** Acid Spitter — hunched, dripping, green-tinged. */
  createSpitterBody(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'spitter';

    const flesh = new THREE.MeshStandardMaterial({
      color: 0x1a2a10,
      roughness: 0.9,
      metalness: 0.0,
      emissive: 0x113311,
      emissiveIntensity: 0.3,
    });

    const torso = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      flesh,
    );
    torso.position.y = 0.9;
    torso.scale.set(1, 0.8, 1);
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      flesh,
    );
    head.position.set(0, 1.3, 0.25);
    head.name = 'head';
    g.add(head);

    // Glowing acid mouth
    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x66ff44 }),
    );
    mouth.position.set(0, 1.28, 0.5);
    g.add(mouth);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.18, 0.7, 6, 8);
    const armL = new THREE.Mesh(armGeo, flesh);
    armL.position.set(-0.5, 0.9, 0.1);
    armL.rotation.z = 0.6;
    armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, flesh);
    armR.position.set(0.5, 0.9, 0.1);
    armR.rotation.z = -0.6;
    armR.castShadow = true;
    g.add(armL, armR);
    (g as any).armL = armL;
    (g as any).armR = armR;

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.2, 0.6, 6, 8);
    const legL = new THREE.Mesh(legGeo, flesh);
    legL.position.set(-0.25, 0.35, 0);
    legL.castShadow = true;
    const legR = new THREE.Mesh(legGeo, flesh);
    legR.position.set(0.25, 0.35, 0);
    legR.castShadow = true;
    g.add(legL, legR);
    (g as any).legL = legL;
    (g as any).legR = legR;

    return g;
  }

  /** Abyssal Greatsword — heavy two-handed blade (boss weapon). */
  createGreatswordViewmodel(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'greatsword';
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 1.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x8a8a98, roughness: 0.3, metalness: 0.8, emissive: 0x1a1a2a, emissiveIntensity: 0.3 }),
    );
    blade.position.y = 0.9;
    blade.castShadow = true;
    g.add(blade);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.1, 0.2),
      this.boneMat,
    );
    guard.position.y = 0.05;
    g.add(guard);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a1a1a, roughness: 0.9 }),
    );
    handle.position.y = -0.25;
    g.add(handle);
    return g;
  }

  /** Energy Blade — glowing deflecting blade (boss weapon). */
  createEnergyBladeViewmodel(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'energyblade';
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.5, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x44ddff }),
    );
    blade.position.y = 0.75;
    g.add(blade);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.6, 0.45),
      new THREE.MeshBasicMaterial({ color: 0x44ddff, transparent: true, opacity: 0.3 }),
    );
    glow.position.y = 0.75;
    g.add(glow);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.5, metalness: 0.7 }),
    );
    handle.position.y = -0.2;
    g.add(handle);
    return g;
  }

  dispose(): void {
    [
      this.groundMat,
      this.wallMat,
      this.pillarMat,
      this.metalMat,
      this.fleshMat,
      this.boneMat,
    ].forEach((m) => m.dispose());
  }
}
