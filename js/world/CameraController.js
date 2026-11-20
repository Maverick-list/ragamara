/**
 * NULAR Living Archipelago — CameraController (js/world/CameraController.js)
 * Complete 3-mode camera system:
 *  1. 'first-person'  — Eye-level camera with vertical pitch limits & wall collision
 *  2. 'third-person'  — Over-the-shoulder smooth follow with wall obstruction raycasting
 *  3. 'free-explore'  — Architectural orbit, zoom, pan, reset & optional cinematic orbit
 */
import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'third-person';
    this.yaw = 0;
    this.pitch = 0.36;
    this.distance = 4.8;
    this.height = 1.85;
    this.sensitivity = 1.0;
    this.invertY = false;
    this.fov = 52;
    this.smoothing = 0.16;
    this.showBodyFirstPerson = false;
    this.cinematicOrbit = false;

    this.minDist = 2.4;
    this.maxDist = 18.0;
    this.lookTarget = new THREE.Vector3();
    this.freeTarget = new THREE.Vector3(0, 2.2, 0);
    this.currentPos = new THREE.Vector3(0, 4.5, 14);
    this._raycaster = new THREE.Raycaster();
  }

  applySettings(settings = {}) {
    if (settings.cameraMode) this.setMode(settings.cameraMode);
    if (typeof settings.sensitivity === 'number') this.sensitivity = settings.sensitivity;
    if (typeof settings.distance === 'number') this.distance = Math.max(this.minDist, Math.min(this.maxDist, settings.distance));
    if (typeof settings.height === 'number') this.height = settings.height;
    if (typeof settings.invertY === 'boolean') this.invertY = settings.invertY;
    if (typeof settings.fov === 'number' && this.camera.fov !== settings.fov) {
      this.fov = settings.fov;
      this.camera.fov = settings.fov;
      this.camera.updateProjectionMatrix();
    }
    if (typeof settings.smoothing === 'number') this.smoothing = settings.smoothing;
    if (typeof settings.showBodyFirstPerson === 'boolean') this.showBodyFirstPerson = settings.showBodyFirstPerson;
  }

  setMode(mode, playerPos = null) {
    if (!['first-person', 'third-person', 'free-explore'].includes(mode)) return;
    this.mode = mode;
    if (mode === 'free-explore' && playerPos) {
      this.freeTarget.set(playerPos.x, playerPos.y + 1.8, playerPos.z);
    }
    if (mode === 'first-person') {
      this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch));
    }
  }

  resetBehind(playerPos, playerYaw = Math.PI) {
    this.yaw = playerYaw - Math.PI;
    this.pitch = this.mode === 'first-person' ? 0.0 : 0.34;
    this.lookTarget.set(playerPos.x, playerPos.y + 1.45, playerPos.z);
    this.freeTarget.set(playerPos.x, playerPos.y + 1.8, playerPos.z);
  }

  _avoidWallObstruction(origin, desiredPos, wallEntries = []) {
    if (!wallEntries || !wallEntries.length) return desiredPos;
    const meshes = wallEntries.map((w) => w?.mesh || w).filter((m) => m && typeof m.raycast === 'function');
    if (!meshes.length) return desiredPos;
    const dir = new THREE.Vector3().subVectors(desiredPos, origin);
    const maxLen = dir.length();
    if (maxLen < 0.1) return desiredPos;
    dir.normalize();
    this._raycaster.set(origin, dir);
    this._raycaster.far = maxLen;
    const hits = this._raycaster.intersectObjects(meshes, false);
    if (hits.length > 0 && hits[0].distance > 0.35) {
      return origin.clone().addScaledVector(dir, Math.max(0.35, hits[0].distance - 0.25));
    }
    return desiredPos;
  }

  update(dt, playerPos, input, isInside = false, wallMeshes = []) {
    const look = input.consumeLookDelta();
    const ySign = this.invertY ? -1 : 1;
    const sens = 0.0052 * this.sensitivity;

    this.yaw -= look.x * sens;

    if (this.mode === 'first-person') {
      this.pitch = Math.max(-1.22, Math.min(1.22, this.pitch - look.y * sens * ySign));
      const eyePos = new THREE.Vector3(playerPos.x, playerPos.y + 1.58, playerPos.z);
      const forward = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.currentPos.lerp(eyePos, Math.min(1, dt * 22));
      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentPos.clone().add(forward));
      return;
    }

    if (this.mode === 'free-explore') {
      this.pitch = Math.max(0.06, Math.min(1.38, this.pitch + look.y * sens * ySign));
      this.distance = Math.max(this.minDist, Math.min(26, this.distance + look.zoom));
      if (this.cinematicOrbit) this.yaw += dt * 0.22;

      const mv = input.getMovementInput();
      if (Math.abs(mv.x) > 0.05 || Math.abs(mv.z) > 0.05) {
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        this.freeTarget.x += (mv.x * cosY + mv.z * sinY) * dt * 7.5;
        this.freeTarget.z += (-mv.x * sinY + mv.z * cosY) * dt * 7.5;
      }
      const horiz = Math.cos(this.pitch) * this.distance;
      const offsetY = Math.sin(this.pitch) * this.distance;
      const desired = new THREE.Vector3(
        this.freeTarget.x + Math.sin(this.yaw) * horiz,
        Math.max(0.5, this.freeTarget.y + offsetY),
        this.freeTarget.z + Math.cos(this.yaw) * horiz
      );
      const damp = Math.min(1, dt * (2.5 / Math.max(0.05, this.smoothing)));
      this.currentPos.lerp(desired, damp);
      this.lookTarget.lerp(this.freeTarget, damp);
      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.lookTarget);
      return;
    }

    // Default: 'third-person' over-the-shoulder with wall obstruction avoidance
    this.pitch = Math.max(0.08, Math.min(1.18, this.pitch + look.y * sens * ySign));
    this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance + look.zoom));

    const targetDist = isInside ? Math.min(this.distance, 4.8) : this.distance;
    const headOrigin = new THREE.Vector3(playerPos.x, playerPos.y + Math.min(2.4, this.height * 0.8), playerPos.z);
    const damp = Math.min(1, dt * (1.8 / Math.max(0.05, this.smoothing)));
    this.lookTarget.lerp(headOrigin, damp);

    const horiz = Math.cos(this.pitch) * targetDist;
    const offsetY = Math.sin(this.pitch) * targetDist;
    let desiredPos = new THREE.Vector3(
      this.lookTarget.x + Math.sin(this.yaw) * horiz,
      Math.max(playerPos.y + 0.65, this.lookTarget.y + offsetY),
      this.lookTarget.z + Math.cos(this.yaw) * horiz
    );
    desiredPos = this._avoidWallObstruction(headOrigin, desiredPos, wallMeshes);

    this.currentPos.lerp(desiredPos, damp);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.lookTarget);
  }
}
