/**
 * NULAR Living Archipelago — CharacterController (js/world/CharacterController.js)
 * Loads playable Nusantara Avatar Collection GLBs and drives smooth Three.js AnimationMixer
 * transitions (Idle, Walk, Run, Turn, Interact, Point, Wave, Sit).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyRegionalTextileToAvatar } from './PbrTextureFactory.js';

export class CharacterController {
  constructor(parentGroup) {
    this.parent = parentGroup;
    this.loader = new GLTFLoader();
    this.avatarGroup = new THREE.Group();
    this.avatarGroup.name = 'PLAYER_AVATAR_MOUNT';
    this.parent.add(this.avatarGroup);

    this.currentModel = null;
    this.currentOutfitId = null;
    this.customization = { hairstyle: 'classic', accessory: 'none' };
    this.customAttachmentGroup = new THREE.Group();
    this.customAttachmentGroup.name = 'AVATAR_CUSTOM_ATTACHMENTS';
    this.mixer = null;
    this.actions = new Map();
    this.activeActionName = null;
    this.oneShotTimer = 0;
  }

  setVisible(visible) {
    this.avatarGroup.visible = Boolean(visible);
  }

  setCustomization(custom = {}) {
    this.customization = { ...this.customization, ...custom };
    this._applyCustomAttachments();
  }

  _applyCustomAttachments() {
    while (this.customAttachmentGroup.children.length > 0) {
      const c = this.customAttachmentGroup.children[0];
      this.customAttachmentGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    if (!this.currentModel) return;

    const { hairstyle, accessory } = this.customization;
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1614, roughness: 0.85 });

    if (hairstyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hairMat);
      bun.position.set(0, 1.72, -0.14);
      this.customAttachmentGroup.add(bun);
    } else if (hairstyle === 'long') {
      const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.10), hairMat);
      backHair.position.set(0, 1.48, -0.13);
      this.customAttachmentGroup.add(backHair);
    }

    if (accessory === 'blangkon') {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.18, 0.11, 14),
        new THREE.MeshStandardMaterial({ color: 0x4b2e19, roughness: 0.72 })
      );
      cap.position.set(0, 1.71, 0);
      this.customAttachmentGroup.add(cap);
    } else if (accessory === 'udeng') {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.17, 0.035, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0xb88b42, roughness: 0.65 })
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 1.69, 0);
      this.customAttachmentGroup.add(band);
    } else if (accessory === 'selendang') {
      const sash = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.08, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x9b2c2c, roughness: 0.78 })
      );
      sash.position.set(0, 1.24, 0);
      this.customAttachmentGroup.add(sash);
    }

    if (this.customAttachmentGroup.parent !== this.avatarGroup) {
      this.avatarGroup.add(this.customAttachmentGroup);
    }
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
    applyRegionalTextileToAvatar(this.currentModel, outfitId);
    this.avatarGroup.add(this.currentModel);

    this.mixer = new THREE.AnimationMixer(this.currentModel);
    this.actions.clear();
    for (const clip of gltf.animations || []) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.activeActionName = null;
    this._applyCustomAttachments();
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
