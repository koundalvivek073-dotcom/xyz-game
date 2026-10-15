import * as THREE from 'three';
import { getTerrainHeight } from './terrain.js';
import { playShellDrop } from './audio.js';

export class VFXManager {
  constructor(scene) {
    this.scene = scene;
    this.damageNumbers = [];
    this.shells = [];
    this.muzzleFlashes = [];
    this.impactSparks = [];
    this.impactPuffs = [];
    this.smokeWisps = [];

    // High-visibility, realistic brass cartridge casing mesh
    // Scaled for third-person visibility with authentic golden brass sheen
    this.shellGeo = new THREE.CylinderGeometry(0.025, 0.027, 0.095, 8);
    this.shellGeo.rotateZ(Math.PI / 2);
    this.shellMat = new THREE.MeshStandardMaterial({
      color: 0xedc555,
      metalness: 0.96,
      roughness: 0.22,
      emissive: 0x443005,
      emissiveIntensity: 0.25
    });

    // Muzzle flash geometries
    this.muzzleFlashGeo = new THREE.PlaneGeometry(0.7, 0.7);
    this.muzzleFlashMat = new THREE.MeshBasicMaterial({
      color: 0xffea55,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.muzzleFlashGeo2 = new THREE.PlaneGeometry(0.55, 0.55);

    // Impact spark geometry
    this.sparkGeo = new THREE.SphereGeometry(0.045, 4, 4);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffd244,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Atmospheric desert dust particles
    this.setupDustParticles();
  }

  setupDustParticles() {
    const count = 400;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 30 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xe2cfa8,
      size: 0.2,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.scene.add(this.dustParticles);
  }

  // ─────────────── MUZZLE FLASH VFX ───────────────
  spawnMuzzleFlash(position, isGold = false) {
    if (!position) return;

    const flashColor = isGold ? 0xfff077 : 0xffea55;

    // Cross-quad star-burst planes
    const mat1 = this.muzzleFlashMat.clone();
    mat1.color.setHex(flashColor);
    const flash1 = new THREE.Mesh(this.muzzleFlashGeo, mat1);
    flash1.position.copy(position);
    this.scene.add(flash1);

    const mat2 = this.muzzleFlashMat.clone();
    mat2.color.setHex(0xffaa22);
    const flash2 = new THREE.Mesh(this.muzzleFlashGeo2, mat2);
    flash2.position.copy(position);
    flash2.rotation.z = Math.PI / 4 + Math.random() * 0.5;
    this.scene.add(flash2);

    // Dynamic point light for flash illumination
    const flashLight = new THREE.PointLight(flashColor, 3.5, 9.0);
    flashLight.position.copy(position);
    this.scene.add(flashLight);

    this.muzzleFlashes.push({
      meshes: [flash1, flash2],
      light: flashLight,
      life: 0.11,
      maxLife: 0.11,
      startScale: 0.45 + Math.random() * 0.35
    });

    this.spawnMuzzleSmoke(position);
  }

  // Muzzle smoke wisp
  spawnMuzzleSmoke(position) {
    const smokeGeo = new THREE.SphereGeometry(0.08, 5, 5);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x999999,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const smoke = new THREE.Mesh(smokeGeo, smokeMat);
    smoke.position.copy(position);
    this.scene.add(smoke);

    this.smokeWisps.push({
      mesh: smoke,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.8 + Math.random() * 0.6,
        (Math.random() - 0.5) * 0.4
      ),
      life: 0.35,
      maxLife: 0.35
    });
  }

  // ─────────────── BULLET IMPACT SPARKS & DIRT PUFF ───────────────
  spawnImpactSpark(position) {
    if (!position) return;

    // High velocity glowing sparks
    const sparkCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < sparkCount; i++) {
      const spark = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
      spark.position.copy(position);
      this.scene.add(spark);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        2.0 + Math.random() * 4,
        (Math.random() - 0.5) * 6
      );

      this.impactSparks.push({
        mesh: spark,
        velocity: vel,
        life: 0.32 + Math.random() * 0.22,
        maxLife: 0.54
      });
    }

    // Expanding dirt impact dust cloud
    const puffGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0xbaa482,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const puff = new THREE.Mesh(puffGeo, puffMat);
    puff.position.copy(position);
    this.scene.add(puff);

