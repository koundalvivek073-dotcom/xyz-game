import * as THREE from 'three';

export const WEAPON_SLOTS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  HOLSTER: 'holster'
};

export const SCOPE_CONFIGS = {
  iron: {
    id: 'iron',
    name: 'IRON SIGHTS (1X)',
    zoom: 1.0,
    fov: 62,
    reticleType: 'iron',
    hudName: '1X IRON',
    sway: 0.002
  },
  holo: {
    id: 'holo',
    name: 'EOTECH HOLOGRAPHIC (1.8X)',
    zoom: 1.8,
    fov: 42,
    reticleType: 'holo',
    hudName: '1.8X HOLO',
    sway: 0.003
  },
  acog: {
    id: 'acog',
    name: 'ACOG TACTICAL (4X)',
    zoom: 4.0,
    fov: 22,
    reticleType: 'acog',
    hudName: '4X ACOG',
    sway: 0.005
  },
  sniper: {
    id: 'sniper',
    name: 'VARIABLE SNIPER (8X)',
    zoom: 8.0,
    fov: 11,
    reticleType: 'sniper',
    hudName: '8X SNIPER',
    sway: 0.008
  }
};

export const SCOPE_ORDER = ['iron', 'holo', 'acog', 'sniper'];

export const WEAPON_REGISTRY = {
  ar4: {
    id: 'ar4',
    slot: WEAPON_SLOTS.PRIMARY,
    name: 'AR-4 / 5.56 NATO',
    ammoType: '5.56mm',
    damage: 32,
    headshotMultiplier: 2.2,
    fireRate: 0.095, // ~630 RPM
    magSize: 30,
    maxReserve: 180,
    reloadTime: 1.6,
    hipSpread: 0.035,
    aimSpread: 0.006,
    range: 280,
    hybridCutoff: 15.0,
    muzzleVelocity: 880.0,
    recoilVertical: 0.022,
    recoilHorizontal: 0.010,
    tracerColor: 0xffea55
  },
  vector9: {
    id: 'vector9',
    slot: WEAPON_SLOTS.SECONDARY,
    name: 'VECTOR-9 / 9MM',
    ammoType: '9mm',
    damage: 22,
    headshotMultiplier: 1.9,
    fireRate: 0.065, // ~920 RPM
    magSize: 33,
    maxReserve: 198,
    reloadTime: 1.3,
    hipSpread: 0.045,
    aimSpread: 0.012,
    range: 180,
    muzzleVelocity: 720.0,
    recoilVertical: 0.015,
    recoilHorizontal: 0.014,
    tracerColor: 0x66eeff
  },
  sidearm: {
    id: 'sidearm',
    slot: WEAPON_SLOTS.HOLSTER,
    name: 'P-9 TACTICAL SIDEARM',
    ammoType: '.45 ACP',
    damage: 42,
    headshotMultiplier: 2.1,
    fireRate: 0.22,
    magSize: 12,
    maxReserve: 72,
    reloadTime: 1.1,
    hipSpread: 0.025,
    aimSpread: 0.005,
    range: 140,
    muzzleVelocity: 580.0,
    recoilVertical: 0.032,
    recoilHorizontal: 0.008,
    tracerColor: 0xffaa33
  }
};

export class WeaponSystem {
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;

    // Loadout slots
    this.inventory = {
      [WEAPON_SLOTS.PRIMARY]: { ...WEAPON_REGISTRY.ar4, currentMag: 30, currentReserve: 150 },
      [WEAPON_SLOTS.SECONDARY]: { ...WEAPON_REGISTRY.vector9, currentMag: 33, currentReserve: 132 },
      [WEAPON_SLOTS.HOLSTER]: { ...WEAPON_REGISTRY.sidearm, currentMag: 12, currentReserve: 48 }
    };

    this.activeSlot = WEAPON_SLOTS.PRIMARY;
    this.activeWeapon = this.inventory[this.activeSlot];

    // Scopes system
    this.currentScopeId = 'holo';
    this.currentScope = SCOPE_CONFIGS.holo;
    this.onScopeChange = null;

    // State
    this.fireCooldown = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.currentBloom = 0;

