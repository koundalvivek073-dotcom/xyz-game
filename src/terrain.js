import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createSandTextures, createRockTextures, createContainerTexture } from './textures.js';

export const MAP_SIZE = 360;
export const HALF_MAP = MAP_SIZE / 2; // 180

// Procedural height generation
export function getTerrainHeight(x, z) {
  const distFromCenter = Math.hypot(x, z);

  // Impassable outer mountain ridges (beyond 145m)
  let outerCliffs = 0;
  if (distFromCenter > 145) {
    const t = (distFromCenter - 145) / (HALF_MAP - 145);
    outerCliffs = Math.pow(Math.min(1.2, t), 2) * 28;
  }

  // Base rolling desert dunes
  const d1 = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 5.0;
  const d2 = Math.sin(x * 0.035 + z * 0.025) * 2.5;
  const d3 = Math.cos(x * 0.07 - z * 0.055) * 1.0;

  // Specific canyon / plateau features
  // Plateau in North-East
  let nePlateau = 0;
  const distNE = Math.hypot(x - 80, z + 70);
  if (distNE < 45) {
    nePlateau = (1 - Math.cos(Math.PI * (1 - distNE / 45))) * 4.5;
  }

  // Oasis depression in South-West
  let swDepression = 0;
  const distSW = Math.hypot(x + 70, z - 65);
  if (distSW < 35) {
    swDepression = - (1 + Math.cos(Math.PI * (distSW / 35))) * 2.2;
  }

  // Central canyon trench
  let trench = 0;
  const distCenter = Math.hypot(x, z);
  if (distCenter < 25) {
    trench = Math.sin(x * 0.1) * 1.5;
  }

  return Math.max(0, 3.5 + d1 + d2 + d3 + nePlateau + swDepression + trench + outerCliffs);
}

// Store colliders for physics
export const worldColliders = [];
export const supplyCrates = [];

export function createTerrain(scene) {
  // 1. Procedural PBR Textures
  const { diffuseMap, normalMap, roughnessMap } = createSandTextures();
  const rockTexture = createRockTextures();

  // 2. Terrain Mesh
  const segments = 180;
  const geometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position;
  const colors = [];
  const colorSand = new THREE.Color(0xc5a982); // Softer, natural golden desert sand (no glare)
  const colorRock = new THREE.Color(0x7e5b3c);
  const colorOasis = new THREE.Color(0x527248);
  const colorHighCliff = new THREE.Color(0x423425);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);

    const distSW = Math.hypot(x + 70, z - 65);
    const c = new THREE.Color();
    if (distSW < 30) {
      c.copy(colorOasis).lerp(colorSand, distSW / 30);
    } else if (y > 14) {
      c.copy(colorHighCliff);
    } else if (y > 7.5) {
      const t = (y - 7.5) / 6.5;
      c.copy(colorSand).lerp(colorRock, t);
    } else {
      c.copy(colorSand);
    }

    colors.push(c.r, c.g, c.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: diffuseMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: roughnessMap,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02
  });

  const terrainMesh = new THREE.Mesh(geometry, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 3. Setup Atmospheric Sky Dome
  setupSky(scene);

  // 4. Build POIs & Props
  buildForwardBase(scene, -55, -45);
  buildSunkenRuins(scene, 65, -60, rockTexture);
  buildOasisRefinery(scene, -70, 65);
  buildRadioOutpost(scene, 60, 55);
  buildCentralDrop(scene, 0, 0, rockTexture);

  // 5. Scatter Rocks & Desert Trees
  scatterProps(scene, rockTexture);

  // 6. Spawn Supply Crates
  spawnCrates(scene);

  return { terrainMesh, getTerrainHeight };
}

// Atmospheric Sky with Rayleigh Scattering — clean, comfortable, non-blinding sky
function setupSky(scene) {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const sun = new THREE.Vector3();
  const uniforms = sky.material.uniforms;
  uniforms['turbidity'].value = 2.0;       // Reduced haze & glaring bloom
  uniforms['rayleigh'].value = 0.5;        // Soft, deep sky hue
  uniforms['mieCoefficient'].value = 0.002;
  uniforms['mieDirectionalG'].value = 0.82;

  // Sun at low golden-hour angle for balanced, comfortable illumination
  const elevation = 16;
  const azimuth = 65;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  uniforms['sunPosition'].value.copy(sun);
}


