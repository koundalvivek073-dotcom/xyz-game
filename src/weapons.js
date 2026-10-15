import * as THREE from 'three';

export const WEAPON_CONFIGS = {
  standard: {
    name: 'AR-4 / 5.56',
    damage: 26,
    headshotMultiplier: 2.2,
    fireRate: 0.095, // 630 RPM
    magSize: 30,
    maxReserve: 150,
    reloadTime: 1.7,
    hipSpread: 0.038,
    aimSpread: 0.012,
    range: 160,
    tracerColor: 0xffea77
  },
  upgraded: {
    name: 'AR-4 MKII / GOLD',
    damage: 38,
    headshotMultiplier: 2.5,
    fireRate: 0.08, // 750 RPM
    magSize: 40,
    maxReserve: 240,
    reloadTime: 1.2,
    hipSpread: 0.02,
    aimSpread: 0.006,
    range: 200,
    tracerColor: 0xffcc22
  }
};

export class WeaponManager {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.particles = [];
    this.muzzleFlashes = [];

    // Shared materials
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.95 });
    this.bloodMat = new THREE.MeshBasicMaterial({ color: 0xcc1122, transparent: true, opacity: 0.9 });
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.35 });
    this.particleGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);

    // Tactical Laser Sight
    const laserGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4);
    laserGeo.rotateX(Math.PI / 2);
    this.laserMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6
    });
    this.laserBeam = new THREE.Mesh(laserGeo, this.laserMat);
    this.laserBeam.visible = false;
    this.scene.add(this.laserBeam);

    // Laser Dot at impact
    const dotGeo = new THREE.SphereGeometry(0.04, 6, 6);
    this.laserDot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
    this.laserDot.visible = false;
    this.scene.add(this.laserDot);
  }

  // Update real-time laser sight
  updateLaserSight(muzzlePos, hitPos, isAiming) {
    if (!isAiming || !muzzlePos || !hitPos) {
      this.laserBeam.visible = false;
      this.laserDot.visible = false;
      return;
    }

    const dir = new THREE.Vector3().subVectors(hitPos, muzzlePos);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(muzzlePos, hitPos).multiplyScalar(0.5);

    this.laserBeam.visible = true;
    this.laserBeam.scale.set(1, 1, length);
    this.laserBeam.position.copy(mid);
    this.laserBeam.lookAt(hitPos);

    this.laserDot.visible = true;
    this.laserDot.position.copy(hitPos);
  }

  // Create high-intensity glowing bullet tracer
  createTracer(start, end, isUpgraded = false) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const geo = new THREE.CylinderGeometry(0.035, 0.035, length, 5);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: isUpgraded ? 0xffe044 : 0xffffaa,
      transparent: true,
      opacity: 0.98
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.lookAt(end);
    this.scene.add(mesh);

    this.tracers.push({
      mesh,
      life: 0.08
    });
  }

  // Punchy muzzle flash with explosive bloom
  createMuzzleFlash(position, isUpgraded = false) {
    const light = new THREE.PointLight(isUpgraded ? 0xffcc33 : 0xffaa22, 6, 8);
    light.position.copy(position);
    this.scene.add(light);

    const flashGeo = new THREE.SphereGeometry(0.24, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({
      color: isUpgraded ? 0xfff0aa : 0xffe888,
      transparent: true,
      opacity: 0.95
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(position);
    this.scene.add(flashMesh);

    this.muzzleFlashes.push({ light, mesh: flashMesh, life: 0.045 });

    // Muzzle smoke puff
    for (let s = 0; s < 3; s++) {
      const smoke = new THREE.Mesh(this.particleGeo, this.smokeMat);
      smoke.position.copy(position);
      smoke.scale.setScalar(1.5 + Math.random());
      this.scene.add(smoke);
      this.particles.push({
        mesh: smoke,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.5 + 0.5,
          (Math.random() - 0.5) * 1.5
        ),
        life: 0.4
      });
    }
  }

  // Debris & blood sparks
  createImpactEffect(position, normal, isFlesh = false) {
    const count = isFlesh ? 9 : 7;
    const mat = isFlesh ? this.bloodMat : this.sparkMat;

    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(this.particleGeo, mat);
      p.position.copy(position);
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5 + (normal ? normal.x * 2.5 : 0),
        Math.random() * 3.5 + 1.2,
        (Math.random() - 0.5) * 5 + (normal ? normal.z * 2.5 : 0)
      );

      this.particles.push({
        mesh: p,
        velocity: vel,
        life: 0.38 + Math.random() * 0.15
      });
    }
  }

  update(delta) {
    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      mf.life -= delta;
      if (mf.life <= 0) {
        this.scene.remove(mf.light);
        this.scene.remove(mf.mesh);
        mf.mesh.geometry.dispose();
        mf.mesh.material.dispose();
        this.muzzleFlashes.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      } else {
        p.velocity.y -= 10 * delta;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.scale.multiplyScalar(0.94);
      }
    }
  }
}
