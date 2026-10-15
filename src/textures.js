import * as THREE from 'three';

// Procedural Canvas Texture Generator for PBR Materials
export function createSandTextures() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base sand color
  ctx.fillStyle = '#caa570';
  ctx.fillRect(0, 0, size, size);

  // Micro sand grains and ripples
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Normal map canvas
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d');
  const nImgData = nCtx.createImageData(size, size);
  const nData = nImgData.data;

  // Roughness canvas
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');
  const rImgData = rCtx.createImageData(size, size);
  const rData = rImgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Ripple wave function
      const ripple = Math.sin(x * 0.12 + Math.cos(y * 0.08) * 3) * 0.5 + 0.5;
      const grain = (Math.random() - 0.5) * 28;

      // Color variation
      const r = Math.min(255, Math.max(0, 202 + ripple * 22 + grain));
      const g = Math.min(255, Math.max(0, 165 + ripple * 18 + grain * 0.8));
      const b = Math.min(255, Math.max(0, 112 + ripple * 14 + grain * 0.6));

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;

      // Normal map (tangent space: R=X, G=Y, B=Z)
      const nx = Math.cos(x * 0.12) * 40;
      const ny = Math.sin(y * 0.08) * 40;
      nData[idx] = Math.min(255, Math.max(0, 128 + nx));
      nData[idx + 1] = Math.min(255, Math.max(0, 128 + ny));
      nData[idx + 2] = 230; // Z pointing up
      nData[idx + 3] = 255;

      // Roughness (sand is very rough, 0.85 - 0.95)
      const roughVal = Math.min(255, Math.max(0, 220 + (Math.random() - 0.5) * 30));
      rData[idx] = roughVal;
      rData[idx + 1] = roughVal;
      rData[idx + 2] = roughVal;
      rData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  nCtx.putImageData(nImgData, 0, 0);
  rCtx.putImageData(rImgData, 0, 0);

  const diffuseMap = new THREE.CanvasTexture(canvas);
  diffuseMap.wrapS = THREE.RepeatWrapping;
  diffuseMap.wrapT = THREE.RepeatWrapping;
  diffuseMap.repeat.set(40, 40);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(40, 40);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(40, 40);

  return { diffuseMap, normalMap, roughnessMap };
}

// Procedural Rock Texture with layered strata
export function createRockTextures() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6e543e';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const strata = Math.sin(y * 0.08 + Math.sin(x * 0.03) * 4) * 25;
      const noise = (Math.random() - 0.5) * 35;

      data[idx] = Math.min(255, Math.max(0, 110 + strata + noise));
      data[idx + 1] = Math.min(255, Math.max(0, 84 + strata * 0.8 + noise));
      data[idx + 2] = Math.min(255, Math.max(0, 62 + strata * 0.6 + noise));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

// Procedural Metal Container with Corrugation & Rust
export function createContainerTexture(isRust = false) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base paint
  ctx.fillStyle = isRust ? '#5a3d2e' : '#33443a';
  ctx.fillRect(0, 0, size, size);

  // Vertical corrugation stripes
  const stripeW = 16;
  for (let x = 0; x < size; x += stripeW) {
    const isHighlight = (x / stripeW) % 2 === 0;
    ctx.fillStyle = isHighlight
      ? (isRust ? '#6e4b37' : '#3d5246')
      : (isRust ? '#452e22' : '#27332c');
    ctx.fillRect(x, 0, stripeW / 2, size);
  }

  // Industrial stencils and warning marks
  ctx.fillStyle = '#eedd88';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('LF-08 // HAZARD', 35, 70);

  // Horizontal reinforcement rails
  ctx.fillStyle = '#222825';
  ctx.fillRect(0, size * 0.25, size, 8);
  ctx.fillRect(0, size * 0.75, size, 8);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
