/**
 * NULAR Living Archipelago — PlayerController (js/world/PlayerController.js)
 * Capsule physics controller: camera-relative locomotion, smooth turn, sprint, jump,
 * gravity, stair step-up, wall sliding, and interior room zone detection.
 */
import * as THREE from 'three';

export class PlayerController {
  constructor(scene, collisionManager, characterController) {
    this.collision = collisionManager;
    this.character = characterController;

    this.root = new THREE.Group();
    this.root.name = 'PLAYER_RIG';
    scene.add(this.root);
    this.root.add(characterController.avatarGroup);

    this.position = new THREE.Vector3(0, 0.05, 8.5);
    this.velocityY = 0;
    this.yaw = Math.PI; // Facing toward -Z (towards the house front entrance)
    this.grounded = true;
    this.walkSpeed = 4.2;
    this.runSpeed = 7.0;
    this.gravity = -19.5;
    this.jumpSpeed = 6.2;
    this.currentZone = null;
    this.interiorZones = [];
  }

  setSpawn(posArray, yaw = Math.PI) {
    this.position.set(posArray[0] || 0, posArray[1] || 0.05, posArray[2] || 8.0);
    this.velocityY = 0;
    this.yaw = yaw;
    this.grounded = true;
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  setInteriorZones(zones = []) {
    this.interiorZones = zones;
    this.currentZone = null;
  }

  update(dt, input, cameraYaw) {
    const move = input.getMovementInput();
    const speed = move.sprinting ? this.runSpeed : this.walkSpeed;

    let locomotion = 'idle';
    if (move.magnitude > 0.08) {
      // Camera-relative horizontal movement vector
      const sinY = Math.sin(cameraYaw);
      const cosY = Math.cos(cameraYaw);
      const wx = move.x * cosY + move.z * sinY;
      const wz = -move.x * sinY + move.z * cosY;

      this.position.x += wx * speed * dt;
      this.position.z += wz * speed * dt;

      // Smoothly rotate character toward travel direction
      const targetYaw = Math.atan2(wx, wz);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 11);

      locomotion = move.sprinting ? 'run' : 'walk';
    }

    // Horizontal wall collision sliding
    this.collision.resolveHorizontal(this.position);

    // Jump impulse if grounded
    if (input.consumeAction('jump') && this.grounded) {
      this.velocityY = this.jumpSpeed;
      this.grounded = false;
    }

    // Vertical gravity & ground/stair detection
    this.velocityY += this.gravity * dt;
    this.position.y += this.velocityY * dt;

    const groundY = this.collision.getGroundHeight(this.position.x, this.position.z, this.position.y);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocityY = 0;
      this.grounded = true;
    } else if (this.position.y - groundY > 0.12) {
      this.grounded = false;
    }

    // Never fall beneath terrain floor
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }

    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    this.character.update(dt, locomotion);

    // Detect active interior room zone
    let detected = null;
    for (const z of this.interiorZones) {
      const b = z.bounds;
      if (
        this.position.x >= b.minX && this.position.x <= b.maxX &&
        this.position.z >= b.minZ && this.position.z <= b.maxZ &&
        this.position.y >= (z.floorY || 0) - 0.35
      ) {
        detected = z;
        break;
      }
    }
    this.currentZone = detected;
    return { locomotion, currentZone: detected };
  }
}
