import * as THREE from 'three';
import { EnvironmentManager } from './EnvironmentManager.js';

export const STORM_PHASES = [
  { waitDuration: 45, shrinkDuration: 35, targetRadius: 105, damage: 2 },
  { waitDuration: 40, shrinkDuration: 30, targetRadius: 60, damage: 4 },
  { waitDuration: 30, shrinkDuration: 25, targetRadius: 28, damage: 8 },
  { waitDuration: 25, shrinkDuration: 20, targetRadius: 8, damage: 14 },
  { waitDuration: 15, shrinkDuration: 15, targetRadius: 0, damage: 25 }
];

export class StormSystem {
  constructor(scene) {
    this.scene = scene;

    // Current active circle
    this.currentCenter = new THREE.Vector2(0, 0);
    this.currentRadius = 165;

    // Target next circle
    this.nextCenter = new THREE.Vector2(0, 0);
    this.nextRadius = STORM_PHASES[0].targetRadius;

    // Start state for current shrink
    this.shrinkStartCenter = new THREE.Vector2(0, 0);
    this.shrinkStartRadius = 165;

    this.currentPhaseIndex = 0;
    this.state = 'waiting'; // 'waiting' or 'shrinking'
    this.timer = STORM_PHASES[0].waitDuration;

    // 3D Visual Storm Barrier (Cylinder with dynamic GLSL energy shader)
    const wallGeo = new THREE.CylinderGeometry(1, 1, 60, 64, 1, true);
    this.wallMat = EnvironmentManager.createBlueZoneShaderMaterial();

    this.stormMesh = new THREE.Mesh(wallGeo, this.wallMat);
    this.stormMesh.position.set(0, 25, 0);
    this.stormMesh.scale.set(this.currentRadius, 1, this.currentRadius);
    this.scene.add(this.stormMesh);

    // Pick first target circle
    this.calculateNextCircle();
  }

  calculateNextCircle() {
    const phase = STORM_PHASES[this.currentPhaseIndex];
    if (!phase) return;

    this.nextRadius = phase.targetRadius;

    // Place next circle inside current circle
    const maxOffset = Math.max(0, this.currentRadius - this.nextRadius - 5);
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * maxOffset * 0.75;

    this.nextCenter.set(
      this.currentCenter.x + Math.cos(angle) * dist,
      this.currentCenter.y + Math.sin(angle) * dist
    );
  }

  update(delta) {
    const phase = STORM_PHASES[this.currentPhaseIndex];
    if (!phase) return;

    this.timer -= delta;

    if (this.state === 'waiting') {
      if (this.timer <= 0) {
        // Start shrinking
        this.state = 'shrinking';
        this.timer = phase.shrinkDuration;
        this.shrinkStartCenter.copy(this.currentCenter);
        this.shrinkStartRadius = this.currentRadius;
      }
    } else if (this.state === 'shrinking') {
      const progress = Math.min(1.0, 1.0 - (this.timer / phase.shrinkDuration));

      // Lerp center and radius
      this.currentCenter.lerpVectors(this.shrinkStartCenter, this.nextCenter, progress);
      this.currentRadius = THREE.MathUtils.lerp(this.shrinkStartRadius, this.nextRadius, progress);

      if (this.timer <= 0) {
        // Shrink complete, advance phase
        this.currentCenter.copy(this.nextCenter);
        this.currentRadius = this.nextRadius;
        this.currentPhaseIndex++;

        if (this.currentPhaseIndex < STORM_PHASES.length) {
          this.state = 'waiting';
          this.timer = STORM_PHASES[this.currentPhaseIndex].waitDuration;
          this.calculateNextCircle();
        } else {
          // Final circle reached (radius 0)
          this.state = 'closed';
          this.timer = 0;
        }
      }
    }

    // Update 3D visual barrier
    this.stormMesh.position.x = this.currentCenter.x;
    this.stormMesh.position.z = this.currentCenter.y;
    this.stormMesh.scale.x = Math.max(0.1, this.currentRadius);
    this.stormMesh.scale.z = Math.max(0.1, this.currentRadius);

    // Update animated shader time uniform
    if (this.wallMat.uniforms && this.wallMat.uniforms.uTime) {
      this.wallMat.uniforms.uTime.value += delta;
    }
  }

  isOutsideSafeZone(x, z) {
    const dist = Math.hypot(x - this.currentCenter.x, z - this.currentCenter.y);
    return dist > this.currentRadius;
  }

  getCurrentDamage() {
    const phase = STORM_PHASES[Math.min(this.currentPhaseIndex, STORM_PHASES.length - 1)];
    return phase ? phase.damage : 25;
  }

  getTimerText() {
    const minutes = Math.floor(Math.max(0, this.timer) / 60);
    const seconds = Math.floor(Math.max(0, this.timer) % 60);
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (this.state === 'waiting') {
      return `ZONE CLOSES IN ${formatted}`;
    } else if (this.state === 'shrinking') {
      return `ZONE RESTRICTING · ${formatted}`;
    } else {
      return `FINAL CIRCLE COLLAPSED`;
    }
  }

  reset() {
    this.currentCenter.set(0, 0);
    this.currentRadius = 165;
    this.currentPhaseIndex = 0;
    this.state = 'waiting';
    this.timer = STORM_PHASES[0].waitDuration;
    this.calculateNextCircle();
  }
}