    // Tracers pool
    this.tracers = [];
    this.tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
    this.tracerGeo.rotateX(Math.PI / 2);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffea66,
      transparent: true,
      opacity: 0.95
    });

    // Tactical Laser Sight
    this.setupLaserSight();
  }

  setupLaserSight() {
    const laserGeo = new THREE.CylinderGeometry(0.007, 0.007, 1, 4);
    laserGeo.rotateX(Math.PI / 2);
    this.laserBeam = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6
    }));
    this.laserBeam.visible = false;
    this.scene.add(this.laserBeam);
  }

  cycleScope() {
    const currentIndex = SCOPE_ORDER.indexOf(this.currentScopeId);
    const nextIndex = (currentIndex + 1) % SCOPE_ORDER.length;
    this.currentScopeId = SCOPE_ORDER[nextIndex];
    this.currentScope = SCOPE_CONFIGS[this.currentScopeId];
    if (this.onScopeChange) this.onScopeChange(this.currentScope);
    return this.currentScope;
  }

  setScope(scopeId) {
    if (!SCOPE_CONFIGS[scopeId]) return;
    this.currentScopeId = scopeId;
    this.currentScope = SCOPE_CONFIGS[scopeId];
    if (this.onScopeChange) this.onScopeChange(this.currentScope);
    return this.currentScope;
  }

  switchSlot(slot) {
    if (this.isReloading) return;
    if (!this.inventory[slot]) return;

    this.activeSlot = slot;
    this.activeWeapon = this.inventory[slot];
    this.fireCooldown = 0.2;
    this.currentBloom = this.activeWeapon.hipSpread;
  }

  startReload() {
    if (this.isReloading || this.activeWeapon.currentMag >= this.activeWeapon.magSize || this.activeWeapon.currentReserve <= 0) {
      return false;
    }

    this.isReloading = true;
    this.reloadTimer = this.activeWeapon.reloadTime;
    return true;
  }

  finishReload() {
    const needed = this.activeWeapon.magSize - this.activeWeapon.currentMag;
    const taken = Math.min(needed, this.activeWeapon.currentReserve);
    this.activeWeapon.currentMag += taken;
    this.activeWeapon.currentReserve -= taken;
    this.isReloading = false;
  }

  update(delta, player, isAiming, isMoving, isSprinting, stance) {
    // 1. Fire Cooldowns
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }

    // 2. Reload Timer
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    // 3. Dynamic Reticle Bloom
    let targetSpread = isAiming ? this.activeWeapon.aimSpread : this.activeWeapon.hipSpread;
    if (isAiming && this.currentScope) {
      targetSpread /= Math.sqrt(this.currentScope.zoom);
    }
    if (isSprinting) targetSpread *= 2.2;
    else if (isMoving) targetSpread *= 1.35;

    if (stance === 'CROUCH') targetSpread *= 0.72;
    else if (stance === 'PRONE') targetSpread *= 0.45;

    this.currentBloom = THREE.MathUtils.lerp(this.currentBloom, targetSpread, delta * 14.0);

    // 4. Update Bullet Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= delta;
      tr.mesh.position.addScaledVector(tr.velocity, delta);
      tr.mesh.material.opacity = Math.max(0, tr.life / tr.maxLife);

      if (tr.life <= 0) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  // Shoot execution with full distance coverage & precise hit detection
  shoot(origin, direction, muzzlePos, onHitTarget, onSpawnShell) {
    if (this.fireCooldown > 0 || this.isReloading) return false;
    if (this.activeWeapon.currentMag <= 0) {
      this.startReload();
      return false;
    }

    this.activeWeapon.currentMag--;
    this.fireCooldown = this.activeWeapon.fireRate;

    // Crosshair bloom expand
    this.currentBloom = Math.min(this.currentBloom + 0.015, 0.09);

    // Spread Cone calculation (magnified scopes increase center precision)
    const scopeFactor = this.currentScope ? (1.0 / Math.sqrt(this.currentScope.zoom)) : 1.0;
    const spreadMult = this.currentBloom * scopeFactor;
    const spreadX = (Math.random() - 0.5) * spreadMult;
    const spreadY = (Math.random() - 0.5) * spreadMult;
    const spreadDir = direction.clone();
    spreadDir.x += spreadX;
    spreadDir.y += spreadY;
    spreadDir.normalize();

    // Check hit target across full weapon range
    const maxRange = this.activeWeapon.range || 280;
    const hitResult = onHitTarget(origin, spreadDir, maxRange);

    let endPoint = null;
    if (hitResult && hitResult.hit) {
      endPoint = hitResult.point;
    } else {
      endPoint = origin.clone().addScaledVector(spreadDir, maxRange);
    }

    // Spawn dramatic visible tracer from weapon muzzle to impact/target point
    this.spawnTracer(muzzlePos, endPoint, this.activeSlot === WEAPON_SLOTS.PRIMARY ? 0 : 1);

    if (onSpawnShell) onSpawnShell();
    return true;
  }

  spawnTracer(from, to, mode = 0) {
    if (!from || !to) return;
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.3) return;

    const tracerColor = mode === 1 ? 0x00e5ff : (mode === 2 ? 0xffbb22 : 0xffea33);

    // 1. Instant full-length high-intensity laser tracer beam (persists 0.10s)
    const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, dist, 6);
    const beamMat = new THREE.MeshBasicMaterial({
      color: tracerColor,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(from).addScaledVector(dir, 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(beam);

    this.tracers.push({
      mesh: beam,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.10,
      maxLife: 0.10
    });

    // 2. High-speed white tracer pellet with dynamic illumination
    const pelletGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const pelletMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthWrite: false
    });
    const pellet = new THREE.Mesh(pelletGeo, pelletMat);
    pellet.position.copy(from);
    this.scene.add(pellet);

    const speed = 190.0;
    const pelletLife = Math.min(0.5, Math.max(0.08, dist / speed));
    this.tracers.push({
      mesh: pellet,
      velocity: dir.clone().normalize().multiplyScalar(speed),
      life: pelletLife,
      maxLife: pelletLife
    });
  }

  // Laser sight alignment
  updateLaser(muzzlePos, targetHitPoint, isAiming) {
    if (!isAiming || !muzzlePos || !targetHitPoint) {
      this.laserBeam.visible = false;
      return;
    }
    const dir = new THREE.Vector3().subVectors(targetHitPoint, muzzlePos);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(muzzlePos, targetHitPoint).multiplyScalar(0.5);

    this.laserBeam.visible = true;
    this.laserBeam.position.copy(mid);
    this.laserBeam.scale.set(1, 1, Math.max(len, 0.1));
    this.laserBeam.lookAt(targetHitPoint);
  }

  // Compatibility methods for bots calling createTracer & createMuzzleFlash
  createTracer(from, to, isGold = false) {
    this.spawnTracer(from, to, isGold ? 1 : 0);
  }

  createMuzzleFlash(position, isGold = false) {
    if (this.vfxManager && this.vfxManager.spawnMuzzleFlash) {
      this.vfxManager.spawnMuzzleFlash(position, isGold);
    }
  }
}