    this.impactPuffs.push({
      mesh: puff,
      life: 0.45,
      maxLife: 0.45
    });
  }

  // Floating 3D damage number
  spawnDamageNumber(position, amount, isCrit = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.font = isCrit ? 'bold 54px Arial, sans-serif' : 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = isCrit ? '#ff2200' : '#000000';
    ctx.shadowBlur = 10;
    ctx.fillStyle = isCrit ? '#ffee44' : '#ffffff';

    const text = isCrit ? `-${Math.round(amount)} CRIT!` : `-${Math.round(amount)}`;
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);

    sprite.position.copy(position).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0.6 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.4
    ));
    sprite.scale.set(1.4, 0.7, 1);
    this.scene.add(sprite);

    this.damageNumbers.push({
      sprite,
      velocity: new THREE.Vector3(0, 1.8, 0),
      life: 0.85,
      maxLife: 0.85
    });
  }

  // Eject brass bullet shell from weapon ejection port
  ejectShell(position, rightDir) {
    if (!position || !rightDir) return;

    const shell = new THREE.Mesh(this.shellGeo, this.shellMat.clone());
    shell.position.copy(position);
    this.scene.add(shell);

    // Eject sideways (+X) with upward thrust and backward kick
    const vel = rightDir.clone().multiplyScalar(3.2 + Math.random() * 1.6);
    vel.y += 2.4 + Math.random() * 1.4;
    vel.x += (Math.random() - 0.5) * 0.8;
    vel.z += (Math.random() - 0.5) * 0.8;

    const rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 45,
      (Math.random() - 0.5) * 45,
      (Math.random() - 0.5) * 45
    );

    this.shells.push({
      mesh: shell,
      velocity: vel,
      rotVelocity: rotVel,
      life: 6.0, // Lingers on ground
      maxLife: 6.0,
      bounces: 0,
      settled: false
    });
  }

  update(delta, playerPos) {
    // 1. Update Damage Numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= delta;

      dn.sprite.position.addScaledVector(dn.velocity, delta);
      dn.velocity.y *= 0.95;

      const alpha = dn.life / dn.maxLife;
      dn.sprite.material.opacity = alpha;
      dn.sprite.scale.multiplyScalar(1 + delta * 0.3);

      if (dn.life <= 0) {
        this.scene.remove(dn.sprite);
        dn.sprite.material.map.dispose();
        dn.sprite.material.dispose();
        this.damageNumbers.splice(i, 1);
      }
    }

    // 2. Update Bullet Shells with Real Terrain Bouncing
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= delta;

      if (!sh.settled) {
        sh.velocity.y -= 18.0 * delta; // Realistic gravity
        sh.mesh.position.addScaledVector(sh.velocity, delta);

        sh.mesh.rotation.x += sh.rotVelocity.x * delta;
        sh.mesh.rotation.y += sh.rotVelocity.y * delta;
        sh.mesh.rotation.z += sh.rotVelocity.z * delta;

        // Accurate terrain collision
        const groundY = getTerrainHeight(sh.mesh.position.x, sh.mesh.position.z);
        if (sh.mesh.position.y <= groundY + 0.04) {
          sh.mesh.position.y = groundY + 0.04;

          if (sh.bounces < 3) {
            sh.velocity.y = Math.abs(sh.velocity.y) * 0.42;
            sh.velocity.x *= 0.55;
            sh.velocity.z *= 0.55;
            sh.rotVelocity.multiplyScalar(0.5);
            sh.bounces++;
            playShellDrop();
          } else {
            // Settle flat on terrain
            sh.settled = true;
            sh.velocity.set(0, 0, 0);
            sh.rotVelocity.set(0, 0, 0);
            sh.mesh.position.y = groundY + 0.025;
            sh.mesh.rotation.x = Math.PI / 2;
          }
        }
      }

      // Smooth fade-out in final 1.5 seconds
      if (sh.life < 1.5) {
        sh.mesh.material.transparent = true;
        sh.mesh.material.opacity = Math.max(0, sh.life / 1.5);
      }

      if (sh.life <= 0) {
        this.scene.remove(sh.mesh);
        sh.mesh.material.dispose();
        this.shells.splice(i, 1);
      }
    }

    // 3. Update Muzzle Flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      mf.life -= delta;

      const t = Math.max(0, mf.life / mf.maxLife);
      const scale = mf.startScale * (1 + (1 - t) * 2.2);
      mf.meshes.forEach(m => {
        m.material.opacity = t;
        m.scale.set(scale, scale, scale);
      });

      mf.light.intensity = 3.5 * t;

      if (mf.life <= 0) {
        mf.meshes.forEach(m => {
          this.scene.remove(m);
          m.material.dispose();
        });
        this.scene.remove(mf.light);
        this.muzzleFlashes.splice(i, 1);
      }
    }

    // 4. Update Smoke Wisps
    for (let i = this.smokeWisps.length - 1; i >= 0; i--) {
      const sm = this.smokeWisps[i];
      sm.life -= delta;
      sm.mesh.position.addScaledVector(sm.velocity, delta);
      const t = Math.max(0, sm.life / sm.maxLife);
      sm.mesh.material.opacity = t * 0.35;
      const s = 1.0 + (1.0 - t) * 1.8;
      sm.mesh.scale.set(s, s, s);

      if (sm.life <= 0) {
        this.scene.remove(sm.mesh);
        sm.mesh.material.dispose();
        sm.smokeWisps?.splice(i, 1) || this.smokeWisps.splice(i, 1);
      }
    }

    // 5. Update Impact Sparks
    for (let i = this.impactSparks.length - 1; i >= 0; i--) {
      const sp = this.impactSparks[i];
      sp.life -= delta;

      sp.velocity.y -= 14 * delta;
      sp.mesh.position.addScaledVector(sp.velocity, delta);
      sp.mesh.material.opacity = Math.max(0, sp.life / sp.maxLife);

      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.material.dispose();
        this.impactSparks.splice(i, 1);
      }
    }

    // 6. Update Dirt Impact Puffs
    for (let i = this.impactPuffs.length - 1; i >= 0; i--) {
      const pf = this.impactPuffs[i];
      pf.life -= delta;
      const t = Math.max(0, pf.life / pf.maxLife);
      pf.mesh.material.opacity = t * 0.5;
      const s = 1.0 + (1.0 - t) * 3.5;
      pf.mesh.scale.set(s, s * 0.6, s);

      if (pf.life <= 0) {
        this.scene.remove(pf.mesh);
        pf.mesh.material.dispose();
        this.impactPuffs.splice(i, 1);
      }
    }

    // 7. Keep dust particles centered near player
    if (this.dustParticles && playerPos) {
      this.dustParticles.position.x = playerPos.x;
      this.dustParticles.position.z = playerPos.z;
    }
  }
}
