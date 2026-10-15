import * as THREE from 'three';
import { getTerrainHeight, resolveCollision, worldColliders } from './terrain.js';
import { createCharacter } from './character.js';
import { playJump, playLand } from './audio.js';

export const Stance = {
  STAND: 'STAND',
  CROUCH: 'CROUCH',
  PRONE: 'PRONE'
};

export class PlayerController {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Character 3D Model
    this.character = createCharacter({ isPlayer: true, name: 'PATHFINDER' });
    this.scene.add(this.character.root);

    // Physics & Transform
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0.08;

    // Speeds & Acceleration
    this.walkSpeed = 4.8;
    this.sprintSpeed = 8.4;
    this.crouchSpeed = 2.6;
    this.proneSpeed = 1.3;
    this.jumpForce = 8.5;
    this.gravity = 22.0;
    this.friction = 14.0;
    this.acceleration = 18.0;

    // Stance & State
    this.currentStance = Stance.STAND;
    this.isGrounded = false;
    this.isAiming = false;
    this.isDead = false;
    this.isVaulting = false;

    // Gliding & Shield system
    this.isGliding = false;
    this.isShielded = false;
    this.shieldTimer = 0;

    // Health & Armor Pools
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 100;
    this.maxArmor = 100;
    this.medkits = 3;
    this.kills = 0;

    // Over-the-shoulder TPP Camera
    this.targetCameraDist = 3.6;
    this.currentCameraDist = 3.6;
    this.cameraOffset = new THREE.Vector3(0.55, 1.45, 3.6);
    this.normalFov = 75.0;
    this.adsFov = 48.0;
    this.sprintFov = 84.0;

    // Recoil Camera Kick & Trauma
    this.trauma = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;