// POI 1: Forward Base Delta
function buildForwardBase(scene, cx, cz) {
  const containerTex = createContainerTexture(false);
  const rustTex = createContainerTexture(true);

  const containerMat = new THREE.MeshStandardMaterial({ map: containerTex, roughness: 0.5, metalness: 0.6 });
  const rustMat = new THREE.MeshStandardMaterial({ map: rustTex, roughness: 0.7, metalness: 0.4 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x555854, roughness: 0.9 });

  const cConfigs = [
    { x: -8, z: 0, rot: 0, mat: containerMat },
    { x: 8, z: -2, rot: 0.2, mat: rustMat },
    { x: 0, z: 10, rot: Math.PI / 2, mat: containerMat },
  ];

  cConfigs.forEach((cfg) => {
    const w = 4.5, h = 3.2, d = 10;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cfg.mat);
    const y = getTerrainHeight(cx + cfg.x, cz + cfg.z) + h / 2;
    mesh.position.set(cx + cfg.x, y, cz + cfg.z);
    mesh.rotation.y = cfg.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    worldColliders.push({
      type: 'box',
      center: new THREE.Vector3(cx + cfg.x, y, cz + cfg.z),
      size: new THREE.Vector3(w, h, d),
      radius: Math.max(w, d) / 2
    });
  });

  // Watchtower
  const towerH = 11;
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x222624, roughness: 0.5, metalness: 0.7 });
  const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.4, towerH, 8), towerMat);
  const ty = getTerrainHeight(cx + 14, cz + 12) + towerH / 2;
  towerMesh.position.set(cx + 14, ty, cz + 12);
  towerMesh.castShadow = true;
  scene.add(towerMesh);
  worldColliders.push({
    type: 'cylinder',
    center: new THREE.Vector3(cx + 14, ty, cz + 12),
    radius: 3.4,
    height: towerH
  });

  // Sandbag barricades
  for (let i = -12; i <= 12; i += 5) {
    if (Math.abs(i) < 3) continue;
    const by = getTerrainHeight(cx + i, cz - 12) + 0.6;
    const sandbag = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 1.2), concreteMat);
    sandbag.position.set(cx + i, by, cz - 12);
    sandbag.castShadow = true;
    scene.add(sandbag);

    worldColliders.push({
      type: 'box',
      center: new THREE.Vector3(cx + i, by, cz - 12),
      size: new THREE.Vector3(3.5, 1.2, 1.2),
      radius: 2.0
    });
  }
}

// POI 2: Sunken Ruins
function buildSunkenRuins(scene, cx, cz, rockTex) {
  const stoneMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.9 });
  
  const numPillars = 8;
  const radius = 16;
  for (let i = 0; i < numPillars; i++) {
    const angle = (i / numPillars) * Math.PI * 2;
    const px = cx + Math.cos(angle) * radius;
    const pz = cz + Math.sin(angle) * radius;
    const ph = 5 + (i % 3) * 2.5;
    const py = getTerrainHeight(px, pz) + ph / 2;

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, ph, 8), stoneMat);
    pillar.position.set(px, py, pz);
    pillar.castShadow = true;
    scene.add(pillar);

    worldColliders.push({
      type: 'cylinder',
      center: new THREE.Vector3(px, py, pz),
      radius: 1.4,
      height: ph
    });
  }
}

// POI 3: Oasis Refinery
function buildOasisRefinery(scene, cx, cz) {
  const waterY = getTerrainHeight(cx, cz) + 0.25;

  // Glossy Water Pond
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1f5c6b,
    roughness: 0.05,
    metalness: 0.9,
    transparent: true,
    opacity: 0.88
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(18, 32), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, waterY, cz);
  scene.add(water);

  // Fuel Storage Tanks
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x76807d, roughness: 0.35, metalness: 0.7 });
  const tankConfigs = [
    { x: cx - 18, z: cz - 8, r: 4.5, h: 7 },
    { x: cx - 18, z: cz + 8, r: 4.5, h: 7 },
    { x: cx + 18, z: cz, r: 5.5, h: 8.5 }
  ];

  tankConfigs.forEach((t) => {
    const ty = getTerrainHeight(t.x, t.z) + t.h / 2;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 20), tankMat);
    tank.position.set(t.x, ty, t.z);
    tank.castShadow = true;
    scene.add(tank);

    worldColliders.push({
      type: 'cylinder',
      center: new THREE.Vector3(t.x, ty, t.z),
      radius: t.r,
      height: t.h
    });
  });
}

