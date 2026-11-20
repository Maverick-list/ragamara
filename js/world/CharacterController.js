/**
 * NULAR Living Archipelago — CharacterController (js/world/CharacterController.js)
 * Loads playable Nusantara Avatar Collection GLBs and drives smooth Three.js AnimationMixer
 * transitions (Idle, Walk, Run, Turn, Interact, Point, Wave, Sit).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class CharacterController {
  constructor(parentGroup) {
    this.parent = parentGroup;
    this.loader = new GLTFLoader();
    this.avatarGroup = new THREE.Group();
    this.avatarGroup.name = 'PLAYER_AVATAR_MOUNT';
    this.parent.add(this.avatarGroup);

    this.currentModel = null;
    this.currentOutfitId = null;
    this.mixer = null;
    this.actions = new Map();
    this.activeActionName = null;
    this.oneShotTimer = 0;
  }

  async loadAvatar(outfitId) {
    const glbUrl = `./assets/models/avatars/${encodeURIComponent(outfitId)}.glb`;
    const gltf = await this.loader.loadAsync(glbUrl);

    // Cleanly dispose previous avatar meshes/materials
    if (this.currentModel) {
      this.avatarGroup.remove(this.currentModel);
      this.currentModel.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
    }

    this.currentModel = gltf.scene;
    this.currentOutfitId = outfitId;
    this.currentModel.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.avatarGroup.add(this.currentModel);

    this.mixer = new THREE.AnimationMixer(this.currentModel);
    this.actions.clear();
    for (const clip of gltf.animations || []) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.activeActionName = null;
    this.playAnimation('Idle');
    return { outfitId, animations: [...this.actions.keys()] };
  }

  playAnimation(name, fadeSec = 0.16) {
    if (!this.actions.has(name) || this.activeActionName === name) return;
    const next = this.actions.get(name);
    const prev = this.activeActionName ? this.actions.get(this.activeActionName) : null;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, fadeSec, false);
    }
    this.activeActionName = name;
  }

  playOneShot(name, durationSec = 0.9) {
    if (!this.actions.has(name)) return;
    this.oneShotTimer = durationSec;
    this.playAnimation(name, 0.12);
  }

  update(dt, locomotionState) {
    if (!this.mixer) return;
    if (this.oneShotTimer > 0) {
      this.oneShotTimer -= dt;
    } else {
      if (locomotionState === 'run') this.playAnimation('Run');
      else if (locomotionState === 'walk') this.playAnimation('Walk');
      else if (locomotionState === 'sit') this.playAnimation('Sit');
      else this.playAnimation('Idle');
    }
    this.mixer.update(dt);
  }
}
