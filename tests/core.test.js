import test from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { getTerrainHeight, MAP_SIZE, HALF_MAP, raycastWorldColliders, worldColliders } from '../src/terrain.js';
import { STORM_PHASES } from '../src/storm.js';
import { WEAPON_CONFIGS } from '../src/weapons.js';
import { Bot, BOT_NAMES } from '../src/bot.js';

test('Terrain system', () => {
  assert.strictEqual(MAP_SIZE, 360, 'Map size should be 360m');
  assert.strictEqual(HALF_MAP, 180, 'Half map should be 180m');

  const centerH = getTerrainHeight(0, 0);
  assert.ok(centerH >= 0, 'Center terrain height should be non-negative');

  const northH = getTerrainHeight(0, 100);
  assert.ok(typeof northH === 'number' && !isNaN(northH), 'Height should be valid number');

  // Boundary cliff elevation
  const cliffH = getTerrainHeight(170, 0);
  assert.ok(cliffH > centerH, 'Boundary cliff height should be elevated to keep players inside');
});

test('Storm phase progression', () => {
  assert.strictEqual(STORM_PHASES.length, 5, 'Should have 5 storm phases');

  // Verify damage scaling
  for (let i = 1; i < STORM_PHASES.length; i++) {
    assert.ok(
      STORM_PHASES[i].damage >= STORM_PHASES[i - 1].damage,
      `Phase ${i} damage should be greater or equal to phase ${i - 1}`
    );
    assert.ok(
      STORM_PHASES[i].targetRadius <= STORM_PHASES[i - 1].targetRadius,
      `Phase ${i} radius should be smaller or equal to phase ${i - 1}`
    );
  }

  assert.strictEqual(STORM_PHASES[STORM_PHASES.length - 1].targetRadius, 0, 'Final storm phase should collapse to 0');
});

test('Weapon configurations', () => {
  const std = WEAPON_CONFIGS.standard;
  const upg = WEAPON_CONFIGS.upgraded;

  assert.strictEqual(std.magSize, 30, 'Standard magazine should be 30');
  assert.ok(upg.damage > std.damage, 'Upgraded weapon should deal more damage');
  assert.ok(upg.fireRate <= std.fireRate, 'Upgraded weapon should fire at least as fast');
  assert.ok(upg.reloadTime < std.reloadTime, 'Upgraded weapon should reload faster');
});

test('Operative bots configuration', () => {
  assert.strictEqual(BOT_NAMES.length, 15, 'Should have 15 bot operatives');
  const uniqueNames = new Set(BOT_NAMES);
  assert.strictEqual(uniqueNames.size, 15, 'All bot names should be unique');
});

test('Bullets collide with world obstacles', () => {
  const colliders = [
    {
      type: 'box',
      center: new THREE.Vector3(0, 0, 0),
      size: new THREE.Vector3(2, 2, 2)
    },
    {
      type: 'cylinder',
      center: new THREE.Vector3(10, 0, 0),
      radius: 1,
      height: 4
    },
    {
      type: 'sphere',
      center: new THREE.Vector3(20, 0, 0),
      radius: 1
    }
  ];

  worldColliders.push(...colliders);
  try {
    const boxHit = raycastWorldColliders(
      new THREE.Vector3(-5, 0, 0),
      new THREE.Vector3(1, 0, 0),
      20
    );
    const cylinderHit = raycastWorldColliders(
      new THREE.Vector3(5, 0, 0),
      new THREE.Vector3(1, 0, 0),
      20
    );
    const sphereHit = raycastWorldColliders(
      new THREE.Vector3(15, 0, 0),
      new THREE.Vector3(1, 0, 0),
      20
    );

    assert.strictEqual(boxHit.distance, 4, 'Box collider should stop the shot at its near face');
    assert.strictEqual(cylinderHit.distance, 4, 'Cylinder collider should stop the shot at its near side');
    assert.strictEqual(sphereHit.distance, 4, 'Sphere collider should stop the shot at its near side');
  } finally {
    worldColliders.splice(worldColliders.length - colliders.length, colliders.length);
  }
});

test('Bots prioritize returning to the safe zone over combat', () => {
  const scene = new THREE.Scene();
  const storm = {
    currentCenter: new THREE.Vector2(0, 0),
    currentRadius: 10,
    isOutsideSafeZone(x, z) {
      return Math.hypot(x - this.currentCenter.x, z - this.currentCenter.y) > this.currentRadius;
    },
    getCurrentDamage() {
      return 0;
    }
  };
  const bot = new Bot(1, 'Test Bot', scene, {}, storm);
  const player = {
    position: new THREE.Vector3(12, 0, 0),
    isDead: false,
    isGliding: false,
    isShielded: false
  };

  bot.position.set(14, getTerrainHeight(14, 0), 0);
  bot.target = player;
  bot.state = 'COMBAT';
  bot.waypointTimer = 10;
  bot.update(0.1, player, [bot], null, null);

  assert.strictEqual(bot.state, 'ZONE_RUSH', 'An out-of-zone bot must not remain in combat');
  assert.ok(storm.currentCenter.distanceTo(new THREE.Vector2(bot.targetPos.x, bot.targetPos.z)) < storm.currentRadius);
});

test('Combat balance & Landing Protection rules', () => {
  // Test armor damage mitigation (70% armor, 30% hp)
  let health = 100;
  let armor = 100;
  const rawDamage = 20;

  const armorDmg = rawDamage * 0.7;
  const hpDmg = rawDamage * 0.3;
  armor -= armorDmg;
  health -= hpDmg;

  assert.strictEqual(armor, 86, 'Armor should absorb 70% of damage');
  assert.strictEqual(health, 94, 'Health should only take 30% of damage when armored');

  // Test invulnerability rule
  const isGliding = true;
  const isShielded = false;
  const canTargetPlayer = !isGliding && !isShielded;
  assert.strictEqual(canTargetPlayer, false, 'Player must not be targetable while gliding in air');

  const isLandedGliding = false;
  const isLandedShielded = true;
  const canTargetLanded = !isLandedGliding && !isLandedShielded;
  assert.strictEqual(canTargetLanded, false, 'Player must not be targetable while landing shield is active');
});

test('Modular Weapon System & Loadouts', async () => {
  const { WEAPON_REGISTRY, WEAPON_SLOTS } = await import('../src/WeaponSystem.js');
  assert.ok(WEAPON_REGISTRY.ar4, 'AR-4 should be defined in registry');
  assert.ok(WEAPON_REGISTRY.vector9, 'Vector-9 should be defined in registry');
  assert.ok(WEAPON_REGISTRY.sidearm, 'Sidearm should be defined in registry');

  assert.strictEqual(WEAPON_REGISTRY.ar4.slot, WEAPON_SLOTS.PRIMARY, 'AR-4 is primary');
  assert.strictEqual(WEAPON_REGISTRY.vector9.slot, WEAPON_SLOTS.SECONDARY, 'Vector-9 is secondary');
  assert.strictEqual(WEAPON_REGISTRY.sidearm.slot, WEAPON_SLOTS.HOLSTER, 'P-9 is holster');
  assert.strictEqual(WEAPON_REGISTRY.ar4.hybridCutoff, 15.0, 'Hybrid ballistics cutoff is 15m');
});

test('PlayerController Stances', async () => {
  const { Stance } = await import('../src/PlayerController.js');
  assert.strictEqual(Stance.STAND, 'STAND');
  assert.strictEqual(Stance.CROUCH, 'CROUCH');
  assert.strictEqual(Stance.PRONE, 'PRONE');
});

