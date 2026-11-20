/**
 * NULAR Living Archipelago — CameraController (js/world/CameraController.js)
 * Smooth third-person trailing orbit camera with mouse/touch rotation, zoom,
 * ground avoidance, and smart interior roof cutaway support.
 */
import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.36;
    this.distance = 7.4;
    this.minDist = 3.2;
    this.maxDist = 16.5;
    this.lookTarget = new THREE.Vector3();
    this.currentPos = new THREE.Vector3(0, 4.5, 14);
  }

  resetBehind(playerPos, playerYaw = Math.PI) {
    this.yaw = playerYaw - Math.PI;
    this.pitch = 0.36;
    this.distance = 7.6;
    this.lookTarget.set(playerPos.x, playerPos.y + 1.45, playerPos.z);
  }

  update(dt, playerPos, input, isInside = false) {
    const look = input.consumeLookDelta();
    this.yaw -= look.x * 0.0055;
    this.pitch = Math.max(0.10, Math.min(1.18, this.pitch + look.y * 0.0045));
    this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance + look.zoom));

    // Gently tighten camera when exploring interiors
    const targetDist = isInside ? Math.min(this.distance, 6.2) : this.distance;
    const desiredTarget = new THREE.Vector3(playerPos.x, playerPos.y + 1.42, playerPos.z);
    this.lookTarget.lerp(desiredTarget, Math.min(1, dt * 9));

    const horiz = Math.cos(this.pitch) * targetDist;
    const offsetY = Math.sin(this.pitch) * targetDist;
    const desiredPos = new THREE.Vector3(
      this.lookTarget.x + Math.sin(this.yaw) * horiz,
      Math.max(playerPos.y + 0.65, this.lookTarget.y + offsetY),
      this.lookTarget.z + Math.cos(this.yaw) * horiz
    );

    this.currentPos.lerp(desiredPos, Math.min(1, dt * 10));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.lookTarget);
  }
}
