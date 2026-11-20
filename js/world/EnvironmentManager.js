/**
 * NULAR Living Archipelago — EnvironmentManager (js/world/EnvironmentManager.js)
 * Builds regional Nusantara terrain, stone plazas, documented tropical/highland flora,
 * and optional gentle Web Audio API ambient breeze/chime soundscape.
 */
import * as THREE from 'three';

const REGIONAL_BIOMES = {
  Sumatra: { sky: 0xdce7de, ground: 0x4f6b47, foliage: 0x2f5a38, accent: 0x8d6e4c, label: 'Dataran Tinggi & Bukit Barisan' },
  Java: { sky: 0xe6e8dc, ground: 0x677549, foliage: 0x3b6336, accent: 0xa18868, label: 'Pelataran Teduh Jawa' },
  Kalimantan: { sky: 0xd4e4df, ground: 0x456343, foliage: 0x244d33, accent: 0x735b43, label: 'Tepian Sungai Borneo' },
  Sulawesi: { sky: 0xdbe5ec, ground: 0x56704c, foliage: 0x2e583b, accent: 0x8a7d6d, label: 'Pegunungan & Pesisir Sulawesi' },
  'Bali & Nusa Tenggara': { sky: 0xeae5d5, ground: 0x7a7b4f, foliage: 0x42663a, accent: 0x9c8266, label: 'Lanskap Bali & Nusa Tenggara' },
  Maluku: { sky: 0xd5e8ed, ground: 0x557551, foliage: 0x2b613f, accent: 0xb29e7d, label: 'Kepulauan Rempah Maluku' },
  Papua: { sky: 0xd8e6e2, ground: 0x4d6945, foliage: 0x295234, accent: 0x7c6a56, label: 'Lembah Baliem & Pesisir Papua' },
  Hub: { sky: 0xe2eae2, ground: 0x566f4e, foliage: 0x2d5839, accent: 0x9e8b71, label: 'Alun-Alun Utama Nusantara' }
};

export class EnvironmentManager {
  constructor(gameScene) {
    this.gameScene = gameScene;
    this.envGroup = new THREE.Group();
    this.envGroup.name = 'WORLD_ENVIRONMENT';
    this.gameScene.scene.add(this.envGroup);

    this.audioCtx = null;
    this.ambientGain = null;
    this.audioMuted = true;
    this.windTrees = [];
    this.waterMesh = null;
    this._envTime = 0;
  }

  buildRegionEnvironment(islandKey = 'Hub') {
    this.windTrees = [];
    this.waterMesh = null;
    // Clear previous environment cleanly
    while (this.envGroup.children.length > 0) {
      const child = this.envGroup.children[0];
      this.envGroup.remove(child);
      this.gameScene.disposeObject(child);
    }

    const biome = REGIONAL_BIOMES[islandKey] || REGIONAL_BIOMES.Hub;
    this.gameScene.setAtmosphere({ skyHex: biome.sky, fogDensity: 0.011, sunIntensity: 2.0 });

    // Lush Terrain Ground Disc
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(44, 46, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: biome.ground, roughness: 0.94, metalness: 0.0 })
    );
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.envGroup.add(ground);

    // Architectural Stone Courtyard & Approach Path
    const courtyard = new THREE.Mesh(
      new THREE.CylinderGeometry(12.5, 13.0, 0.04, 36),
      new THREE.MeshStandardMaterial({ color: biome.accent, roughness: 0.9, metalness: 0.02 })
    );
    courtyard.position.y = 0.005;
    courtyard.receiveShadow = true;
    this.envGroup.add(courtyard);

    // Perimeter Ring of Stylized Regional Trees (Coconut Palms, Banyan, Highland Pines/Bamboo)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x59402b, roughness: 0.88 });
    const leafMat = new THREE.MeshStandardMaterial({ color: biome.foliage, roughness: 0.85 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6f6c65, roughness: 0.92 });

    const treeCount = 18;
    for (let i = 0; i < treeCount; i++) {
      const ang = (i / treeCount) * Math.PI * 2 + 0.15;
      const rad = 17.5 + (i % 3) * 3.8;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;

      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      const h = 3.6 + (i % 4) * 1.1;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, h, 7), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const canopy = new THREE.Mesh(
        islandKey === 'Papua' || islandKey === 'Sumatra'
          ? new THREE.ConeGeometry(1.8, 3.4, 7)
          : new THREE.DodecahedronGeometry(1.75, 0),
        leafMat
      );
      canopy.position.y = h + 0.9;
      canopy.castShadow = true;
      tree.add(canopy);
      tree.userData.phase = i * 0.65;
      this.windTrees.push(tree);

      this.envGroup.add(tree);
    }

    // Regional coastal/river water band for riverine & maritime regions
    if (['Kalimantan', 'Maluku', 'Sulawesi', 'Hub'].includes(islandKey)) {
      const water = new THREE.Mesh(
        new THREE.RingGeometry(36, 46, 48),
        new THREE.MeshStandardMaterial({ color: 0x3b7a82, roughness: 0.22, metalness: 0.35, transparent: true, opacity: 0.88 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.02;
      this.envGroup.add(water);
      this.waterMesh = water;
    }

    // Subtle stepping stones along +Z entrance axis
    for (let s = 0; s < 5; s++) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.06, 8), stoneMat);
      stone.position.set(0, 0.02, 7.5 + s * 1.65);
      stone.receiveShadow = true;
      this.envGroup.add(stone);
    }

    return biome;
  }

  update(dt) {
    this._envTime += dt;
    for (const tree of this.windTrees) {
      tree.rotation.z = Math.sin(this._envTime * 1.15 + (tree.userData.phase || 0)) * 0.022;
    }
    if (this.waterMesh) {
      this.waterMesh.position.y = 0.015 + Math.sin(this._envTime * 1.4) * 0.015;
    }
  }

  toggleAudio() {
    if (this.audioMuted) {
      this._startAmbientAudio();
      this.audioMuted = false;
    } else {
      this._stopAmbientAudio();
      this.audioMuted = true;
    }
    return !this.audioMuted;
  }

  _startAmbientAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) {
        this.audioCtx = new Ctx();
        // Gentle tropical wind filtered pink noise + soft pentatonic pelog drone
        const bufferSize = this.audioCtx.sampleRate * 2;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.950 * b2 + white * 0.048;
          data[i] = (b0 + b1 + b2) * 0.18;
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 340;

        this.ambientGain = this.audioCtx.createGain();
        this.ambientGain.gain.value = 0.06;

        noise.connect(filter);
        filter.connect(this.ambientGain);
        this.ambientGain.connect(this.audioCtx.destination);
        noise.start();
      }
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0.06, this.audioCtx.currentTime, 0.25);
    } catch {
      // Audio blocked by browser autoplay policy
    }
  }

  _stopAmbientAudio() {
    if (this.ambientGain && this.audioCtx) {
      this.ambientGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 0.2);
    }
  }

  dispose() {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
    }
  }
}
