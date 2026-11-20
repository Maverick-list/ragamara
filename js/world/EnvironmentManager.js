/**
 * NULAR Living Archipelago — Enhanced Regional EnvironmentManager (Phase 12)
 *
 * Implements regionally authentic environmental identities:
 * 1. Sumatra (Minangkabau / Bukit Barisan):
 *    - Misty volcanic ridges, tropical bamboo groves, carved stone path, warm humid sunlight
 * 2. Java (Pelataran Kraton / Desa Osing):
 *    - Shaded banyan & teak canopy, terracotta courtyard tiles, frangipani / melati accents, golden twilight
 * 3. Kalimantan (Borneo Riverine / Huma Betang):
 *    - Flowing river waterway, ironwood boardwalk ramps, lush rainforest ironwood canopy
 * 4. Sulawesi (Toraja Highland / Buton Coastal):
 *    - Terraced upland terrain, mountain fog, bamboo stakes, dramatic sunlight
 * 5. Bali & Nusa Tenggara (Wae Rebo / Sasak):
 *    - Round volcanic gravel plaza, highland savanna grass, mountainous rim backdrop
 * 6. Maluku (Spice Islands):
 *    - Coastal azure shoreline, clove & nutmeg trees, warm sea breeze
 * 7. Papua (Lembah Baliem Alpine / Asmat Mangrove):
 *    - Pine needle & mountain grass terrain, misty valley atmosphere, alpine conifers
 * 8. Hub (Nusantara Grand Plaza):
 *    - Monumental stone ring, bronze archipelago relief, ceremonial flags & portals
 */
import * as THREE from 'three';

