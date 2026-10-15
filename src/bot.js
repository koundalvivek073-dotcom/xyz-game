import * as THREE from 'three';
import { createCharacter } from './character.js';
import { getTerrainHeight, resolveCollision, supplyCrates } from './terrain.js';
import { WEAPON_CONFIGS } from './weapons.js';

export const BOT_NAMES = [
  'Viper', 'Ghost', 'Apex', 'Recon-9', 'Specter',
  'Titan', 'Raptor', 'Nomad', 'Hawk', 'Striker',
  'Raven', 'Zero', 'Blaze', 'Shadow', 'Cobra'
];

export class Bot {
  constructor(id, name, scene, weaponManager, storm, difficulty = 'regular', playerSpawnPos = null) {
    this.id = id;
    this.name = name;
    this.scene = scene;
    this.weaponManager = weaponManager;
    this.storm = storm;
    this.difficulty = difficulty;

    this.health = 100;
    this.maxHealth = 100;
    this.isDead = false;

    // Movement & state
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.rotationY = Math.random() * Math.PI * 2;
    this.targetRotationY = this.rotationY;

    this.state = 'PATROL'; // 'PATROL', 'ZONE_RUSH', 'COMBAT'
    this.target = null;
    this.targetPos = new THREE.Vector3();
    this.waypointTimer = 0;

    // Combat timers & reaction delay
    this.alertTimer = 0; // Human-like reaction delay before shooting
    this.burstTimer = 0;
    this.shotsInBurst = 0;
    this.burstCooldown = 2.0; // Initial delay
    this.strafeTimer = 0;
    this.strafeDir = 1;

    // Weapon
    this.weapon = { ...WEAPON_CONFIGS.standard };

    // Visual model
    const camoPalette = [0x5c4f3f, 0x474f44, 0x544747, 0x3d474b];
    const visorPalette = [0xff4433, 0xff8833, 0xffbb22, 0xee3355];
    const colorIdx = id % camoPalette.length;

    this.character = createCharacter({
      isPlayer: false,
      name: this.name,
      camoColor: camoPalette[colorIdx],
      visorColor: visorPalette[colorIdx]
    });
    this.scene.add(this.character.root);

    // Initial safe spawn on the map away from player
    this.spawn(playerSpawnPos);
  }

  spawn(avoidPos = null) {
    let attempts = 0;
    let x = 0, z = 0, distToPlayer = 0;

    // Ensure bot spawns at least 90m away from player's drop location
    do {
      const angle = (this.id / 15) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 75 + Math.random() * 75;
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;

      if (avoidPos) {
        distToPlayer = Math.hypot(x - avoidPos.x, z - avoidPos.z);
      } else {
        distToPlayer = 100;
      }
      attempts++;
    } while (distToPlayer < 90 && attempts < 15);

    const y = getTerrainHeight(x, z);
    this.position.set(x, y, z);
    this.character.root.position.copy(this.position);
    this.pickNewWaypoint();
  }

  pickNewWaypoint() {
    this.waypointTimer = 4 + Math.random() * 5;

    if (this.storm.isOutsideSafeZone(this.position.x, this.position.z)) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (this.storm.currentRadius * 0.7);
      this.targetPos.set(
        this.storm.currentCenter.x + Math.cos(angle) * r,
        0,
        this.storm.currentCenter.y + Math.sin(angle) * r
      );
      this.state = 'ZONE_RUSH';
      return;
    }

    const nearbyCrate = supplyCrates.find(
      c => !c.collected && c.position.distanceTo(this.position) < 45
    );
    if (nearbyCrate && Math.random() < 0.6) {
      this.targetPos.copy(nearbyCrate.position);
      return;
    }