// POI 4: Radio Outpost
function buildRadioOutpost(scene, cx, cz) {
  const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x3d423f, roughness: 0.7, metalness: 0.3 });
  const by = getTerrainHeight(cx, cz) + 2.2;
  const bunker = new THREE.Mesh(new THREE.BoxGeometry(12, 4.4, 9), bunkerMat);
  bunker.position.set(cx, by, cz);
  bunker.castShadow = true;
  scene.add(bunker);

  worldColliders.push({
    type: 'box',
    center: new THREE.Vector3(cx, by, cz),
    size: new THREE.Vector3(12, 4.4, 9),
    radius: 7.5
  });

  // Tall Radio Mast with Red Glowing Beacon
  const mastH = 28;
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x8e9491, metalness: 0.85, roughness: 0.25 });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.8, mastH, 8), mastMat);
  const my = getTerrainHeight(cx + 8, cz + 8) + mastH / 2;
  mast.position.set(cx + 8, my, cz + 8);
  mast.castShadow = true;
  scene.add(mast);

  // Glowing Bloom Beacon
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), beaconMat);
  beacon.position.set(cx + 8, my + mastH / 2 + 0.3, cz + 8);
  scene.add(beacon);

  const beaconLight = new THREE.PointLight(0xff2222, 4, 15);
  beaconLight.position.copy(beacon.position);
  scene.add(beaconLight);

  worldColliders.push({
    type: 'cylinder',
    center: new THREE.Vector3(cx + 8, my, cz + 8),
    radius: 1.8,
    height: mastH
  });
}

// Central Drop / Rock Bridge
function buildCentralDrop(scene, cx, cz, rockTex) {
  const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.9 });

  const arch1 = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.2, 12, 8), rockMat);
  arch1.position.set(cx - 6, getTerrainHeight(cx - 6, cz) + 6, cz);
  arch1.castShadow = true;
  scene.add(arch1);

  const arch2 = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.2, 12, 8), rockMat);
  arch2.position.set(cx + 6, getTerrainHeight(cx + 6, cz) + 6, cz);
  arch2.castShadow = true;
  scene.add(arch2);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 2.5, 4.5), rockMat);
  bridge.position.set(cx, getTerrainHeight(cx, cz) + 12, cz);
  bridge.castShadow = true;
  scene.add(bridge);

  worldColliders.push({ type: 'cylinder', center: arch1.position, radius: 3.2, height: 12 });
  worldColliders.push({ type: 'cylinder', center: arch2.position, radius: 3.2, height: 12 });
  worldColliders.push({
    type: 'box',
    center: bridge.position,
    size: new THREE.Vector3(16, 2.5, 4.5),
    radius: 8
  });
}

// Scatter Boulders (Trees are now handled by EnvironmentManager with 3D canopy + wind)
function scatterProps(scene, rockTex) {
  const boulderMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.88 });

  // 60 Boulders
  for (let i = 0; i < 60; i++) {
    const rx = (Math.random() - 0.5) * 300;
    const rz = (Math.random() - 0.5) * 300;
    if (Math.hypot(rx, rz) < 20) continue;

    const scale = 1.6 + Math.random() * 3.6;
    const ry = getTerrainHeight(rx, rz) + scale * 0.4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 1), boulderMat);
    rock.position.set(rx, ry, rz);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);

    worldColliders.push({
      type: 'sphere',
      center: new THREE.Vector3(rx, ry, rz),
      radius: scale * 0.9
    });
  }
}


// Glowing Supply Crates with Bloom Beams
function spawnCrates(scene) {
  const locations = [
    { x: -50, z: -40, type: 'gold' },
    { x: -62, z: -48, type: 'blue' },
    { x: 65, z: -60, type: 'gold' },
    { x: 74, z: -55, type: 'blue' },
    { x: -65, z: 60, type: 'blue' },
    { x: -80, z: 72, type: 'blue' },
    { x: 58, z: 50, type: 'gold' },
    { x: 68, z: 62, type: 'blue' },
    { x: 0, z: 0, type: 'gold' },
    { x: -12, z: 10, type: 'blue' },
    { x: 12, z: -10, type: 'blue' },
    { x: -110, z: -20, type: 'blue' },
    { x: 115, z: 15, type: 'blue' },
    { x: 20, z: -110, type: 'blue' },
    { x: -25, z: 120, type: 'gold' },
    { x: 90, z: 95, type: 'blue' },
    { x: -95, z: -90, type: 'blue' }
  ];

  locations.forEach((loc, index) => {
    const isGold = loc.type === 'gold';
    const crateMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffdf77 : 0x4ac0f0,
      metalness: 0.85,
      roughness: 0.15,
      emissive: isGold ? 0x996611 : 0x1166aa,
      emissiveIntensity: 1.5
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), crateMat);
    const y = getTerrainHeight(loc.x, loc.z) + 0.6;
    mesh.position.set(loc.x, y, loc.z);
    mesh.castShadow = true;
    scene.add(mesh);

    // Glowing Bloom Pillar
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 35, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: isGold ? 0xffe688 : 0x77e0ff,
      transparent: true,
      opacity: 0.65
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(loc.x, y + 17.5, loc.z);
    scene.add(beam);

    supplyCrates.push({
      id: index,
      type: loc.type,
      mesh,
      beam,
      position: new THREE.Vector3(loc.x, y, loc.z),
      collected: false
    });
  });
}