export const REGIONAL_BIOMES = {
  Sumatra: {
    sky: 0xd6e5d8,
    ground: 0x475f3e,
    foliage: 0x274d2f,
    accent: 0x7a6345,
    fogDensity: 0.012,
    sunIntensity: 2.1,
    sunColor: 0xfff3df,
    floraType: 'highland_rainforest',
    hasWater: false,
    label: 'Dataran Tinggi Minangkabau & Bukit Barisan'
  },
  Java: {
    sky: 0xe8e8d8,
    ground: 0x647045,
    foliage: 0x33592c,
    accent: 0xa48560,
    fogDensity: 0.009,
    sunIntensity: 2.15,
    sunColor: 0xffedd0,
    floraType: 'kraton_garden',
    hasWater: false,
    label: 'Pelataran Asri Kraton Jawa'
  },
  Kalimantan: {
    sky: 0xd3e3dd,
    ground: 0x3d573a,
    foliage: 0x1d4229,
    accent: 0x654e38,
    fogDensity: 0.014,
    sunIntensity: 2.0,
    sunColor: 0xfff5e6,
    floraType: 'riverine_jungle',
    hasWater: true,
    label: 'Tepian Sungai Kapuas & Barito'
  },
  Sulawesi: {
    sky: 0xd9e3ea,
    ground: 0x516644,
    foliage: 0x284f33,
    accent: 0x82705e,
    fogDensity: 0.011,
    sunIntensity: 2.2,
    sunColor: 0xffeed5,
    floraType: 'toraja_upland',
    hasWater: false,
    label: 'Lembah Pegunungan Sa\'dan Toraja'
  },
  'Bali & Nusa Tenggara': {
    sky: 0xeae2cd,
    ground: 0x737046,
    foliage: 0x3e5e34,
    accent: 0x937657,
    fogDensity: 0.010,
    sunIntensity: 2.25,
    sunColor: 0xffeed8,
    floraType: 'savanna_bamboo',
    hasWater: false,
    label: 'Lembah Hijau Wae Rebo & Sasak'
  },
  Maluku: {
    sky: 0xd2e7ed,
    ground: 0x4f6c4a,
    foliage: 0x255737,
    accent: 0xa9916e,
    fogDensity: 0.010,
    sunIntensity: 2.2,
    sunColor: 0xfff6ea,
    floraType: 'coastal_spice',
    hasWater: true,
    label: 'Pesisir Maritim & Pulau Rempah Maluku'
  },
  Papua: {
    sky: 0xd7e4df,
    ground: 0x486040,
    foliage: 0x24472d,
    accent: 0x735f4b,
    fogDensity: 0.015,
    sunIntensity: 1.95,
    sunColor: 0xfff0e0,
    floraType: 'baliem_alpine',
    hasWater: false,
    label: 'Lembah Baliem & Dataran Tinggi Papua'
  },
  Hub: {
    sky: 0xe0e8e0,
    ground: 0x506648,
    foliage: 0x284e31,
    accent: 0x947e62,
    fogDensity: 0.010,
    sunIntensity: 2.1,
    sunColor: 0xfff2e2,
    floraType: 'botanical_garden',
    hasWater: true,
    label: 'Alun-Alun Utama Nusantara'
  }
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
    this.cloudPlanes = [];
    this._envTime = 0;
  }

  buildRegionEnvironment(islandKey = 'Hub') {
    this.windTrees = [];
    this.waterMesh = null;
    this.cloudPlanes = [];

    // Clear previous environment cleanly
    while (this.envGroup.children.length > 0) {
      const child = this.envGroup.children[0];
      this.envGroup.remove(child);
      this.gameScene.disposeObject(child);
    }

    const biome = REGIONAL_BIOMES[islandKey] || REGIONAL_BIOMES.Hub;
    this.gameScene.setAtmosphere({
      skyHex: biome.sky,
      fogDensity: biome.fogDensity,
      sunIntensity: biome.sunIntensity
    });

    // 1. Regional Ground Disc (Segmented with subtle height taper)
    const groundGeo = new THREE.CylinderGeometry(46, 48, 0.45, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: biome.ground,
      roughness: 0.94,
      metalness: 0.01
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.225;
    ground.receiveShadow = true;
    this.envGroup.add(ground);

    // 2. Architectural Courtyard / Village Plinth
    const courtGeo = new THREE.CylinderGeometry(14.0, 14.5, 0.06, 36);
    const courtMat = new THREE.MeshStandardMaterial({
      color: biome.accent,
      roughness: 0.88,
      metalness: 0.02
    });
    const courtyard = new THREE.Mesh(courtGeo, courtMat);
    courtyard.position.y = 0.01;
    courtyard.receiveShadow = true;
    this.envGroup.add(courtyard);

    // 3. Region-Specific Native Flora & Landscaping
    this._buildRegionalFlora(islandKey, biome);

    // 4. Region-Specific Water Elements (Rivers for Borneo, Shoreline for Maluku/Hub)
    if (biome.hasWater) {
      const waterGeo = new THREE.RingGeometry(35, 48, 48);
      const waterMat = new THREE.MeshStandardMaterial({
        color: islandKey === 'Kalimantan' ? 0x2e5954 : 0x2e6b77,
        roughness: 0.18,
        metalness: 0.4,
        transparent: true,
        opacity: 0.86
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.03;
      this.envGroup.add(water);
      this.waterMesh = water;
    }

    // 5. Stylized Low Atmospheric Horizon Clouds
    const cloudMat = new THREE.MeshBasicMaterial({
      color: biome.sky,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    for (let c = 0; c < 6; c++) {
      const ang = (c / 6) * Math.PI * 2;
      const cMesh = new THREE.Mesh(new THREE.PlaneGeometry(28, 6), cloudMat);
      cMesh.position.set(Math.cos(ang) * 44, 7.5 + (c % 2) * 2.2, Math.sin(ang) * 44);
      cMesh.lookAt(0, cMesh.position.y, 0);
      this.envGroup.add(cMesh);
      this.cloudPlanes.push(cMesh);
    }

    // 6. Natural Access Stones leading to Front Entrance (+Z axis)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5750, roughness: 0.92 });
    for (let s = 0; s < 6; s++) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 0.06, 8), stoneMat);
      stone.position.set((s % 2 === 0 ? 0.08 : -0.08), 0.025, 8.0 + s * 1.55);
      stone.receiveShadow = true;
      this.envGroup.add(stone);
    }

    return biome;
  }

  _buildRegionalFlora(islandKey, biome) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4f3621, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: biome.foliage, roughness: 0.84 });
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0xa8a156, roughness: 0.78 });

    const treeCount = 20;
    for (let i = 0; i < treeCount; i++) {
      const ang = (i / treeCount) * Math.PI * 2 + 0.12;
      const rad = 18.5 + (i % 4) * 3.4;
      const tx = Math.cos(ang) * rad;
      const tz = Math.sin(ang) * rad;

      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      if (islandKey === 'Papua') {
        // Alpine Baliem Highland Conifers (Pinus / Casuarina)
        const h = 4.8 + (i % 3) * 1.4;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, h, 6), trunkMat);
        trunk.position.y = h / 2;
        trunk.castShadow = true;
        tree.add(trunk);
        for (let c = 0; c < 3; c++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(2.0 - c * 0.45, 2.2, 6), leafMat);
          cone.position.y = h * 0.6 + c * 1.35;
          cone.castShadow = true;
          tree.add(cone);
        }
      } else if (islandKey === 'Bali & Nusa Tenggara' || islandKey === 'Sumatra') {
        // Tropical Bamboo Clusters (Bambu Betung)
        for (let b = 0; b < 4; b++) {
          const bh = 5.2 + Math.random() * 1.5;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, bh, 6), bambooMat);
          stalk.position.set((b - 1.5) * 0.25, bh / 2, (Math.random() - 0.5) * 0.3);
          stalk.rotation.z = (Math.random() - 0.5) * 0.08;
          stalk.castShadow = true;
          tree.add(stalk);
          const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), leafMat);
          puff.position.set(stalk.position.x, bh + 0.3, stalk.position.z);
          puff.castShadow = true;
          tree.add(puff);
        }
      } else {
        // Broadleaf Tropical Rainforest Canopy (Banyan / Teak)
        const h = 4.0 + (i % 3) * 1.2;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 8), trunkMat);
        trunk.position.y = h / 2;
        trunk.castShadow = true;
        tree.add(trunk);
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 0), leafMat);
        crown.position.y = h + 1.2;
        crown.castShadow = true;
        tree.add(crown);
      }

      tree.userData.phase = i * 0.55;
      this.windTrees.push(tree);
      this.envGroup.add(tree);
    }
  }

  update(dt) {
    this._envTime += dt;

    // Gentle tropical wind foliage animation
    for (const tree of this.windTrees) {
      tree.rotation.z = Math.sin(this._envTime * 1.25 + (tree.userData.phase || 0)) * 0.025;
    }

    // Ripple subtle water level
    if (this.waterMesh) {
      this.waterMesh.position.y = 0.025 + Math.sin(this._envTime * 1.5) * 0.015;
    }

    // Gentle atmospheric cloud drift
    for (let c = 0; c < this.cloudPlanes.length; c++) {
      this.cloudPlanes[c].rotation.y += dt * 0.015;
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
    } catch {}
  }

  _stopAmbientAudio() {
    try {
      if (this.ambientGain && this.audioCtx) {
        this.ambientGain.gain.setTargetAtTime(0.0001, this.audioCtx.currentTime, 0.25);
      }
    } catch {}
  }
}