    const wanderDist = 20 + Math.random() * 30;
    const angle = Math.random() * Math.PI * 2;
    this.targetPos.set(
      this.position.x + Math.cos(angle) * wanderDist,
      0,
      this.position.z + Math.sin(angle) * wanderDist
    );
  }

  takeDamage(amount, attackerName, onEliminated) {
    if (this.isDead) return;

    this.health -= amount;
    this.character.updateNameplate(this.health, this.maxHealth);

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.character.setDead();
      if (onEliminated) {
        onEliminated(this, attackerName);
      }
    }
  }

  update(delta, player, otherBots, onBotShoot, onBotEliminated) {
    if (this.isDead) {
      this.character.updateAnimation(delta, 0, true, false);
      return;
    }

    const distToPlayer = this.position.distanceTo(player.position);
    this.character.updateNameplate(this.health, this.maxHealth, distToPlayer);

    // 1. Storm damage
    if (this.storm.isOutsideSafeZone(this.position.x, this.position.z)) {
      const stormDmg = this.storm.getCurrentDamage() * delta;
      this.takeDamage(stormDmg, 'THE STORM', onBotEliminated);
      if (this.isDead) return;
    }

    // 2. Perception & Target acquisition
    this.detectTargets(player, otherBots);

    // 3. Prioritize getting back inside the current safe zone over combat.
    let moveSpeed = 0;
    const outsideSafeZone = this.storm.isOutsideSafeZone(this.position.x, this.position.z);
    const targetOutsideSafeZone = this.storm.isOutsideSafeZone(this.targetPos.x, this.targetPos.z);
    if (outsideSafeZone) {
      if (this.state !== 'ZONE_RUSH' || this.waypointTimer <= 0 || targetOutsideSafeZone) {
        this.pickNewWaypoint();
      }
      this.state = 'ZONE_RUSH';
      moveSpeed = this.handlePatrol(delta);
    } else if (this.state === 'COMBAT' && this.target && !this.target.isDead) {
      moveSpeed = this.handleCombat(delta, onBotShoot);
    } else {
      this.state = 'PATROL';
      moveSpeed = this.handlePatrol(delta);
    }

    // 4. Physics and Collision
    resolveCollision(this.position, 0.6);
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.character.root.position.copy(this.position);

    this.rotationY = THREE.MathUtils.lerp(this.rotationY, this.targetRotationY, delta * 7);
    this.character.root.rotation.y = this.rotationY;

    const isAiming = this.state === 'COMBAT';
    this.character.updateAnimation(delta, moveSpeed, true, isAiming);
  }

  detectTargets(player, otherBots) {
    // Range depends on difficulty
    let detectRange = 40;
    if (this.difficulty === 'recruit') detectRange = 30;
    else if (this.difficulty === 'veteran') detectRange = 55;

    // DO NOT target player if player is still in air gliding or shielded!
    const canTargetPlayer = !player.isDead && !player.isGliding && !player.isShielded;
    const distToPlayer = this.position.distanceTo(player.position);

    if (this.target === player && !canTargetPlayer) {
      this.target = null;
      this.state = 'PATROL';
    }

    if (canTargetPlayer && distToPlayer < detectRange) {
      if (this.target !== player) {
        this.target = player;
        this.state = 'COMBAT';
        // Add human-like reaction hesitation (1.8s - 2.5s) before firing!
        this.alertTimer = this.difficulty === 'recruit' ? 2.5 : (this.difficulty === 'veteran' ? 1.0 : 1.8);
      }
      return;
    }

    // Otherwise check other bots
    if (!this.target || this.target.isDead || Math.random() < 0.04) {
      let closestBot = null;
      let closestDist = detectRange;

      for (let i = 0; i < otherBots.length; i++) {
        const b = otherBots[i];
        if (b.id !== this.id && !b.isDead) {
          const d = this.position.distanceTo(b.position);
          if (d < closestDist) {
            closestDist = d;
            closestBot = b;
          }
        }
      }

      if (closestBot) {
        this.target = closestBot;
        this.state = 'COMBAT';
        this.alertTimer = 1.5;
      } else if (distToPlayer > detectRange + 10) {
        this.target = null;
      }
    }
  }

  handleCombat(delta, onBotShoot) {
    const targetPos = this.target.position;
    const dx = targetPos.x - this.position.x;
    const dz = targetPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    this.targetRotationY = Math.atan2(dx, dz);

    // Strafe side to side
    this.strafeTimer -= delta;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.5 + Math.random() * 1.5;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }

    let vx = 0;
    let vz = 0;

    if (dist > 28) {
      vx = Math.sin(this.targetRotationY) * 2.8;
      vz = Math.cos(this.targetRotationY) * 2.8;
    } else if (dist < 12) {
      vx = -Math.sin(this.targetRotationY) * 2.4;
      vz = -Math.cos(this.targetRotationY) * 2.4;
    }

    const strafeAngle = this.targetRotationY + Math.PI / 2;
    vx += Math.sin(strafeAngle) * (1.6 * this.strafeDir);
    vz += Math.cos(strafeAngle) * (1.6 * this.strafeDir);

    this.position.x += vx * delta;
    this.position.z += vz * delta;

    // Reaction alert delay before first shot
    if (this.alertTimer > 0) {
      this.alertTimer -= delta;
      return Math.hypot(vx, vz);
    }

    // Firing logic
    if (this.burstCooldown > 0) {
      this.burstCooldown -= delta;
    } else {
      this.burstTimer -= delta;
      if (this.burstTimer <= 0) {
        this.fireShot(onBotShoot);
        this.shotsInBurst++;
        this.burstTimer = 0.16;

        const maxShots = this.difficulty === 'recruit' ? 2 : (this.difficulty === 'veteran' ? 4 : 3);
        if (this.shotsInBurst >= maxShots) {
          this.shotsInBurst = 0;
          const cd = this.difficulty === 'recruit' ? 3.0 : (this.difficulty === 'veteran' ? 1.6 : 2.4);
          this.burstCooldown = cd + Math.random() * 0.8;
        }
      }
    }

    return Math.hypot(vx, vz);
  }

  fireShot(onBotShoot) {
    if (!this.target) return;

    this.character.playRecoil();
    const muzzlePos = this.character.getMuzzleWorldPosition();

    // Inaccuracy spread based on difficulty
    let spread = 0.15;
    if (this.difficulty === 'recruit') spread = 0.22;
    else if (this.difficulty === 'veteran') spread = 0.08;

    const targetCenter = this.target.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    const aimDir = new THREE.Vector3().subVectors(targetCenter, muzzlePos).normalize();

    aimDir.x += (Math.random() - 0.5) * spread;
    aimDir.y += (Math.random() - 0.5) * (spread * 0.5);
    aimDir.z += (Math.random() - 0.5) * spread;
    aimDir.normalize();

    let endPos = muzzlePos.clone().addScaledVector(aimDir, 100);
    if (onBotShoot) {
      const impactPoint = onBotShoot(this, muzzlePos, aimDir);
      if (impactPoint) endPos = impactPoint;
    }

    this.weaponManager.createTracer(muzzlePos, endPos, false);
    this.weaponManager.createMuzzleFlash(muzzlePos, false);
  }

  handlePatrol(delta) {
    this.waypointTimer -= delta;
    if (this.waypointTimer <= 0) {
      this.pickNewWaypoint();
    }

    const dx = this.targetPos.x - this.position.x;
    const dz = this.targetPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 2.0) {
      this.pickNewWaypoint();
      return 0;
    }

    this.targetRotationY = Math.atan2(dx, dz);
    const speed = 3.4;
    this.position.x += Math.sin(this.targetRotationY) * speed * delta;
    this.position.z += Math.cos(this.targetRotationY) * speed * delta;

    return speed;
  }
}
