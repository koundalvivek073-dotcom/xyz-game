import * as THREE from 'three';

export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;

    // Movement & state keys
    this.keys = {};
    this.prevKeys = {};

    // Mouse state
    this.mouseSensitivity = 0.0022;
    this.mouseSmoothing = 26.0;
    this.rawYaw = 0;
    this.rawPitch = 0.08;
    this.yaw = 0;
    this.pitch = 0.08;
    this.swayYaw = 0;
    this.swayPitch = 0;

    // Combat clicks
    this.isFiring = false;
    this.isAiming = false; // ADS hold or toggle

    // Lock status
    this.isPointerLocked = false;
    this.isUIOpen = false;

    // Callbacks for discrete actions
    this.onAction = null; // (actionName) => {}

    this.setupListeners();
  }

  setupListeners() {
    // Keyboard down
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Handle discrete actions on initial keydown
      if (!this.prevKeys[e.code]) {
        this.handleKeyDownAction(e);
      }
      this.prevKeys[e.code] = true;
    });

    // Keyboard up
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.prevKeys[e.code] = false;
    });

    // Mouse move (Pointer lock look)
    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && !this.isUIOpen) {
        const deltaX = e.movementX || 0;
        const deltaY = e.movementY || 0;

        this.rawYaw -= deltaX * this.mouseSensitivity;
        this.rawPitch -= deltaY * this.mouseSensitivity;

        // Clamp pitch to avoid gimbal flipping (-75 deg to +65 deg)
        this.rawPitch = Math.max(-0.65, Math.min(0.95, this.rawPitch));

        this.swayYaw = THREE.MathUtils.lerp(this.swayYaw, -deltaX * 0.0006, 0.25);
        this.swayPitch = THREE.MathUtils.lerp(this.swayPitch, deltaY * 0.0006, 0.25);
      }
    });

    // Mouse button down - attached to window so clicks are NEVER dropped
    window.addEventListener('mousedown', (e) => {
      if (this.isUIOpen) return;
      if (e.target.closest && (e.target.closest('#hud button') || e.target.closest('.overlay') || e.target.closest('#lobby') || e.target.closest('.modal-panel'))) {
        return;
      }

      if (!this.isPointerLocked) {
        this.requestPointerLock();
      }

      if (e.button === 0) {
        this.isFiring = true;
        if (this.onAction) this.onAction('fire_click');
      } else if (e.button === 2) {
        this.rightMouseDownTime = performance.now();
        this.isAiming = !this.isAiming;
      }
    });

    // Mouse button up
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isFiring = false;
      } else if (e.button === 2) {
        const holdDuration = performance.now() - (this.rightMouseDownTime || 0);
        if (holdDuration > 220) {
          // Held for over 220ms -> release on mouseup
          this.isAiming = false;
        }
        // Quick click (<= 220ms) stays toggled
      }
    });

    // Mouse wheel to cycle weapon optics
    window.addEventListener('wheel', (e) => {
      if (this.isPointerLocked && !this.isUIOpen) {
        if (this.onAction) {
          this.onAction('scope_cycle');
        }
      }
    }, { passive: true });

    // Prevent context menu on right click (ADS)
    window.addEventListener('contextmenu', (e) => {
      if (this.isPointerLocked || !this.isUIOpen) {
        e.preventDefault();
      }
    });

    // Pointer lock change listener
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      if (!this.isPointerLocked) {
        this.isFiring = false;
        this.isAiming = false;
      }
    });
  }

  handleKeyDownAction(e) {
    if (!this.onAction) return;

    switch (e.code) {
      case 'KeyV':
      case 'KeyT':
        this.onAction('scope_cycle');
        break;
      case 'KeyR':
        this.onAction('reload');
        break;
      case 'KeyH':
        this.onAction('heal');
        break;
      case 'KeyC':
      case 'ControlLeft':
      case 'ControlRight':
        this.onAction('crouch');
        break;
      case 'KeyZ':
        this.onAction('prone');
        break;
      case 'KeyE':
      case 'KeyF':
        this.onAction('interact');
        break;
      case 'Digit1':
        this.onAction('weapon_1');
        break;
      case 'Digit2':
        this.onAction('weapon_2');
        break;
      case 'Digit3':
      case 'KeyX':
        this.onAction('weapon_holster');
        break;
      case 'Tab':
      case 'KeyI':
        e.preventDefault();
        this.onAction('inventory');
        break;
      case 'KeyM':
        this.onAction('map');
        break;
      case 'Escape':
        this.onAction('pause');
        break;
    }
  }

  requestPointerLock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch (_) {}
  }

  exitPointerLock() {
    try {
      if (document.pointerLockElement) {
        const p = document.exitPointerLock?.();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
    } catch (_) {}
  }

  setUIOpen(isOpen) {
    this.isUIOpen = isOpen;
    if (isOpen) {
      this.exitPointerLock();
      this.isFiring = false;
      this.isAiming = false;
    } else {
      this.requestPointerLock();
    }
  }

  update(delta) {
    // Smooth camera look interpolation
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.rawYaw, Math.min(1.0, this.mouseSmoothing * delta));
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.rawPitch, Math.min(1.0, this.mouseSmoothing * delta));
  }

  // Returns normalized 8-directional vector [x: strafe, y: forward/back]
  getMovementVector() {
    let forward = 0;
    let right = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) right += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) right -= 1;

    const len = Math.hypot(right, forward);
    if (len > 0.001) {
      return { x: right / len, z: forward / len, isMoving: true };
    }
    return { x: 0, z: 0, isMoving: false };
  }

  isSprinting() {
    const isMovingForward = (this.keys['KeyW'] || this.keys['ArrowUp']);
    return (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && isMovingForward && !this.isAiming;
  }

  isJumping() {
    return !!this.keys['Space'];
  }
}
