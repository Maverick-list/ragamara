/**
 * NULAR Living Archipelago — CollisionManager (js/world/CollisionManager.js)
 * Extracts walkable floor, stair, and solid wall AABB colliders from GLB COLLISION_* nodes.
 * Provides smooth capsule-vs-AABB horizontal wall sliding and automatic stair/floor step-up
 * so playable characters NEVER fall through floors or pass through structural walls.
 */
import * as THREE from 'three';

export class CollisionManager {
  constructor() {
    this.floors = []; // { box: THREE.Box3, name, isStair }
    this.walls = [];  // { box: THREE.Box3, name }
    this.worldBounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
  }

  clear() {
    this.floors = [];
    this.walls = [];
  }

  registerFromScene(root) {
    this.clear();
    if (!root) return;
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      if ((!obj.isMesh && !obj.isLineSegments) || !obj.name) return;
      const up = obj.name.toUpperCase();
      if (!up.startsWith('COLLISION_')) return;
      obj.visible = false; // Hide collision geometry visually
      const box = new THREE.Box3().setFromObject(obj);
      if (up.includes('FLOOR') || up.includes('STAIR') || up.includes('PLINTH') || up.includes('DECK')) {
        this.floors.push({ box, name: obj.name, isStair: up.includes('STAIR') });
      } else {
        this.walls.push({ box, name: obj.name });
      }
    });
  }

  addStaticWall(minX, minY, minZ, maxX, maxY, maxZ, name = 'STATIC_WALL') {
    this.walls.push({
      name,
      box: new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ))
    });
  }

  /**
   * Computes highest supported floor/stair surface beneath (x, z) reachable within maxStepUp from currentY.
   */
  getGroundHeight(x, z, currentY, radius = 0.28, maxStepUp = 0.55) {
    let groundY = 0; // Base terrain level y = 0
    for (const fl of this.floors) {
      const b = fl.box;
      if (
        x + radius >= b.min.x && x - radius <= b.max.x &&
        z + radius >= b.min.z && z - radius <= b.max.z
      ) {
        if (b.max.y <= currentY + maxStepUp && b.max.y > groundY) {
          groundY = b.max.y;
        }
      }
    }
    return groundY;
  }

  /**
   * Resolves horizontal capsule circle (x, z, radius) against all walls overlapping character vertical span.
   */
  resolveHorizontal(pos, radius = 0.34, height = 1.65) {
    const footY = pos.y + 0.15;
    const headY = pos.y + height;

    // Clamp to outer world sanctuary bounds
    pos.x = Math.max(this.worldBounds.minX, Math.min(this.worldBounds.maxX, pos.x));
    pos.z = Math.max(this.worldBounds.minZ, Math.min(this.worldBounds.maxZ, pos.z));

    for (let iter = 0; iter < 2; iter++) {
      for (const w of this.walls) {
        const b = w.box;
        if (headY <= b.min.y || footY >= b.max.y) continue;

        const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const push = radius - dist;
            pos.x += (dx / dist) * push;
            pos.z += (dz / dist) * push;
          } else {
            // Inside box fallback: push out along nearest face
            const penLeft = Math.abs(pos.x - b.min.x);
            const penRight = Math.abs(b.max.x - pos.x);
            const penBack = Math.abs(pos.z - b.min.z);
            const penFront = Math.abs(b.max.z - pos.z);
            const m = Math.min(penLeft, penRight, penBack, penFront);
            if (m === penLeft) pos.x = b.min.x - radius;
            else if (m === penRight) pos.x = b.max.x + radius;
            else if (m === penBack) pos.z = b.min.z - radius;
            else pos.z = b.max.z + radius;
          }
        }
      }
    }
    return pos;
  }
}
