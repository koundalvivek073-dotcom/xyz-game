import * as THREE from 'three';

// Create high-fidelity cyber-tactical operative model with detailed equipment and realistic assault rifle
export function createCharacter(options = {}) {
  const {
    isPlayer = false,
    name = isPlayer ? 'PATHFINDER' : 'OPERATIVE',
    visorColor = isPlayer ? 0x00f0ff : 0xff3322,
    armorColor = isPlayer ? 0x242e2a : 0x382e25,
    camoColor = isPlayer ? 0x3d4d44 : 0x4d3e33
  } = options;

  const root = new THREE.Group();

  // Premium PBR Materials with Dynamic Rim Lighting
  const applyRimLighting = (material, rimColorHex, power = 3.0) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: new THREE.Color(rimColorHex) };
      shader.uniforms.uRimPower = { value: power };
      shader.fragmentShader = `
        uniform vec3 uRimColor;
        uniform float uRimPower;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        vec3 rimViewDir = normalize(vViewPosition);
        float rimFactor = 1.0 - max(0.0, dot(rimViewDir, normalize(vNormal)));
        rimFactor = pow(clamp(rimFactor, 0.0, 1.0), uRimPower);
        gl_FragColor.rgb += uRimColor * rimFactor * 0.4;
        `
      );
    };
  };

  const armorMat = new THREE.MeshStandardMaterial({
    color: armorColor,
    roughness: 0.42,
    metalness: 0.65
  });
  applyRimLighting(armorMat, isPlayer ? 0x00e5ff : 0xff5533, 2.8);

  const camoMat = new THREE.MeshStandardMaterial({
    color: camoColor,
    roughness: 0.72,
    metalness: 0.15
  });
  applyRimLighting(camoMat, isPlayer ? 0x00e5ff : 0xffaa44, 3.4);

  // Glowing Visor with Neon Bloom
  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 2.8,
    roughness: 0.08,
    metalness: 0.95
  });

  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x161819,
    roughness: 0.38,
    metalness: 0.88
  });

  const gunPolymerMat = new THREE.MeshStandardMaterial({
    color: 0x252829,
    roughness: 0.65,
    metalness: 0.2
  });

  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf0c868,
    metalness: 0.94,
    roughness: 0.18,
    emissive: 0x664411,
    emissiveIntensity: 0.6
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x111314,
    roughness: 0.85,
    metalness: 0.05
  });

  const opticGlassMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1
  });

  // ──────────────────────────────────────────────────────────
  // 1. TORSO & BALLISTIC RIG
  // ──────────────────────────────────────────────────────────
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.05;
  root.add(torsoGroup);

  // Anatomical shaped inner suit (chest + abdomen)
  const chestGeo = new THREE.CylinderGeometry(0.24, 0.20, 0.42, 12);
  const chest = new THREE.Mesh(chestGeo, camoMat);
  chest.position.y = 0.12;
  chest.castShadow = true;
  torsoGroup.add(chest);

  const abdomenGeo = new THREE.CylinderGeometry(0.20, 0.18, 0.26, 12);
  const abdomen = new THREE.Mesh(abdomenGeo, camoMat);
  abdomen.position.y = -0.16;
  abdomen.castShadow = true;
  torsoGroup.add(abdomen);

  // Contoured heavy ballistic chest plate (angled trauma plate)
  const chestPlateGeo = new THREE.CylinderGeometry(0.26, 0.22, 0.34, 8, 1, false, -Math.PI / 2.6, Math.PI / 1.3);
  const chestPlate = new THREE.Mesh(chestPlateGeo, armorMat);
  chestPlate.position.set(0, 0.14, 0.04);
  chestPlate.castShadow = true;
  torsoGroup.add(chestPlate);

  // Back armor plate
  const backPlateGeo = new THREE.CylinderGeometry(0.25, 0.21, 0.32, 8, 1, false, Math.PI / 1.8, Math.PI / 1.3);
  const backPlate = new THREE.Mesh(backPlateGeo, armorMat);
  backPlate.position.set(0, 0.14, -0.04);
  backPlate.castShadow = true;
  torsoGroup.add(backPlate);

  // Glowing tactical core reactor / bio-monitor on sternum
  const coreMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0x00ffcc : 0xff3322,
    emissive: isPlayer ? 0x00ffcc : 0xff3322,
    emissiveIntensity: 2.5
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 12), coreMat);
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.18, 0.21);
  torsoGroup.add(core);

  // Triple MOLLE magazine pouches on lower vest
  for (let p = -1; p <= 1; p++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.07), gunPolymerMat);
    pouch.position.set(p * 0.13, -0.04, 0.20);
    pouch.castShadow = true;
    torsoGroup.add(pouch);
  }

  // Tactical backpack / exo-spine with comms antenna
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.18), armorMat);
  backpack.position.set(0, 0.10, -0.21);
  backpack.castShadow = true;
  torsoGroup.add(backpack);

  // Dual battery cylinders on backpack
  for (let b = -1; b <= 1; b += 2) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 8), gunMetalMat);
    cell.position.set(b * 0.10, 0.08, -0.29);
    cell.castShadow = true;
    torsoGroup.add(cell);
  }

  // Whip Antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.65, 6), gunMetalMat);
  antenna.position.set(0.12, 0.44, -0.26);
  antenna.rotation.x = -0.22;
  torsoGroup.add(antenna);

  // ──────────────────────────────────────────────────────────
  // 2. TACTICAL COMBAT HELMET & PANORAMIC VISOR
  // ──────────────────────────────────────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.46, 0);
  torsoGroup.add(headGroup);

  // Neck collar
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 10), camoMat);
  neck.position.y = -0.06;
  headGroup.add(neck);

  // FAST Ballistic Helmet (contoured dome)
  const helmetDome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), armorMat);
  helmetDome.castShadow = true;
  headGroup.add(helmetDome);

  // Helmet side accessory rails
  for (let s = -1; s <= 1; s += 2) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.14), gunMetalMat);
    rail.position.set(s * 0.18, 0.02, -0.02);
    headGroup.add(rail);

    // Tactical Headset Ear Cups
    const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 10), gunPolymerMat);
    earCup.rotation.z = Math.PI / 2;
    earCup.position.set(s * 0.185, -0.02, -0.01);
    headGroup.add(earCup);
  }

  // NVG Shroud on forehead
  const nvgShroud = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.025), gunMetalMat);
  nvgShroud.position.set(0, 0.10, 0.17);
  headGroup.add(nvgShroud);

  // Curved Panoramic Visor with glowing cyber HUD
  const visorGeo = new THREE.CylinderGeometry(0.165, 0.16, 0.09, 12, 1, false, -Math.PI / 3.0, Math.PI / 1.5);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.01, 0.03);
  headGroup.add(visor);

  // Tactical boom microphone
  const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), gunMetalMat);
  boomMic.rotation.z = Math.PI / 3;
  boomMic.position.set(0.12, -0.06, 0.09);
  headGroup.add(boomMic);

  // ──────────────────────────────────────────────────────────
  // 3. ARTICULATED ARMS, PAULDRONS & HANDS
  // ──────────────────────────────────────────────────────────
  // Right Arm (Trigger Arm)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.28, 0.24, 0);
  torsoGroup.add(rightArm);

  // Curved Shoulder Pauldron
  const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI, 0, Math.PI * 0.65), armorMat);
  rShoulder.rotation.z = -Math.PI / 2;
  rShoulder.position.set(0.04, 0.03, 0);
  rShoulder.castShadow = true;
  rightArm.add(rShoulder);

  // Upper arm & forearm
  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.24, 10), camoMat);
  rUpperArm.position.y = -0.12;
  rUpperArm.castShadow = true;
  rightArm.add(rUpperArm);

  const rElbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.06), armorMat);
  rElbowPad.position.set(0, -0.24, -0.04);
  rightArm.add(rElbowPad);

  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.24, 10), camoMat);
  rForearm.position.y = -0.34;
  rForearm.castShadow = true;
  rightArm.add(rForearm);

  // Glove & Hand gripping weapon grip
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.08), gunPolymerMat);
  rHand.position.set(0, -0.48, 0.02);
  rightArm.add(rHand);

  // Left Arm (Support Hand)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.28, 0.24, 0);
  torsoGroup.add(leftArm);

  const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI, 0, Math.PI * 0.65), armorMat);
  lShoulder.rotation.z = Math.PI / 2;
  lShoulder.position.set(-0.04, 0.03, 0);
  lShoulder.castShadow = true;
  leftArm.add(lShoulder);

  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.24, 10), camoMat);
  lUpperArm.position.y = -0.12;
  lUpperArm.castShadow = true;
  leftArm.add(lUpperArm);

  const lElbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.06), armorMat);
  lElbowPad.position.set(0, -0.24, -0.04);
  leftArm.add(lElbowPad);

  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.24, 10), camoMat);
  lForearm.position.y = -0.34;
  lForearm.castShadow = true;
  leftArm.add(lForearm);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.08), gunPolymerMat);
  lHand.position.set(0, -0.48, 0.02);
  leftArm.add(lHand);

  // ──────────────────────────────────────────────────────────
  // 4. DETAILED TACTICAL ASSAULT RIFLE (AR-4 PLATFORM)
  // ──────────────────────────────────────────────────────────
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0.16, 0.10, 0.26);
  torsoGroup.add(gunGroup);

  // Recoil spring container inside gunGroup for physical kickback
  const gunModel = new THREE.Group();
  gunGroup.add(gunModel);

  // Upper & Lower Receivers (sculpted metal receiver)
  const receiverLower = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.44), gunMetalMat);
  receiverLower.position.set(0, 0.02, 0);
  receiverLower.castShadow = true;
  gunModel.add(receiverLower);

  const receiverUpper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.42), gunMetalMat);
  receiverUpper.position.set(0, 0.10, 0.02);
  receiverUpper.castShadow = true;
  gunModel.add(receiverUpper);

  // Picatinny Top Accessory Rail
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.48), gunMetalMat);
  topRail.position.set(0, 0.15, 0.06);
  gunModel.add(topRail);

  // Fluted Cold-Hammer Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.48, 10), gunMetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.08, 0.46);
  barrel.castShadow = true;
  gunModel.add(barrel);

  // Gas Tube & Gas Block
  const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.06), gunMetalMat);
  gasBlock.position.set(0, 0.09, 0.52);
  gunModel.add(gasBlock);

  // 3-Prong Tactical Muzzle Brake / Compensator
  const compensator = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 8), gunMetalMat);
  compensator.rotation.x = Math.PI / 2;
  compensator.position.set(0, 0.08, 0.72);
  compensator.castShadow = true;
  gunModel.add(compensator);

  // Vented Handguard / Quad Rail with ventilation slots
  const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 8), gunPolymerMat);
  handguard.rotation.x = Math.PI / 2;
  handguard.position.set(0, 0.08, 0.28);
  handguard.castShadow = true;
  gunModel.add(handguard);

  // Underbarrel Ergonomic Angled Foregrip
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.07), gunPolymerMat);
  foregrip.rotation.x = -0.32;
  foregrip.position.set(0, -0.01, 0.34);
  gunModel.add(foregrip);

  // Tactical Pistol Grip with finger grooves
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.09), gunPolymerMat);
  pistolGrip.rotation.x = 0.36;
  pistolGrip.position.set(0, -0.09, -0.06);
  gunModel.add(pistolGrip);

  // Trigger Guard & Curved Trigger
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.09), gunMetalMat);
  triggerGuard.position.set(0, -0.05, 0.04);
  gunModel.add(triggerGuard);

  // Curved 30-round STANAG / PMAG Magazine
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.24, 0.11), gunPolymerMat);
  magazine.position.set(0, -0.15, 0.11);
  magazine.rotation.x = 0.28;
  gunModel.add(magazine);

  // Adjustable Tactical Crane Stock with rubber buttpad
  const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), gunMetalMat);
  bufferTube.rotation.x = Math.PI / 2;
  bufferTube.position.set(0, 0.08, -0.26);
  gunModel.add(bufferTube);

  const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.18), gunPolymerMat);
  stockBody.position.set(0, 0.06, -0.30);
  gunModel.add(stockBody);

  const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.16, 0.03), rubberMat);
  buttpad.position.set(0, 0.05, -0.40);
  gunModel.add(buttpad);

  // PEQ-15 Tactical Laser / Illuminator Module (Underbarrel/Side)
  const peqModule = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.11), gunPolymerMat);
  peqModule.position.set(0.052, 0.08, 0.28);
  gunModel.add(peqModule);

  const laserLens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.015, 6), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  laserLens.rotation.x = Math.PI / 2;
  laserLens.position.set(0.052, 0.08, 0.34);
  gunModel.add(laserLens);

  // Ejection Port Marker (for brass bullet shells)
  const ejectionPort = new THREE.Object3D();
  ejectionPort.position.set(0.045, 0.10, 0.04);
  gunModel.add(ejectionPort);

  // Muzzle Marker
  const muzzleMarker = new THREE.Object3D();
  muzzleMarker.position.set(0, 0.08, 0.78);
  gunModel.add(muzzleMarker);

  // ──────────────────────────────────────────────────────────
  // 5. MODULAR SWITCHABLE OPTICS MOUNTED ON RAIL
  // ──────────────────────────────────────────────────────────
  const opticsGroup = new THREE.Group();
  opticsGroup.position.set(0, 0.165, 0.08);
  gunModel.add(opticsGroup);

  // OPTIC A: Iron Sights (Flip-up front & rear aperture)
  const ironSightMesh = new THREE.Group();
  const ironRear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03), gunMetalMat);
  ironRear.position.set(0, 0.02, -0.14);
  ironSightMesh.add(ironRear);
  const ironFront = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.025), gunMetalMat);
  ironFront.position.set(0, 0.02, 0.32);
  ironSightMesh.add(ironFront);
  const ironTritium = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  ironTritium.position.set(0, 0.045, 0.32);
  ironSightMesh.add(ironTritium);
  opticsGroup.add(ironSightMesh);

  // OPTIC B: EOTech Style Holographic Sight (1.8X)
  const holoMesh = new THREE.Group();
  const holoBase = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.03, 0.16), gunMetalMat);
  holoBase.position.y = 0.015;
  holoMesh.add(holoBase);
  const holoHood = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.14), gunPolymerMat);
  holoHood.position.set(0, 0.07, 0.01);
  holoMesh.add(holoHood);
  const holoGlass = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.01), opticGlassMat);
  holoGlass.position.set(0, 0.07, 0.01);
  holoMesh.add(holoGlass);
  const holoReticle = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.016, 16), new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide }));
  holoReticle.position.set(0, 0.07, 0.015);
  holoMesh.add(holoReticle);
  opticsGroup.add(holoMesh);

  // OPTIC C: Trijicon ACOG 4X Prism Combat Scope
  const acogMesh = new THREE.Group();
  const acogMount = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.035, 0.12), gunMetalMat);
  acogMount.position.y = 0.018;
  acogMesh.add(acogMount);
  const acogBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.22, 12), gunMetalMat);
  acogBody.rotation.x = Math.PI / 2;
  acogBody.position.set(0, 0.07, 0);
  acogMesh.add(acogBody);
  const acogFiber = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
  acogFiber.rotation.x = Math.PI / 2;
  acogFiber.position.set(0, 0.108, 0);
  acogMesh.add(acogFiber);
  const acogLens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 12), opticGlassMat);
  acogLens.position.set(0, 0.07, 0.11);
  acogMesh.add(acogLens);
  opticsGroup.add(acogMesh);

  // OPTIC D: 8X Variable High-Magnification Sniper Scope
  const sniperMesh = new THREE.Group();
  const sniperTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.36, 12), gunMetalMat);
  sniperTube.rotation.x = Math.PI / 2;
  sniperTube.position.set(0, 0.08, 0);
  sniperMesh.add(sniperTube);
  const sniperObjective = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.034, 0.12, 12), gunMetalMat);
  sniperObjective.rotation.x = Math.PI / 2;
  sniperObjective.position.set(0, 0.08, 0.22);
  sniperMesh.add(sniperObjective);
  const sniperEyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.08, 12), rubberMat);
  sniperEyepiece.rotation.x = Math.PI / 2;
  sniperEyepiece.position.set(0, 0.08, -0.20);
  sniperMesh.add(sniperEyepiece);
  // Dual high-profile tactical mounting rings
  for (let r = -1; r <= 1; r += 2) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.03), gunMetalMat);
    ring.position.set(0, 0.045, r * 0.10);
    sniperMesh.add(ring);
  }
  // Windage and Elevation adjustment turrets
  const turretE = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 8), gunMetalMat);
  turretE.position.set(0, 0.12, 0.02);
  sniperMesh.add(turretE);
  const turretW = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 8), gunMetalMat);
  turretW.rotation.z = Math.PI / 2;
  turretW.position.set(0.04, 0.08, 0.02);
  sniperMesh.add(turretW);
  opticsGroup.add(sniperMesh);

  // Set initial mounted optic
  function setMountedScope(scopeType) {
    ironSightMesh.visible = scopeType === 'iron';
    holoMesh.visible = scopeType === 'holo';
    acogMesh.visible = scopeType === 'acog';
    sniperMesh.visible = scopeType === 'sniper';
  }
  setMountedScope('holo');

  // Realistic holding pose
  rightArm.rotation.set(-1.18, -0.26, 0.18);
  leftArm.rotation.set(-1.18, 0.46, -0.18);

  // ──────────────────────────────────────────────────────────
  // 6. ANATOMICAL LEGS & COMBAT BOOTS
  // ──────────────────────────────────────────────────────────
  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.72, 0);
  root.add(leftLeg);

  const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.44, 10), camoMat);
  lThigh.position.y = -0.18;
  lThigh.castShadow = true;
  leftLeg.add(lThigh);

  const lKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.08), armorMat);
  lKneePad.position.set(0, -0.38, 0.08);
  leftLeg.add(lKneePad);

  const lCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.34, 10), camoMat);
  lCalf.position.y = -0.48;
  lCalf.castShadow = true;
  leftLeg.add(lCalf);

  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.26), rubberMat);
  lBoot.position.set(0, -0.62, 0.04);
  lBoot.castShadow = true;
  leftLeg.add(lBoot);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.72, 0);
  root.add(rightLeg);

  const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.44, 10), camoMat);
  rThigh.position.y = -0.18;
  rThigh.castShadow = true;
  rightLeg.add(rThigh);

  // Pistol side-holster on right thigh
  const thighHolster = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.11), gunPolymerMat);
  thighHolster.position.set(0.11, -0.16, 0.02);
  rightLeg.add(thighHolster);

  const rKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.08), armorMat);
  rKneePad.position.set(0, -0.38, 0.08);
  rightLeg.add(rKneePad);

  const rCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.34, 10), camoMat);
  rCalf.position.y = -0.48;
  rCalf.castShadow = true;
  rightLeg.add(rCalf);

  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.26), rubberMat);
  rBoot.position.set(0, -0.62, 0.04);
  rBoot.castShadow = true;
  rightLeg.add(rBoot);

  // ──────────────────────────────────────────────────────────
  // 7. BOT NAMEPLATE & HEALTH OVERHEAD
  // ──────────────────────────────────────────────────────────
  let nameplateSprite = null;
  let nameplateCanvas = null;
  let nameplateCtx = null;

  if (!isPlayer) {
    nameplateCanvas = document.createElement('canvas');
    nameplateCanvas.width = 256;
    nameplateCanvas.height = 64;
    nameplateCtx = nameplateCanvas.getContext('2d');

    const nameplateTexture = new THREE.CanvasTexture(nameplateCanvas);
    const npMat = new THREE.SpriteMaterial({
      map: nameplateTexture,
      transparent: true,
      depthTest: false
    });

    nameplateSprite = new THREE.Sprite(npMat);
    nameplateSprite.position.set(0, 2.3, 0);
    nameplateSprite.scale.set(1.6, 0.4, 1);
    root.add(nameplateSprite);

    updateNameplate(100, 100, 0);
  }

  function updateNameplate(hp, maxHp, distance = 0) {
    if (!nameplateCtx || !nameplateSprite) return;
    const ctx = nameplateCtx;
    ctx.clearRect(0, 0, 256, 64);

    ctx.fillStyle = 'rgba(12, 22, 26, 0.88)';
    ctx.fillRect(8, 4, 240, 56);
    ctx.strokeStyle = '#00e5ff44';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 4, 240, 56);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${name}`, 18, 26);

    ctx.fillStyle = '#edc57b';
    ctx.font = '14px Arial, sans-serif';
    ctx.textAlign = 'right';
    if (distance > 0) {
      ctx.fillText(`${Math.round(distance)}m`, 238, 26);
    }

    ctx.fillStyle = '#221111';
    ctx.fillRect(18, 36, 220, 14);

    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = ratio > 0.5 ? '#00e5ff' : (ratio > 0.25 ? '#edc57b' : '#ff3322');
    ctx.fillRect(18, 36, 220 * ratio, 14);

    nameplateSprite.material.map.needsUpdate = true;
  }

  // ──────────────────────────────────────────────────────────
  // 8. ANIMATION & PHYSICAL RECOIL PHYSICS
  // ──────────────────────────────────────────────────────────
  let walkPhase = 0;
  let isDead = false;
  let deathProgress = 0;

  // Spring-damper recoil state
  let recoilOffsetZ = 0;
  let recoilRotX = 0;
  let recoilVelZ = 0;
  let recoilVelRotX = 0;

  function updateAnimation(delta, speed, isGrounded, isAiming, pitch = 0) {
    // 1. Spring physics for gun recoil
    if (recoilOffsetZ !== 0 || recoilVelZ !== 0 || recoilRotX !== 0 || recoilVelRotX !== 0) {
      const springK = 380; // Spring stiffness
      const damping = 26;  // Spring damping

      const fZ = -springK * recoilOffsetZ - damping * recoilVelZ;
      recoilVelZ += fZ * delta;
      recoilOffsetZ += recoilVelZ * delta;

      const fRot = -springK * recoilRotX - damping * recoilVelRotX;
      recoilVelRotX += fRot * delta;
      recoilRotX += recoilVelRotX * delta;

      if (Math.abs(recoilOffsetZ) < 0.001 && Math.abs(recoilVelZ) < 0.001) {
        recoilOffsetZ = 0;
        recoilVelZ = 0;
      }
      if (Math.abs(recoilRotX) < 0.001 && Math.abs(recoilVelRotX) < 0.001) {
        recoilRotX = 0;
        recoilVelRotX = 0;
      }

      gunModel.position.z = recoilOffsetZ;
      gunModel.rotation.x = recoilRotX;
    }

    if (isDead) {
      if (deathProgress < 1.0) {
        deathProgress = Math.min(1.0, deathProgress + delta * 2.8);
        root.rotation.x = (Math.PI / 2) * deathProgress;
        root.position.y -= delta * 1.5;
        torsoGroup.rotation.y = deathProgress * 0.45;
        if (nameplateSprite) nameplateSprite.visible = false;
      }
      return;
    }

    // Walking / Running locomotion
    if (speed > 0.3 && isGrounded) {
      const freq = speed > 6 ? 14 : 9.5;
      walkPhase += delta * freq;

      const swing = Math.sin(walkPhase) * 0.65;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;

      torsoGroup.position.y = 1.05 + Math.abs(Math.sin(walkPhase)) * 0.07;

      if (!isAiming) {
        rightArm.rotation.x = -1.18 + Math.sin(walkPhase) * 0.18;
        leftArm.rotation.x = -1.18 - Math.sin(walkPhase) * 0.18;
      }
    } else {
      // Idle breathing
      walkPhase += delta * 2.2;
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.15);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.15);
      torsoGroup.position.y = 1.05 + Math.sin(walkPhase) * 0.015;
    }

    // Aiming adjustments & pitch tracking
    const targetPitch = pitch || 0;
    torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, targetPitch * 0.35, 0.25);
    gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, targetPitch * 0.65, 0.25);

    if (isAiming) {
      gunGroup.position.set(0.12, 0.16, 0.24);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, -0.82 + targetPitch, 0.3);
      rightArm.rotation.y = -0.20;
      rightArm.rotation.z = 0.10;

      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -1.05 + targetPitch, 0.3);
      leftArm.rotation.y = 0.42;
      leftArm.rotation.z = -0.18;
    } else {
      gunGroup.position.set(0.16, 0.10, 0.26);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, -0.62 + targetPitch + (speed > 0.3 ? Math.sin(walkPhase) * 0.08 : 0), 0.2);
      rightArm.rotation.y = -0.24;
      rightArm.rotation.z = 0.12;

      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -0.85 + targetPitch - (speed > 0.3 ? Math.sin(walkPhase) * 0.08 : 0), 0.2);
      leftArm.rotation.y = 0.48;
      leftArm.rotation.z = -0.22;
    }
  }

  // Visceral, punchy physical weapon recoil impulse
  function playRecoil() {
    recoilOffsetZ = -0.12;      // Gun kicks back into shoulder
    recoilVelZ = -3.2;
    recoilRotX = 0.22;          // Muzzle climbs upward
    recoilVelRotX = 5.5;

    // Trigger arm shockwave
    rightArm.rotation.x += 0.09;
    rightArm.rotation.y += (Math.random() - 0.5) * 0.04;
  }

  function setDead() {
    isDead = true;
    if (nameplateSprite) nameplateSprite.visible = false;
  }

  function getMuzzleWorldPosition() {
    const v = new THREE.Vector3();
    muzzleMarker.getWorldPosition(v);
    return v;
  }

  function getEjectionWorldPosition() {
    const v = new THREE.Vector3();
    ejectionPort.getWorldPosition(v);
    return v;
  }

  function getRightDirection() {
    const v = new THREE.Vector3(1, 0, 0);
    v.applyQuaternion(gunModel.getWorldQuaternion(new THREE.Quaternion()));
    return v;
  }

  function setUpgradeVisuals(upgraded) {
    if (upgraded) {
      receiverLower.material = goldAccentMat;
      receiverUpper.material = goldAccentMat;
      barrel.material = goldAccentMat;
      compensator.material = goldAccentMat;
      topRail.material = goldAccentMat;
    }
  }

  function resetPose() {
    isDead = false;
    walkPhase = 0;
    recoilOffsetZ = 0;
    recoilRotX = 0;
    recoilVelZ = 0;
    recoilVelRotX = 0;
    gunModel.position.set(0, 0, 0);
    gunModel.rotation.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    torsoGroup.position.set(0, 1.05, 0);
    torsoGroup.rotation.set(0, 0, 0);
    leftLeg.rotation.set(0, 0, 0);
    rightLeg.rotation.set(0, 0, 0);
    leftArm.rotation.set(-0.85, 0.48, -0.22);
    rightArm.rotation.set(-0.62, -0.24, 0.12);
    if (nameplateSprite) nameplateSprite.visible = true;
  }

  function playReload() {
    recoilRotX = -0.35;
    recoilOffsetZ = -0.06;
    if (leftArm) leftArm.rotation.x = -0.6;
  }

  return {
    root,
    torsoGroup,
    headGroup,
    rightArm,
    leftArm,
    gunGroup,
    gunModel,
    muzzleMarker,
    ejectionPort,
    nameplateSprite,
    updateNameplate,
    updateAnimation,
    playRecoil,
    playReload,
    setMountedScope,
    setDead,
    resetPose,
    getMuzzleWorldPosition,
    getEjectionWorldPosition,
    getRightDirection,
    setUpgradeVisuals,
    get isDead() { return isDead; }
  };
}
