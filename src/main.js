import * as THREE from 'three';
import './style.css';
import {
  initAudio,
  resumeAudioContext,
  playShoot,
  playHitmarker,
  playHeadshot,
  playElimination,
  playDamage,
  playFootstep,
  playJump,
  playLand,
  playReload,
  playHeal,
  playCratePickup,
  playVictory,
  playDefeat,
  startAmbience,
  playScopeSwitch
} from './audio.js';
import { createTerrain, getTerrainHeight, resolveCollision, raycastWorldColliders, supplyCrates, MAP_SIZE, HALF_MAP } from './terrain.js';
import { StormSystem } from './storm.js';
import { Bot, BOT_NAMES } from './bot.js';
import { UIManager } from './ui.js';
import { PostProcessingManager } from './postprocessing.js';
import { VFXManager } from './vfx.js';
import { InputHandler } from './InputHandler.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { PlayerController, Stance } from './PlayerController.js';
import { WeaponSystem, WEAPON_SLOTS } from './WeaponSystem.js';

const State = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

class Game {
  constructor() {
    this.gameState = State.LOBBY;
    this.canvas = document.getElementById('game-canvas');

    // 1. Setup Three.js Renderer (ACESFilmic + Soft PCF Shadows)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.68;

    // 2. Scene
    this.scene = new THREE.Scene();

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 900);

    // 4. Environment & Lighting Manager
    this.environment = new EnvironmentManager(this.renderer, this.scene);

    // 5. VFX & Storm Systems
    this.vfxManager = new VFXManager(this.scene);
    this.storm = new StormSystem(this.scene);
    const { terrainMesh } = createTerrain(this.scene);
    this.terrainMesh = terrainMesh;