    // Raycaster for obstacle camera clipping prevention
    this.camRaycaster = new THREE.Raycaster();
  }

  setStance(stance) {
    if (this.isGliding) return;
    this.currentStance = stance;
  }

  cutParachute() {
    if (!this.isGliding) return;
    this.isGliding = false;
    const groundY = getTerrainHeight(this.position.x, this.position.z);
    this.position.y = groundY;
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.isShielded = true;
    this.shieldTimer = 6.0;
    playLand();
  }

  toggleCrouch() {
    this.setStance(this.currentStance === Stance.CROUCH ? Stance.STAND : Stance.CROUCH);
  }

  toggleProne() {
    this.setStance(this.currentStance === Stance.PRONE ? Stance.STAND : Stance.PRONE);
  }

  addRecoilKick(pitch, yaw) {
    this.recoilPitch += pitch;
    this.recoilYaw += yaw;
    this.trauma = Math.min(1.0, this.trauma + 0.35);
  }

  getMuzzleWorldPos() {
    if (this.character && this.character.getMuzzleWorldPosition) {
      return this.character.getMuzzleWorldPosition();
    }
    return this.position.clone().add(new THREE.Vector3(0.3, 1.3, 0.5));
  }

  applyDamage(amount, attackerName) {
    if (this.isDead || this.isGliding || this.isShielded) return { absorbed: true, damage: 0 };

    let hpDamage = amount;
    if (this.armor > 0 && attackerName !== 'THE STORM') {
      const armorDmg = amount * 0.7;
      hpDamage = amount * 0.3;
      if (this.armor >= armorDmg) {
        this.armor -= armorDmg;
      } else {
        const leftover = armorDmg - this.armor;
        this.armor = 0;
        hpDamage += leftover;
      }
    }

    this.health = Math.max(0, this.health - hpDamage);
    this.trauma = Math.min(1.0, this.trauma + 0.45);

    if (this.health <= 0) {
      this.isDead = true;
      this.character.setDead();
    }

    return { absorbed: false, damage: hpDamage };
  }

  updateMovement(delta, moveVec, isSprinting, isJumping, yaw) {
    if (this.isDead || this.isVaulting) return;

    this.yaw = yaw;

    // 1. Gliding Phase
    if (this.isGliding) {
      const glideSpeed = 10.0;
      if (moveVec.isMoving) {
        const dir = new THREE.Vector3(moveVec.x, 0, -moveVec.z).normalize();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        this.velocity.x = dir.x * glideSpeed;
        this.velocity.z = dir.z * glideSpeed;
      } else {
        this.velocity.x *= 0.95;
        this.velocity.z *= 0.95;
      }

      this.velocity.y = -6.5; // Steady descent
      this.position.addScaledVector(this.velocity, delta);

      const groundY = getTerrainHeight(this.position.x, this.position.z);
      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.velocity.set(0, 0, 0);
        this.isGliding = false;
        this.isGrounded = true;
        this.isShielded = true;
        this.shieldTimer = 6.0;
        playLand();
      }

      this.character.root.position.copy(this.position);
      this.character.root.rotation.y = this.yaw;
      return;
    }

    // 2. Deployment Shield Countdown
    if (this.isShielded) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.isShielded = false;
      }
    }

    // 3. Speed determination based on stance
    let targetSpeed = this.walkSpeed;
    if (this.currentStance === Stance.STAND) {
      targetSpeed = isSprinting ? this.sprintSpeed : this.walkSpeed;
    } else if (this.currentStance === Stance.CROUCH) {
      targetSpeed = this.crouchSpeed;
    } else if (this.currentStance === Stance.PRONE) {
      targetSpeed = this.proneSpeed;
    }

    if (this.isAiming) {
      targetSpeed *= 0.65;
    }

    // 4. Ground Locomotion
    if (moveVec.isMoving) {
      const dir = new THREE.Vector3(moveVec.x, 0, -moveVec.z).normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, dir.x * targetSpeed, delta * this.acceleration);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, dir.z * targetSpeed, delta * this.acceleration);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * this.friction);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * this.friction);
    }

    // 5. Jump & Gravity
    const wasGrounded = this.isGrounded;
    if (isJumping && this.isGrounded && this.currentStance === Stance.STAND) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      playJump();
    }

    this.velocity.y -= this.gravity * delta;

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;
    this.position.y += this.velocity.y * delta;

    const groundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      if (!wasGrounded && this.velocity.y < -2.0) {
        playLand();
      }
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    resolveCollision(this.position, 0.6);

    this.character.root.position.copy(this.position);
    this.character.root.rotation.y = this.yaw;

    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.character.updateAnimation(delta, currentSpeed, this.isGrounded, this.isAiming, this.pitch);
  }

  // True TPP Over-the-Shoulder Camera (PUBG/Fortnite style)
  // Shifts character to the left so center & right view is 100% clear of any character obstruction!
  updateCamera(delta, yaw, pitch, isAiming, isSprinting, terrainMesh, activeScope = null) {
    this.isAiming = isAiming;
    this.pitch = pitch;

    // Recoil recovery
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, delta * 9.0);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, delta * 9.0);

    const effectivePitch = pitch + this.recoilPitch;
    const effectiveYaw = yaw + this.recoilYaw;

    // Dynamic FOV interpolation based on active scope optic
    let targetFov = this.normalFov;
    if (isAiming) {
      targetFov = activeScope ? activeScope.fov : this.adsFov;
    } else if (isSprinting) {
      targetFov = this.sprintFov;
    } else if (this.isGliding) {
      targetFov = 80.0; // Wide cinematic FOV while parachuting
    }
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 15);
    this.camera.updateProjectionMatrix();

    // 1. Sniper Scope (8X) First-Person Mode
    const isSniper = isAiming && activeScope && activeScope.id === 'sniper';
    if (isSniper) {
      // Hide character mesh so ZERO part of your operative blocks the sniper view!
      this.character.root.visible = false;
    } else {
      this.character.root.visible = true;
    }

    // 2. Camera Distance & Shoulder Offset
    // Generous right-shoulder offset shifts character to left of screen, keeping center & right 100% clear!
    let targetDist = 4.0;
    let shoulderOffset = 0.82;
    let heightOffset = 1.62;

    if (this.isGliding) {
      // Parachute glide: zoom out to 7.5m so full parachute and character are framed
      targetDist = 7.5;
      shoulderOffset = 0.45;
      heightOffset = 2.4;
    } else if (isAiming) {
      if (isSniper) {
        targetDist = 0.2;
        shoulderOffset = 0.0;
        heightOffset = 1.48;
      } else if (activeScope && activeScope.id === 'acog') {
        targetDist = 2.0;
        shoulderOffset = 0.78;
        heightOffset = 1.55;
      } else {
        // Holo / Iron sights
        targetDist = 2.3;
        shoulderOffset = 0.78;
        heightOffset = 1.55;
      }
    } else if (isSprinting) {
      targetDist = 4.4;
      shoulderOffset = 0.85;
      heightOffset = 1.65;
    }

    if (this.currentStance === Stance.CROUCH) {
      heightOffset *= 0.72;
    } else if (this.currentStance === Stance.PRONE) {
      heightOffset *= 0.35;
    }

    this.targetCameraDist = targetDist;
    this.currentCameraDist = THREE.MathUtils.lerp(this.currentCameraDist, this.targetCameraDist, delta * 14);

    const charPos = this.position.clone().add(new THREE.Vector3(0, heightOffset, 0));

    // Direction vectors
    const forwardVec = new THREE.Vector3(
      -Math.sin(effectiveYaw) * Math.cos(effectivePitch),
      Math.sin(effectivePitch),
      -Math.cos(effectiveYaw) * Math.cos(effectivePitch)
    ).normalize();

    const rightVec = new THREE.Vector3(
      Math.cos(effectiveYaw),
      0,
      -Math.sin(effectiveYaw)
    ).normalize();

    // Ideal camera position: back along forwardVec and right along rightVec
    const idealCamPos = charPos.clone()
      .addScaledVector(forwardVec, -this.currentCameraDist)
      .addScaledVector(rightVec, shoulderOffset);

    // Obstacle Raycast to prevent clipping through terrain
    const rayDir = idealCamPos.clone().sub(charPos);
    const maxDist = rayDir.length();
    rayDir.normalize();

    this.camRaycaster.set(charPos, rayDir);
    this.camRaycaster.far = maxDist;

    let finalCamPos = idealCamPos;
    if (terrainMesh && !isSniper) {
      const hits = this.camRaycaster.intersectObject(terrainMesh);
      if (hits.length > 0 && hits[0].distance < maxDist - 0.2) {
        finalCamPos = charPos.clone().addScaledVector(rayDir, Math.max(0.6, hits[0].distance - 0.2));
      }
    }

    // Apply Camera Trauma Shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - delta * 1.5);
      const shakeAmt = Math.pow(this.trauma, 2) * 0.04;
      finalCamPos.x += (Math.random() - 0.5) * shakeAmt;
      finalCamPos.y += (Math.random() - 0.5) * shakeAmt;
      finalCamPos.z += (Math.random() - 0.5) * shakeAmt;
    }

    this.camera.position.copy(finalCamPos);

    // Look straight ahead in the forward direction from the camera position!
    // This guarantees the screen center crosshair looks directly parallel to aim!
    const lookTarget = finalCamPos.clone().addScaledVector(forwardVec, 50.0);
    this.camera.lookAt(lookTarget);
  }
}
