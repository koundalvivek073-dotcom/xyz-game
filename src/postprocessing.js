import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostProcessingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    // Screen Shake state
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;

    // Effect Composer
    this.composer = new EffectComposer(this.renderer);

    // 1. Render Pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 2. Unreal Bloom Pass (subtle bloom on glowing lasers/visors, no daytime glare)
    const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.bloomPass = new UnrealBloomPass(res, 0.35, 0.25, 0.90);
    this.composer.addPass(this.bloomPass);

    // 3. Output Pass (proper tone mapping & sRGB conversion)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  // Trigger camera shake on gunshots, damage, or explosions
  addShake(intensity = 0.08, duration = 0.2) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  update(delta) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const progress = Math.max(0, this.shakeTimer / this.shakeDuration);
      const currentAmp = this.shakeIntensity * progress;

      // Godot-style high-frequency decaying shake
      const freq = 35;
      const offsetPitch = Math.sin(this.shakeTimer * freq) * currentAmp;
      const offsetYaw = Math.cos(this.shakeTimer * freq * 1.3) * currentAmp * 0.7;

      this.camera.rotation.x += offsetPitch;
      this.camera.rotation.y += offsetYaw;

      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  render(delta) {
    this.update(delta);
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }
}
