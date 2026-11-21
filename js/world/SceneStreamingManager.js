/**
 * NULAR Living Archipelago — SceneStreamingManager (js/world/SceneStreamingManager.js)
 * Loads individual regional house GLB worlds on demand and guarantees strict GPU disposal
 * of previous geometries, materials, and textures on every scene transition.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { enhanceArchitecturalMaterials } from './PbrTextureFactory.js';

export class SceneStreamingManager {
  constructor(gameScene, collisionManager) {
    this.gameScene = gameScene;
    this.collision = collisionManager;
    this.loader = new GLTFLoader();

    this.activeWorldGroup = new THREE.Group();
    this.activeWorldGroup.name = 'STREAMED_WORLD_CONTAINER';
    this.gameScene.scene.add(this.activeWorldGroup);

    this.activeHouseRoot = null;
    this.activeManifest = null;
    this.roofGroups = [];
    this.roofBaseY = new Map();
    this.roofCutawayActive = false;
  }

  unloadActiveScene() {
    while (this.activeWorldGroup.children.length > 0) {
      const child = this.activeWorldGroup.children[0];
      this.activeWorldGroup.remove(child);
      this.gameScene.disposeObject(child);
    }
    this.activeHouseRoot = null;
    this.activeManifest = null;
    this.roofGroups = [];
    this.roofBaseY.clear();
    this.collision.clear();
  }

  async loadHouseScene(house) {
    this.unloadActiveScene();

    // Load per-house manifest if available, otherwise fall back gracefully
    let manifest = null;
    const manifestUrl = house.worldManifestUrl || `./data/asset-manifests/${house.id}.json`;
    try {
      const res = await fetch(manifestUrl);
      if (res.ok) manifest = await res.json();
    } catch { /* fallback below */ }

    const glbUrl = manifest?.glbUrl || house.worldModel3DUrl || house.model3DUrl || './assets/models/houses/rumah-joglo.glb';
    const gltf = await this.loader.loadAsync(glbUrl.startsWith('./') ? glbUrl : `./${glbUrl}`);

    this.activeHouseRoot = gltf.scene;
    enhanceArchitecturalMaterials(this.activeHouseRoot);
    this.activeManifest = manifest || {
      houseId: house.id,
      spawnPoint: [0, 0.05, 8.5],
      interiorZones: [{ id: 'interior', name: `Ruang Dalam ${house.houseName}`, bounds: { minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5 }, floorY: 0.45 }],
      roofGroupNames: ['ROOF_SYSTEM', 'ROOF_BRUNJUNG', 'ROOF_PENANGGAP']
    };

    const roofSet = new Set(this.activeManifest.roofGroupNames || ['ROOF_SYSTEM', 'ROOF_BRUNJUNG', 'ROOF_PENANGGAP']);
    this.activeHouseRoot.traverse((o) => {
      if (o.isMesh && !o.name?.startsWith('COLLISION')) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (roofSet.has(o.name)) {
        this.roofGroups.push(o);
        this.roofBaseY.set(o, o.position.y);
      }
    });

    this.activeWorldGroup.add(this.activeHouseRoot);
    this.collision.registerFromScene(this.activeHouseRoot);
    return this.activeManifest;
  }

  /**
   * Smoothly elevates or fades roof groups when player enters enclosed interiors or toggles Cutaway (R).
   */
  updateRoofCutaway(dt, shouldLift) {
    this.roofCutawayActive = shouldLift;
    for (const grp of this.roofGroups) {
      const base = this.roofBaseY.get(grp) ?? 0;
      const target = shouldLift ? base + 5.2 : base;
      grp.position.y += (target - grp.position.y) * Math.min(1, dt * 7);
    }
  }
}
