import * as THREE from 'three';
import { MAP_SIZE, HALF_MAP, getTerrainHeight } from './terrain.js';

export class EnvironmentManager {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.time = 0;

    this.setupLighting();
    this.setupAtmosphericFog();
    this.setupInstancedGrass();
    this.setupInstancedTrees();
  }

  setupLighting() {
    // 1. Soft, balanced desert sunlight (no harsh blinding blowout)
    this.sunLight = new THREE.DirectionalLight(0xffecd0, 0.65);
    this.sunLight.position.set(120, 160, 95);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    this.sunLight.shadow.camera.left = -160;
    this.sunLight.shadow.camera.right = 160;
    this.sunLight.shadow.camera.top = 160;
    this.sunLight.shadow.camera.bottom = -160;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    // 2. Gentle ambient hemisphere bounce
    this.hemiLight = new THREE.HemisphereLight(0x769eb8, 0x544230, 0.28);
    this.scene.add(this.hemiLight);

    // 3. Subtle cool counter-fill from opposite flank
    this.fillLight = new THREE.DirectionalLight(0x60889c, 0.15);
    this.fillLight.position.set(-90, 70, -80);
    this.scene.add(this.fillLight);
  }

  setupAtmosphericFog() {
    const fogColor = new THREE.Color(0xb8a488);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2(fogColor, 0.003);
  }

  // ──────────────────────────────────────────────────────────
  //  LUSH CURVED 3D INSTANCED GRASS WITH FLUID WIND SHADER
  // ──────────────────────────────────────────────────────────
  setupInstancedGrass() {
    const GRASS_COUNT = 6500;

    // Organic multi-blade curved grass clump (6 curved blades with 3 segments each)
    const bladePositions = [];
    const bladeNormals = [];
    const bladeUVs = [];
    const bladeIndices = [];

    const NUM_BLADES = 6;
    let vertexOffset = 0;

    for (let b = 0; b < NUM_BLADES; b++) {
      const angle = (b / NUM_BLADES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const baseW = 0.07 + Math.random() * 0.03;
      const height = 0.65 + Math.random() * 0.35;
      const curveAmount = (0.15 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1);

      // 3 vertical segments for a smooth natural blade curve (no flat triangle look!)
      // Bottom (y=0)
      const p0L = [-baseW * cos, 0, -baseW * sin];
      const p0R = [baseW * cos, 0, baseW * sin];

      // Mid (y = 0.5 * height)
      const midW = baseW * 0.7;
      const p1L = [-midW * cos + cos * curveAmount * 0.4, height * 0.5, -midW * sin + sin * curveAmount * 0.4];
      const p1R = [midW * cos + cos * curveAmount * 0.4, height * 0.5, midW * sin + sin * curveAmount * 0.4];

      // Tip (y = height)
      const tipW = baseW * 0.2;
      const p2L = [-tipW * cos + cos * curveAmount, height, -tipW * sin + sin * curveAmount];
      const p2R = [tipW * cos + cos * curveAmount, height, tipW * sin + sin * curveAmount];

      bladePositions.push(
        ...p0L, ...p0R,
        ...p1L, ...p1R,
        ...p2L, ...p2R
      );

      // Normal pointing outward
      const nx = -sin, nz = cos;
      for (let s = 0; s < 6; s++) {
        bladeNormals.push(nx, 0.4, nz);
      }

      bladeUVs.push(
        0, 0, 1, 0,
        0, 0.5, 1, 0.5,
        0, 1.0, 1, 1.0
      );

      // 2 quads (4 triangles) per blade
      bladeIndices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset + 1, vertexOffset + 3, vertexOffset + 2,
        vertexOffset + 2, vertexOffset + 3, vertexOffset + 4,
        vertexOffset + 3, vertexOffset + 5, vertexOffset + 4
      );

      vertexOffset += 6;
    }

    const grassGeo = new THREE.BufferGeometry();
    grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(bladePositions, 3));
    grassGeo.setAttribute('normal', new THREE.Float32BufferAttribute(bladeNormals, 3));
    grassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bladeUVs, 2));
    grassGeo.setIndex(bladeIndices);

    // Wind shader material
    this.grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x7fa248,
      roughness: 0.82,
      metalness: 0.04,
      side: THREE.DoubleSide
    });

    this.grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = { value: 0 };
      this.grassWindUniform = shader.uniforms.uWindTime;

      shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float windStrength = uv.y * uv.y;
        float worldX = (modelMatrix * vec4(position, 1.0)).x;
        float worldZ = (modelMatrix * vec4(position, 1.0)).z;
        float wave1 = sin(worldX * 0.07 + uWindTime * 2.4) * 0.26;
        float wave2 = sin(worldZ * 0.05 + uWindTime * 1.8 + 1.2) * 0.18;
        float wave3 = sin((worldX + worldZ) * 0.11 + uWindTime * 3.8) * 0.09;
        transformed.x += (wave1 + wave3) * windStrength;
        transformed.z += (wave2 + wave3 * 0.5) * windStrength;
        `
      );
    };

    this.grassInstanced = new THREE.InstancedMesh(grassGeo, this.grassMaterial, GRASS_COUNT);
    this.grassInstanced.receiveShadow = true;
    this.grassInstanced.castShadow = false;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < GRASS_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 138;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);

      if (y < 13.5) {
        dummy.position.set(x, y - 0.04, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scaleXZ = 0.8 + Math.random() * 0.7;
        const scaleY = 0.7 + Math.random() * 0.9;
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.updateMatrix();
        this.grassInstanced.setMatrixAt(i, dummy.matrix);

        // Near oasis (SW), grass is lush vibrant emerald green; across dunes it's golden straw
        const distOasis = Math.hypot(x + 70, z - 65);
        if (distOasis < 40) {
          const t = distOasis / 40;
          color.setHSL(0.28, 0.65, 0.32).lerp(new THREE.Color(0x8fa450), t);
        } else {
          const hue = 0.16 + Math.random() * 0.07;
          const sat = 0.40 + Math.random() * 0.25;
          const lit = 0.34 + Math.random() * 0.14;
          color.setHSL(hue, sat, lit);
        }
        this.grassInstanced.setColorAt(i, color);
      } else {
        dummy.position.set(0, -999, 0);
        dummy.updateMatrix();
        this.grassInstanced.setMatrixAt(i, dummy.matrix);
      }
    }

    this.grassInstanced.instanceMatrix.needsUpdate = true;
    if (this.grassInstanced.instanceColor) this.grassInstanced.instanceColor.needsUpdate = true;
    this.scene.add(this.grassInstanced);
  }

  // ──────────────────────────────────────────────────────────
  //  HIGH-FIDELITY PROCEDURAL ACACIA & OASIS PALM TREES
  // ──────────────────────────────────────────────────────────
  setupInstancedTrees() {
    this.treeGroup = new THREE.Group();
    this.scene.add(this.treeGroup);

    // Smooth organic foliage geometry (high-subdivision sphere with soft organic perturbations)
    const canopyGeo = new THREE.SphereGeometry(1.0, 16, 12);
    const pos = canopyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      // Soft organic noise perturbations to remove any spherical uniformity
      const noise = 1.0 + Math.sin(vx * 4.0 + vy * 3.0) * 0.08 + Math.cos(vz * 5.0) * 0.06;
      pos.setXYZ(i, vx * noise, vy * (0.65 + Math.sin(vx * 3.0) * 0.1), vz * noise);
    }
    canopyGeo.computeVertexNormals();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x483424,
      roughness: 0.88,
      metalness: 0.05
    });

    const palmTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x5a4632,
      roughness: 0.85,
      metalness: 0.04
    });

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x3d7034,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide
    });

    const palmFrondMat = new THREE.MeshStandardMaterial({
      color: 0x2e6b2c,
      roughness: 0.6,
      metalness: 0.06,
      side: THREE.DoubleSide
    });

    // Wind animation shader on canopies
    foliageMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = { value: 0 };
      this.treeWindUniform = shader.uniforms.uWindTime;

      shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float wX = (modelMatrix * vec4(position, 1.0)).x;
        float wZ = (modelMatrix * vec4(position, 1.0)).z;
        float sway = sin(wX * 0.05 + uWindTime * 1.5) * 0.14 + sin(wZ * 0.07 + uWindTime * 1.9) * 0.09;
        transformed.x += sway * 0.6;
        transformed.z += sway * 0.4;
        `
      );
    };

    // 1. DESERT SAVANNA ACACIA TREES (Spread across map)
    const ACACIA_COUNT = 65;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.42, 1.0, 10);

    for (let i = 0; i < ACACIA_COUNT; i++) {
      const tx = (Math.random() - 0.5) * 290;
      const tz = (Math.random() - 0.5) * 290;
      if (Math.hypot(tx, tz) < 22) continue;

      const ty = getTerrainHeight(tx, tz);
      if (ty > 13.5) continue; // No trees on steep cliffs

      const treeScale = 0.9 + Math.random() * 0.6;
      const trunkH = (4.5 + Math.random() * 3.0) * treeScale;

      // Curved sculpted trunk
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.set(treeScale, trunkH, treeScale);
      trunk.position.set(tx, ty + trunkH * 0.5, tz);
      trunk.rotation.z = (Math.random() - 0.5) * 0.12;
      trunk.rotation.x = (Math.random() - 0.5) * 0.12;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      this.treeGroup.add(trunk);

      // Layered wide umbrella canopy pads (Acacia style)
      const numLayers = 3 + Math.floor(Math.random() * 3);
      const canopyBaseY = ty + trunkH * 0.85;

      for (let c = 0; c < numLayers; c++) {
        const canopy = new THREE.Mesh(canopyGeo, foliageMat);
        const padRadius = (1.8 + Math.random() * 1.3) * treeScale;

        const cAngle = (c / numLayers) * Math.PI * 2 + Math.random() * 0.5;
        const cDist = (0.5 + Math.random() * 1.2) * treeScale;
        const cx = tx + Math.cos(cAngle) * cDist;
        const cz = tz + Math.sin(cAngle) * cDist;
        const cy = canopyBaseY + (c * 0.45 + (Math.random() - 0.5) * 0.3) * treeScale;

        // Flattened umbrella canopy shape
        canopy.scale.set(padRadius, padRadius * 0.38, padRadius);
        canopy.position.set(cx, cy, cz);
        canopy.rotation.y = Math.random() * Math.PI;
        canopy.castShadow = true;
        canopy.receiveShadow = true;
        this.treeGroup.add(canopy);
      }

      // Branching arms
      for (let b = 0; b < 2; b++) {
        const bAngle = (b * Math.PI) + Math.random() * 0.8;
        const bLen = (1.8 + Math.random() * 1.4) * treeScale;
        const bY = ty + trunkH * (0.65 + b * 0.15);
        const branchGeo = new THREE.CylinderGeometry(0.06 * treeScale, 0.14 * treeScale, bLen, 8);
        const branch = new THREE.Mesh(branchGeo, trunkMat);
        branch.position.set(
          tx + Math.cos(bAngle) * bLen * 0.4,
          bY,
          tz + Math.sin(bAngle) * bLen * 0.4
        );
        branch.rotation.z = Math.PI / 2.8;
        branch.rotation.y = bAngle;
        branch.castShadow = true;
        this.treeGroup.add(branch);
      }
    }

    // 2. DESERT OASIS FAN PALMS (Clustered around South-West Oasis: x: -70, z: 65)
    const PALM_COUNT = 24;
    const palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.32, 1.0, 10);

    // Drooping Palm Frond geometry
    const frondGeo = new THREE.PlaneGeometry(0.65, 2.4, 4, 6);
    const fPos = frondGeo.attributes.position;
    for (let p = 0; p < fPos.count; p++) {
      const y = fPos.getY(p);
      const arc = Math.pow(Math.max(0, y + 1.2) / 2.4, 2) * 0.65;
      fPos.setZ(p, fPos.getZ(p) - arc);
    }
    frondGeo.computeVertexNormals();

    for (let p = 0; p < PALM_COUNT; p++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pDist = 6 + Math.random() * 26;
      const px = -70 + Math.cos(pAngle) * pDist;
      const pz = 65 + Math.sin(pAngle) * pDist;
      const py = getTerrainHeight(px, pz);

      const palmScale = 0.9 + Math.random() * 0.5;
      const palmH = (6.0 + Math.random() * 3.5) * palmScale;

      // Curved tall palm trunk
      const palmTrunk = new THREE.Mesh(palmTrunkGeo, palmTrunkMat);
      palmTrunk.scale.set(palmScale, palmH, palmScale);
      palmTrunk.position.set(px, py + palmH * 0.5, pz);
      palmTrunk.rotation.z = (Math.random() - 0.5) * 0.22;
      palmTrunk.rotation.x = (Math.random() - 0.5) * 0.22;
      palmTrunk.castShadow = true;
      palmTrunk.receiveShadow = true;
      this.treeGroup.add(palmTrunk);

      // Frond Crown (10 radiating drooping fronds)
      const crownY = py + palmH;
      const crownGroup = new THREE.Group();
      crownGroup.position.set(px, crownY, pz);

      const NUM_FRONDS = 10;
      for (let f = 0; f < NUM_FRONDS; f++) {
        const fAngle = (f / NUM_FRONDS) * Math.PI * 2;
        const frond = new THREE.Mesh(frondGeo, palmFrondMat);
        frond.scale.set(palmScale, palmScale, palmScale);
        frond.position.set(Math.cos(fAngle) * 0.2, 0, Math.sin(fAngle) * 0.2);
        frond.rotation.y = fAngle;
        frond.rotation.x = -Math.PI / 4.5 + (Math.random() - 0.5) * 0.2;
        frond.castShadow = true;
        crownGroup.add(frond);
      }

      this.treeGroup.add(crownGroup);
    }
  }

  // Call each frame to animate wind
  update(delta) {
    this.time += delta;
    if (this.grassWindUniform) {
      this.grassWindUniform.value = this.time;
    }
    if (this.treeWindUniform) {
      this.treeWindUniform.value = this.time;
    }
  }

  // Custom GLSL Shader for Dynamic Multi-Texture Splatting Terrain
  static createTerrainSplatMaterial(sandTexture, rockTexture) {
    const customMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSandTexture: { value: sandTexture },
        uRockTexture: { value: rockTexture },
        uLightDirection: { value: new THREE.Vector3(130, 190, 110).normalize() },
        uSunColor: { value: new THREE.Color(0xfff0d0) },
        uAmbientColor: { value: new THREE.Color(0x6e5239) },
        uFogColor: { value: new THREE.Color(0xd2be9f) },
        uFogDensity: { value: 0.0035 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vHeight;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vHeight = position.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uSandTexture;
        uniform sampler2D uRockTexture;
        uniform vec3 uLightDirection;
        uniform vec3 uSunColor;
        uniform vec3 uAmbientColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vHeight;

        void main() {
          vec3 sandTex = texture2D(uSandTexture, vWorldPosition.xz * 0.06).rgb;
          vec3 rockTex = texture2D(uRockTexture, vWorldPosition.xz * 0.04).rgb;

          float slope = 1.0 - max(0.0, dot(vNormal, vec3(0.0, 1.0, 0.0)));
          float rockFactor = smoothstep(0.28, 0.65, slope);

          float heightFactor = smoothstep(8.0, 18.0, vHeight);
          float blend = clamp(rockFactor + heightFactor * 0.6, 0.0, 1.0);

          vec3 baseColor = mix(sandTex * vec3(0.95, 0.88, 0.75), rockTex * vec3(0.72, 0.55, 0.42), blend);

          float NdotL = max(0.0, dot(vNormal, uLightDirection));
          vec3 diffuse = uSunColor * NdotL * 0.85;
          vec3 ambient = uAmbientColor * 0.55;
          vec3 litColor = baseColor * (diffuse + ambient);

          float dist = length(vWorldPosition - cameraPosition);
          float fogFactor = 1.0 - exp(-dist * uFogDensity);
          fogFactor = clamp(fogFactor, 0.0, 1.0);

          gl_FragColor = vec4(mix(litColor, uFogColor, fogFactor), 1.0);
        }
      `
    });

    return customMaterial;
  }

  // Dynamic Animated Blue Zone Energy Barrier Shader
  static createBlueZoneShaderMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00a2ff) },
        uRimColor: { value: new THREE.Color(0x88e5ff) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uRimColor;

        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.2);

          float scanline = sin(vWorldPosition.y * 1.8 - uTime * 4.0) * 0.5 + 0.5;
          float grid = sin(vUv.x * 60.0) * sin(vUv.y * 40.0 + uTime);
          grid = smoothstep(0.7, 0.95, abs(grid));

          float alpha = clamp(0.22 + fresnel * 0.65 + scanline * 0.12 + grid * 0.35, 0.0, 0.95);
          vec3 finalColor = mix(uColor, uRimColor, fresnel + grid * 0.5);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }
}