    // 6. Post Processing Pipeline (Unreal Bloom & Screen Shake)
    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera);

    // 7. Player Controller & Weapons System
    this.playerController = new PlayerController(this.scene, this.camera);
    this.player = this.playerController; // Alias for bot target checks
    this.weaponSystem = new WeaponSystem(this.scene, this.vfxManager);

    // 8. Tactical Glider Parachute & Deployment Shield Meshes
    this.setupParachuteAndShield();

    // 9. Input Handler (Standard PC Battle Royale Controls)
    this.input = new InputHandler(this.canvas);
    this.setupInputActions();

    // 10. UI Manager
    this.ui = new UIManager({
      onDeploy: () => this.deployGame(),
      onPause: () => this.pauseGame(),
      onResume: () => this.resumeGame(),
      onLeave: () => this.returnToLobby(),
      onRedeploy: () => this.deployGame(),
      onQualityChange: (q) => this.setRenderQuality(q),
      onDifficultyChange: (d) => { this.difficulty = d; },
      onOverlayChange: (isOpen) => this.input.setUIOpen(isOpen),
      onSelectSlot: (slot) => this.weaponSystem.switchSlot(slot),
      onCycleScope: () => {
        const newScope = this.weaponSystem.cycleScope();
        playScopeSwitch();
        this.playerController.character.setMountedScope(newScope.id);
        this.ui.updateActiveScope(newScope);
        this.ui.showAnnouncement(`OPTIC: ${newScope.name}`, 1500);
      }
    });
    this.difficulty = 'regular';

    // 11. Bot Operatives
    this.bots = [];

    // 12. Timing & Loop
    this.clock = new THREE.Clock();
    this.matchTime = 0;
    this.footstepTimer = 0;
    this.lobbyCamAngle = 0;

    window.addEventListener('resize', () => this.onWindowResize());

    this.ui.hideLoading();
    this.ui.showLobby();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupParachuteAndShield() {
    // High-Visibility Tactical Ram-Air Paraglider Wing
    this.parachuteMesh = new THREE.Group();

    // Materials for ram-air wing cells
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a2026,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const ventMat = new THREE.MeshBasicMaterial({ color: 0x0a0c0e });

    // 7 Ram-Air Aerodynamic Foil Cells (Curved Arc Span: 6.8m)
    const cellGeom = new THREE.BoxGeometry(0.92, 0.32, 2.4);
    const ventGeom = new THREE.BoxGeometry(0.75, 0.18, 0.08);

    const leftRiser = new THREE.Vector3(-0.35, 1.45, -0.05);
    const rightRiser = new THREE.Vector3(0.35, 1.45, -0.05);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 7; i++) {
      const cellX = (i - 3) * 0.95;
      const normalizedDist = (i - 3) / 3.0;
      const archDroop = Math.pow(normalizedDist, 2) * 0.48; // Downward curve toward wingtips
      const cellY = 3.35 - archDroop;

      // Color scheme: Center orange, middle white stripes, outer orange, tips dark graphite
      let mat = orangeMat;
      if (i === 1 || i === 5) mat = whiteMat;
      else if (i === 0 || i === 6) mat = darkMat;

      const cellMesh = new THREE.Mesh(cellGeom, mat);
      cellMesh.position.set(cellX, cellY, 0);
      cellMesh.rotation.z = -normalizedDist * 0.14; // Wingtip bank angle
      cellMesh.castShadow = true;
      this.parachuteMesh.add(cellMesh);

      // Front ram-air intake vent
      const vent = new THREE.Mesh(ventGeom, ventMat);
      vent.position.set(cellX, cellY, 1.18);
      vent.rotation.z = -normalizedDist * 0.14;
      this.parachuteMesh.add(vent);

      // Suspension Rigging Lines (Front and Rear Spars)
      const riser = cellX < 0 ? leftRiser : rightRiser;
      const frontAttach = new THREE.Vector3(cellX, cellY - 0.16, 0.85);
      const rearAttach = new THREE.Vector3(cellX, cellY - 0.16, -0.85);

      const frontLineGeo = new THREE.BufferGeometry().setFromPoints([riser, frontAttach]);
      this.parachuteMesh.add(new THREE.Line(frontLineGeo, lineMat));

      const rearLineGeo = new THREE.BufferGeometry().setFromPoints([riser, rearAttach]);
      this.parachuteMesh.add(new THREE.Line(rearLineGeo, lineMat));
    }

    // Wingtip endplate stabilizers
    const tipPlateGeom = new THREE.BoxGeometry(0.08, 0.65, 2.2);
    const leftTip = new THREE.Mesh(tipPlateGeom, darkMat);
    leftTip.position.set(-3.35, 2.8, 0);
    this.parachuteMesh.add(leftTip);

    const rightTip = new THREE.Mesh(tipPlateGeom, darkMat);
    rightTip.position.set(3.35, 2.8, 0);
    this.parachuteMesh.add(rightTip);

    // Steering toggles & brake lines to hands
    const brakeMat = new THREE.LineBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9 });
    const leftHandPos = new THREE.Vector3(-0.35, 1.35, 0.15);
    const rightHandPos = new THREE.Vector3(0.35, 1.35, 0.15);
    const leftBrakeGeo = new THREE.BufferGeometry().setFromPoints([
      leftHandPos,
      new THREE.Vector3(-3.1, 2.8, -1.0)
    ]);
    this.parachuteMesh.add(new THREE.Line(leftBrakeGeo, brakeMat));

    const rightBrakeGeo = new THREE.BufferGeometry().setFromPoints([
      rightHandPos,
      new THREE.Vector3(3.1, 2.8, -1.0)
    ]);
    this.parachuteMesh.add(new THREE.Line(rightBrakeGeo, brakeMat));

    this.parachuteMesh.visible = false;
    this.scene.add(this.parachuteMesh);

    // Glowing Neon Cyan Landing Shield Sphere
    const shieldGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);
  }

  setupInputActions() {
    this.input.onAction = (action) => {
      if (this.gameState !== State.PLAYING) return;

      switch (action) {
        case 'scope_cycle':
          const newScope = this.weaponSystem.cycleScope();
          playScopeSwitch();
          this.playerController.character.setMountedScope(newScope.id);
          this.ui.updateActiveScope(newScope);
          this.ui.showAnnouncement(`OPTIC: ${newScope.name}`, 1500);
          break;
        case 'fire_click':
          this.executePlayerShot();
          break;
        case 'reload':
          if (this.weaponSystem.startReload()) {
            playReload();
            this.playerController.character.playReload();
          }
          break;
        case 'heal':
          this.startHeal();
          break;
        case 'crouch':
          this.playerController.toggleCrouch();
          break;
        case 'prone':
          this.playerController.toggleProne();
          break;
        case 'weapon_1':
          this.weaponSystem.switchSlot(WEAPON_SLOTS.PRIMARY);
          break;
        case 'weapon_2':
          this.weaponSystem.switchSlot(WEAPON_SLOTS.SECONDARY);
          break;
        case 'weapon_holster':
          this.weaponSystem.switchSlot(WEAPON_SLOTS.HOLSTER);
          break;
        case 'inventory':
          this.ui.toggleInventory();
          break;
        case 'map':
          this.ui.toggleMap();
          break;
        case 'pause':
          if (this.ui.isOverlayOpen()) {
            this.ui.closeOverlays();
          } else {
            this.pauseGame();
          }
          break;
      }
    };
  }

  startHeal() {
    if (this.playerController.isGliding || this.playerController.health >= this.playerController.maxHealth || this.playerController.medkits <= 0) {
      return;
    }
    this.playerController.medkits--;
    this.playerController.health = Math.min(100, this.playerController.health + 40);
    playHeal();
    this.ui.showAnnouncement('✚ MEDKIT APPLIED (+40 HP)', 2000);
  }

  deployGame() {
    initAudio();
    resumeAudioContext();
    startAmbience();

    this.gameState = State.PLAYING;
    this.matchTime = 0;

    // Reset Player Stats
    this.playerController.health = 100;
    this.playerController.armor = 100;
    this.playerController.isDead = false;
    this.playerController.kills = 0;
    this.playerController.medkits = 3;
    this.playerController.character.resetPose();

    // Spawns high in sky for parachute glide
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 45 + Math.random() * 25;
    const px = Math.cos(spawnAngle) * spawnDist;
    const pz = Math.sin(spawnAngle) * spawnDist;
    const groundY = getTerrainHeight(px, pz);

    this.playerController.position.set(px, groundY + 45.0, pz);
    this.playerController.velocity.set(0, -6.5, 0);
    this.playerController.isGliding = true;
    this.playerController.isGrounded = false;
    this.playerController.isShielded = true;
    this.playerController.shieldTimer = 6.0;

    this.input.rawYaw = spawnAngle + Math.PI;
    this.input.yaw = this.input.rawYaw;
    this.input.rawPitch = 0.08;

    this.parachuteMesh.visible = true;
    this.shieldMesh.visible = true;

    // Reset Crates
    supplyCrates.forEach((c) => {
      c.collected = false;
      c.mesh.visible = true;
      c.beam.visible = true;
    });

    // Reset Storm
    this.storm.reset?.() || (this.storm = new StormSystem(this.scene));

    // Spawn 15 Bots safely > 90m away from player's sector
    this.bots.forEach(b => this.scene.remove(b.character.root));
    this.bots = [];

    for (let i = 0; i < BOT_NAMES.length; i++) {
      const bot = new Bot(
        i,
        BOT_NAMES[i],
        this.scene,
        this.weaponSystem,
        this.storm,
        this.difficulty,
        this.playerController.position
      );
      this.bots.push(bot);
    }

    this.ui.showHUD();
    this.ui.updateActiveScope(this.weaponSystem.currentScope);
    this.playerController.character.setMountedScope(this.weaponSystem.currentScopeId);
    this.ui.showAnnouncement('🪂 AIRBORNE — CLICK OR SPACE TO DROP FAST', 3500);

    this.input.requestPointerLock();
  }

  pauseGame() {
    if (this.gameState === State.PLAYING) {
      this.gameState = State.PAUSED;
      this.ui.showPause(true);
      this.input.exitPointerLock();
    }
  }

  resumeGame() {
    if (this.gameState === State.PAUSED) {
      this.gameState = State.PLAYING;
      this.ui.showPause(false);
      if (!this.ui.settings.touch) {
        this.input.requestPointerLock();
      }
    }
  }

  returnToLobby() {
    this.gameState = State.LOBBY;
    this.ui.showLobby();
    this.parachuteMesh.visible = false;
    this.shieldMesh.visible = false;
    this.input.exitPointerLock();
  }

  setRenderQuality(quality) {
    if (quality === 'performance') {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
      this.environment.sunLight.castShadow = false;
      this.postProcessing.enabled = false;
    } else if (quality === 'balanced') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.environment.sunLight.castShadow = true;
      this.postProcessing.enabled = true;
    } else if (quality === 'ultra') {
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.environment.sunLight.castShadow = true;
      this.postProcessing.enabled = true;
    }
  }

  getShotBlocker(origin, direction, maxDistance) {
    const colliderHit = raycastWorldColliders(origin, direction, maxDistance);
    const terrainRay = new THREE.Raycaster(origin, direction, 0, maxDistance);
    const terrainHits = terrainRay.intersectObject(this.terrainMesh);
    const terrainHit = terrainHits[0] || null;

    if (colliderHit && (!terrainHit || colliderHit.distance < terrainHit.distance)) {
      return colliderHit;
    }
    return terrainHit ? { point: terrainHit.point, distance: terrainHit.distance } : null;
  }

  executePlayerShot() {
    if (this.playerController.isDead || this.ui.isOverlayOpen()) return false;

    // If player attempts to shoot while airborne, drop immediately into combat
    if (this.playerController.isGliding) {
      this.playerController.cutParachute();
      this.parachuteMesh.visible = false;
      this.ui.showAnnouncement('BOOTS ON GROUND — ENGAGING TARGET', 1800);
    }

    if (this.weaponSystem.isReloading) return false;

    // Raycast aim direction through crosshair center
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    let aimHitPoint = null;
    const groundHits = raycaster.intersectObject(this.terrainMesh);
    if (groundHits.length > 0) {
      aimHitPoint = groundHits[0].point;
    } else {
      aimHitPoint = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 200);
    }

    const muzzlePos = this.playerController.getMuzzleWorldPos();
    this.weaponSystem.updateLaser(muzzlePos, aimHitPoint, this.input.isAiming);
    this.playerController.character.setMountedScope(this.weaponSystem.currentScopeId);

    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;

    const shotFired = this.weaponSystem.shoot(
      origin,
      dir,
      muzzlePos,
      (rayOrigin, shootDir, cutoff) => {
        // Check raycast hits against bots within range
        const combatRay = new THREE.Raycaster(rayOrigin, shootDir, 0.5, cutoff);
        combatRay.camera = this.camera;
        let closestHit = null;
        let minDistance = cutoff;

        for (let i = 0; i < this.bots.length; i++) {
          const bot = this.bots[i];
          if (bot.isDead) continue;

          const hits = combatRay.intersectObject(bot.character.root, true);
          if (hits.length > 0 && hits[0].distance < minDistance) {
            minDistance = hits[0].distance;
            closestHit = {
              hit: true,
              point: hits[0].point,
              bot,
              isHeadshot: hits[0].point.y > bot.position.y + 1.45
            };
          }
        }

        const blocker = this.getShotBlocker(rayOrigin, shootDir, cutoff);
        if (blocker && blocker.distance < minDistance) {
          this.vfxManager.spawnImpactSpark(blocker.point);
          return { hit: true, point: blocker.point };
        }

        if (closestHit) {
          this.handleBotDamage(closestHit.bot, closestHit.isHeadshot, closestHit.point);
          this.vfxManager.spawnImpactSpark(closestHit.point);
          return closestHit;
        }

        return { hit: false };
      },
      () => {
        // Spawn brass bullet shell casing, muzzle flash, and muzzle smoke
        const ejectPos = this.playerController.character.getEjectionWorldPosition();
        const rightDir = this.playerController.character.getRightDirection();
        this.vfxManager.ejectShell(ejectPos, rightDir);
        this.vfxManager.spawnMuzzleFlash(muzzlePos, this.weaponSystem.activeWeapon.id === 'ar4_upgraded');
      }
    );

    if (shotFired) {
      this.playerController.character.playRecoil();
      playShoot(this.weaponSystem.activeWeapon.id === 'ar4_upgraded');

      // Dynamic camera kick and bloom
      const recoilV = this.weaponSystem.activeWeapon.recoilVertical * 1.5;
      const recoilH = (Math.random() - 0.5) * this.weaponSystem.activeWeapon.recoilHorizontal * 1.2;
      this.playerController.addRecoilKick(recoilV, recoilH);
      this.postProcessing.addShake(0.065, 0.14);
      return true;
    } else {
      // If magazine is empty, trigger auto-reload
      if (this.weaponSystem.activeWeapon.currentMag <= 0 && this.weaponSystem.startReload()) {
        playReload();
        this.playerController.character.playReload();
      }
      return false;
    }
  }

  handlePlayerShooting(delta) {
    if (this.playerController.isDead || this.ui.isOverlayOpen()) return;

    // Laser & scope updating
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    let aimHitPoint = null;
    const groundHits = raycaster.intersectObject(this.terrainMesh);
    if (groundHits.length > 0) {
      aimHitPoint = groundHits[0].point;
    } else {
      aimHitPoint = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 200);
    }
    const muzzlePos = this.playerController.getMuzzleWorldPos();
    this.weaponSystem.updateLaser(muzzlePos, aimHitPoint, this.input.isAiming);
    this.playerController.character.setMountedScope(this.weaponSystem.currentScopeId);

    // Continuous fire while holding left-click
    if (this.input.isFiring) {
      this.executePlayerShot();
    }
  }

  handleBotDamage(bot, isHeadshot, hitPos) {
    const baseDamage = this.weaponSystem.activeWeapon.damage;
    const finalDamage = isHeadshot ? baseDamage * this.weaponSystem.activeWeapon.headshotMultiplier : baseDamage;

    this.ui.triggerHitmarker();
    if (isHeadshot) playHeadshot();
    else playHitmarker();

    this.vfxManager.spawnDamageNumber(hitPos, Math.round(finalDamage), isHeadshot);

    bot.takeDamage(finalDamage, 'PATHFINDER', (eliminated) => {
      this.playerController.kills++;
      playElimination();
      this.ui.addKillfeed('PATHFINDER', eliminated.name);
      this.ui.showAnnouncement(`ELIMINATED ${eliminated.name}`, 2200);
      this.checkMatchEnd();
    });
  }

  checkCratePickup() {
    supplyCrates.forEach((crate) => {
      if (crate.collected) return;
      const dist = crate.position.distanceTo(this.playerController.position);
      if (dist < 2.8) {
        crate.collected = true;
        crate.mesh.visible = false;
        crate.beam.visible = false;
        playCratePickup();

        if (crate.type === 'gold') {
          this.weaponSystem.inventory.primary.damage += 10;
          this.weaponSystem.inventory.primary.name = 'AR-4 MKII / GOLD';
          this.playerController.armor = Math.min(100, this.playerController.armor + 50);
          this.playerController.medkits = Math.min(5, this.playerController.medkits + 2);
          this.playerController.character.setUpgradeVisuals(true);
          this.ui.showAnnouncement('⭐ UPGRADED: AR-4 MKII GOLD (+50 ARMOR & MEDS)!', 3500);
        } else {
          this.weaponSystem.inventory.primary.currentReserve = Math.min(180, this.weaponSystem.inventory.primary.currentReserve + 60);
          this.weaponSystem.inventory.secondary.currentReserve = Math.min(198, this.weaponSystem.inventory.secondary.currentReserve + 66);
          this.playerController.armor = Math.min(100, this.playerController.armor + 35);
          this.playerController.medkits = Math.min(5, this.playerController.medkits + 1);
          this.ui.showAnnouncement('✚ SUPPLY CACHE (+35 ARMOR, +60 AMMO, +1 MEDKIT)', 2500);
        }
      }
    });
  }

  checkMatchEnd() {
    const aliveBots = this.bots.filter(b => !b.isDead).length;
    const totalAlive = (this.playerController.isDead ? 0 : 1) + aliveBots;

    if (this.playerController.isDead) {
      this.gameState = State.GAMEOVER;
      this.parachuteMesh.visible = false;
      this.shieldMesh.visible = false;
      this.input.exitPointerLock();
      const place = totalAlive + 1;
      this.ui.showResults({
        placement: place,
        kills: this.playerController.kills,
        survivalTime: this.matchTime,
        killedBy: 'an operative'
      });
    } else if (aliveBots === 0) {
      this.gameState = State.GAMEOVER;
      this.parachuteMesh.visible = false;
      this.shieldMesh.visible = false;
      this.input.exitPointerLock();
      playVictory();
      this.ui.showResults({
        placement: 1,
        kills: this.playerController.kills,
        survivalTime: this.matchTime
      });
    }
  }

  damagePlayer(amount, attackerName) {
    if (this.playerController.isDead || this.playerController.isGliding || this.playerController.isShielded) return;

    const res = this.playerController.applyDamage(amount, attackerName);
    if (!res.absorbed) {
      this.ui.triggerDamageFlash();
      this.postProcessing.addShake(0.08, 0.2);
      playDamage();

      if (this.playerController.isDead) {
        playDefeat();
        this.ui.addKillfeed(attackerName, 'PATHFINDER');
        this.checkMatchEnd();
      }
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.1, this.clock.getDelta());

    if (this.gameState === State.LOBBY) {
      this.lobbyCamAngle += delta * 0.2;
      this.camera.position.x = Math.cos(this.lobbyCamAngle) * 35;
      this.camera.position.z = Math.sin(this.lobbyCamAngle) * 35;
      this.camera.position.y = 12;
      this.camera.lookAt(0, 4, 0);
    } else if (this.gameState === State.PLAYING) {
      this.matchTime += delta;

      // 1. Input update
      this.input.update(delta);
      const moveVec = this.input.getMovementVector();
      const isSprinting = this.input.isSprinting();
      const isJumping = this.input.isJumping();

      // 2. Player movement & camera physics
      if (isJumping && this.playerController.isGliding) {
        this.playerController.cutParachute();
        this.parachuteMesh.visible = false;
        this.ui.showAnnouncement('BOOTS ON GROUND — COMBAT READY', 1800);
      }

      this.playerController.updateMovement(delta, moveVec, isSprinting, isJumping, this.input.yaw);
      this.playerController.updateCamera(delta, this.input.yaw, this.input.pitch, this.input.isAiming, isSprinting, this.terrainMesh, this.weaponSystem.currentScope);
      this.ui.updateScopeOverlay(this.input.isAiming, this.weaponSystem.currentScope);

      // Footstep sound cadence
      if (moveVec.isMoving && this.playerController.isGrounded && !this.playerController.isGliding) {
        this.footstepTimer -= delta;
        if (this.footstepTimer <= 0) {
          playFootstep();
          this.footstepTimer = isSprinting ? 0.28 : 0.42;
        }
      }

      // Parachute & Shield visual sync
      if (this.playerController.isGliding) {
        this.parachuteMesh.visible = true;
        this.parachuteMesh.position.copy(this.playerController.position);
        this.parachuteMesh.rotation.y = this.input.yaw;

        // Dynamic aerodynamic tilt: bank when strafing, pitch forward during flight
        const targetBank = -moveVec.x * 0.22;
        this.parachuteMesh.rotation.z = THREE.MathUtils.lerp(this.parachuteMesh.rotation.z || 0, targetBank, delta * 8.0);
        const targetPitch = moveVec.z < 0 ? 0.08 : -0.05;
        this.parachuteMesh.rotation.x = THREE.MathUtils.lerp(this.parachuteMesh.rotation.x || 0, targetPitch, delta * 8.0);

        this.shieldMesh.visible = true;
        this.shieldMesh.position.copy(this.playerController.position).add(new THREE.Vector3(0, 1.1, 0));
        this.shieldMesh.rotation.y += delta * 2.0;
      } else if (this.playerController.isShielded) {
        this.parachuteMesh.visible = false;
        this.shieldMesh.visible = true;
        this.shieldMesh.position.copy(this.playerController.position).add(new THREE.Vector3(0, 1.1, 0));
        this.shieldMesh.rotation.y += delta * 2.5;
      } else {
        this.parachuteMesh.visible = false;
        this.shieldMesh.visible = false;
      }

      // 3. Combat & Ballistics
      this.weaponSystem.update(
        delta,
        this.playerController,
        this.input.isAiming,
        moveVec.isMoving,
        isSprinting,
        this.playerController.currentStance
      );
      this.handlePlayerShooting(delta);

      // 3.5 Environment wind animation
      this.environment.update(delta);

      // 4. Storm update
      this.storm.update(delta);
      if (this.storm.isOutsideSafeZone(this.playerController.position.x, this.playerController.position.z)) {
        const stormDmg = this.storm.getCurrentDamage() * delta;
        this.damagePlayer(stormDmg, 'THE STORM');
      }

      // 5. Bots update
      this.bots.forEach((bot) => {
        bot.update(
          delta,
          this.playerController,
          this.bots,
          (shootingBot, muzzle, dir) => {
            const blocker = this.getShotBlocker(muzzle, dir, 80);

            // Check bot bullet vs player
            if (!this.playerController.isDead && !this.playerController.isGliding && !this.playerController.isShielded) {
              const toPlayer = this.playerController.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(muzzle);
              const dist = toPlayer.length();
              if (dist < 75) {
                const dot = dir.dot(toPlayer.clone().normalize());
                let threshold = 0.993;
                if (this.difficulty === 'recruit') threshold = 0.997;
                else if (this.difficulty === 'veteran') threshold = 0.988;

                if (dot > threshold) {
                  let dmg = 6 + Math.random() * 3;
                  if (this.difficulty === 'recruit') dmg = 4 + Math.random() * 2;
                  else if (this.difficulty === 'veteran') dmg = 9 + Math.random() * 4;
                  if (!blocker || dist < blocker.distance) {
                    this.damagePlayer(dmg, shootingBot.name);
                  }
                }
              }
            }

            // Check bot bullet vs other bots
            this.bots.forEach((other) => {
              if (other.id !== shootingBot.id && !other.isDead) {
                const toOther = other.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(muzzle);
                const dist = toOther.length();
                if (dist < 80 && (!blocker || dist < blocker.distance)) {
                  const dot = dir.dot(toOther.clone().normalize());
                  if (dot > 0.985) {
                    other.takeDamage(18, shootingBot.name, (eliminated) => {
                      this.ui.addKillfeed(shootingBot.name, eliminated.name);
                      this.checkMatchEnd();
                    });
                  }
                }
              }
            });

            this.ui.addRadarPing(shootingBot.position.x, shootingBot.position.z);
            return blocker ? blocker.point : null;
          },
          (eliminatedBot, killerName) => {
            this.ui.addKillfeed(killerName, eliminatedBot.name);
            this.checkMatchEnd();
          }
        );
      });

      // 6. VFX & Crates
      this.vfxManager.update(delta, this.playerController.position);
      this.checkCratePickup();

      // 7. UI updates
      const aliveBots = this.bots.filter(b => !b.isDead).length;
      const aliveCount = (this.playerController.isDead ? 0 : 1) + aliveBots;

      const playerStatus = {
        kills: this.playerController.kills,
        health: this.playerController.health,
        armor: this.playerController.armor,
        medkits: this.playerController.medkits,
        isGliding: this.playerController.isGliding,
        isShielded: this.playerController.isShielded,
        shieldTimer: this.playerController.shieldTimer,
        actionStatus: this.weaponSystem.isReloading ? 'RELOADING...' : `${this.weaponSystem.activeWeapon.name} READY`,
        currentWeapon: this.weaponSystem.activeWeapon,
        currentAmmo: this.weaponSystem.activeWeapon.currentMag,
        currentReserve: this.weaponSystem.activeWeapon.currentReserve,
        position: this.playerController.position
      };

      this.ui.updatePlayerHUD(playerStatus, this.storm, aliveCount);
      this.ui.updateCompass(this.input.yaw);
      this.ui.renderMinimap(this.playerController.position, this.input.yaw, this.storm, delta);
      this.ui.updateInventoryUI(this.weaponSystem, this.playerController);
      this.ui.renderBigMap(this.playerController.position, this.input.yaw, this.storm);
    }

    // 8. Render Scene via Post Processing
    this.postProcessing.update(delta);
    this.postProcessing.render(delta);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing.setSize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new Game();
  } catch (err) {
    console.error('Fatal initialization error:', err);
    const fatal = document.getElementById('fatal');
    const msg = document.getElementById('fatal-message');
    if (fatal) fatal.hidden = false;
    if (msg) msg.textContent = err.message || 'Error initializing 3D WebGL context.';
  }
});