// Collision resolution
export function raycastWorldColliders(origin, direction, maxDistance) {
  const ray = new THREE.Ray(origin, direction.clone().normalize());
  let closestHit = null;

  const considerHit = (point) => {
    if (!point) return;
    const distance = origin.distanceTo(point);
    if (distance <= maxDistance && (!closestHit || distance < closestHit.distance)) {
      closestHit = { point, distance };
    }
  };

  for (const collider of worldColliders) {
    if (collider.type === 'box') {
      const halfSize = collider.size.clone().multiplyScalar(0.5);
      const bounds = new THREE.Box3(
        collider.center.clone().sub(halfSize),
        collider.center.clone().add(halfSize)
      );
      considerHit(ray.intersectBox(bounds, new THREE.Vector3()));
    } else if (collider.type === 'sphere') {
      considerHit(ray.intersectSphere(
        new THREE.Sphere(collider.center, collider.radius),
        new THREE.Vector3()
      ));
    } else if (collider.type === 'cylinder') {
      const halfHeight = collider.height / 2;
      const minY = collider.center.y - halfHeight;
      const maxY = collider.center.y + halfHeight;
      const offsetX = origin.x - collider.center.x;
      const offsetZ = origin.z - collider.center.z;
      const a = direction.x * direction.x + direction.z * direction.z;
      const b = 2 * (offsetX * direction.x + offsetZ * direction.z);
      const c = offsetX * offsetX + offsetZ * offsetZ - collider.radius * collider.radius;

      if (a > 1e-8) {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant);
          const distances = [(-b - root) / (2 * a), (-b + root) / (2 * a)];
          for (const distance of distances) {
            const y = origin.y + direction.y * distance;
            if (distance >= 0 && y >= minY && y <= maxY) {
              considerHit(ray.at(distance, new THREE.Vector3()));
            }
          }
        }
      }

      if (Math.abs(direction.y) > 1e-8) {
        for (const y of [minY, maxY]) {
          const distance = (y - origin.y) / direction.y;
          const x = origin.x + direction.x * distance - collider.center.x;
          const z = origin.z + direction.z * distance - collider.center.z;
          if (distance >= 0 && x * x + z * z <= collider.radius * collider.radius) {
            considerHit(ray.at(distance, new THREE.Vector3()));
          }
        }
      }
    }
  }

  return closestHit;
}

export function resolveCollision(position, radius) {
  const maxBound = HALF_MAP - 5;
  position.x = Math.max(-maxBound, Math.min(maxBound, position.x));
  position.z = Math.max(-maxBound, Math.min(maxBound, position.z));

  for (let i = 0; i < worldColliders.length; i++) {
    const c = worldColliders[i];
    const dx = position.x - c.center.x;
    const dz = position.z - c.center.z;
    const distSq = dx * dx + dz * dz;

    if (c.type === 'sphere' || c.type === 'cylinder') {
      const minDist = radius + c.radius;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.001) {
          const overlap = minDist - dist;
          position.x += (dx / dist) * overlap;
          position.z += (dz / dist) * overlap;
        }
      }
    } else if (c.type === 'box') {
      const halfW = c.size.x / 2 + radius;
      const halfD = c.size.z / 2 + radius;
      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
        const overlapX = halfW - Math.abs(dx);
        const overlapZ = halfD - Math.abs(dz);
        if (overlapX < overlapZ) {
          position.x += Math.sign(dx) * overlapX;
        } else {
          position.z += Math.sign(dz) * overlapZ;
        }
      }
    }
  }

  const groundY = getTerrainHeight(position.x, position.z);
  if (position.y < groundY) {
    position.y = groundY;
  }
}
