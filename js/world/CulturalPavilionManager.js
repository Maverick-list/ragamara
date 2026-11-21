/**
 * NULAR Living World — CulturalPavilionManager (js/world/CulturalPavilionManager.js)
 * Builds intentional, museum-designed regional cultural exhibition pavilions
 * (Architecture, Textiles & Batik, Culinary, Music, Crafts, Maritime Heritage)
 * showcasing discoverable & collectible CulturalItems from data/cultural-items.json.
 */
import * as THREE from 'three';
import { getArchTextureSet, getRegionalTextileTexture } from './PbrTextureFactory.js';

const PAVILION_SPECS = [
  { id: 'pav-textile', title: 'Paviliun Wastra & Batik', category: 'clothing', pos: [-11.5, 0, -4.5], accent: 0x9c7a4c },
  { id: 'pav-culinary', title: 'Paviliun Kuliner Nusantara', category: 'food', pos: [11.5, 0, -4.5], accent: 0xa54b34 },
  { id: 'pav-music', title: 'Paviliun Musik & Pertunjukan', category: 'music', pos: [-11.5, 0, 5.5], accent: 0x3b6e52 },
  { id: 'pav-craft', title: 'Paviliun Kriya & Pusaka', category: 'weapon', pos: [11.5, 0, 5.5], accent: 0x6b4428 }
];

export class CulturalPavilionManager {
  constructor(gameScene, interactionManager) {
    this.gameScene = gameScene;
    this.interaction = interactionManager;
    this.group = new THREE.Group();
    this.group.name = 'CULTURAL_EXHIBITION_PAVILIONS';
    this.gameScene.scene.add(this.group);

    this.culturalItems = [];
    this.animatedDisplays = [];
    this._t = 0;
  }

  async loadCatalog() {
    if (this.culturalItems.length) return this.culturalItems;
    try {
      const res = await fetch('./data/cultural-items.json');
      if (res.ok) {
        const json = await res.json();
        this.culturalItems = json.items || [];
      }
    } catch {}
    return this.culturalItems;
  }

  clear() {
    this.animatedDisplays = [];
    while (this.group.children.length > 0) {
      const c = this.group.children[0];
      this.group.remove(c);
      this.gameScene.disposeObject(c);
    }
  }

  async mountPavilions(mode = 'hub', islandKey = 'Hub') {
    this.clear();
    await this.loadCatalog();

    const woodTex = getArchTextureSet('wood_teak');
    const stoneTex = getArchTextureSet('stone_andesite');
    const tileTex = getArchTextureSet('terracotta_tiles');

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4428, map: woodTex.map, bumpMap: woodTex.map, bumpScale: 0.03, roughness: 0.76 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6c6a64, map: stoneTex.map, bumpMap: stoneTex.map, bumpScale: 0.04, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8e3f2a, map: tileTex.map, bumpMap: tileTex.map, bumpScale: 0.05, roughness: 0.82 });

    // In Hub mode show all 4 thematic pavilions; in a house region show 2 contextual regional pavilions
    const specs = mode === 'hub' ? PAVILION_SPECS : PAVILION_SPECS.slice(0, 2).map((p, idx) => ({
      ...p,
      pos: idx === 0 ? [-10.8, 0, 6.2] : [10.8, 0, 6.2]
    }));

    specs.forEach((spec, idx) => {
      const pav = new THREE.Group();
      pav.name = spec.id.toUpperCase();
      pav.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);

      // Stepped stone platform
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 4.2), stoneMat);
      base.position.y = 0.11;
      base.receiveShadow = true;
      pav.add(base);

      // 4 Carved corner pillars
      for (const px of [-1.75, 1.75]) {
        for (const pz of [-1.75, 1.75]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.75, 8), woodMat);
          post.position.set(px, 1.58, pz);
          post.castShadow = true;
          pav.add(post);
        }
      }

      // Traditional pyramidal Joglo-inspired exhibition canopy
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.35, 4), roofMat);
      canopy.rotation.y = Math.PI / 4;
      canopy.position.y = 3.58;
      canopy.castShadow = true;
      pav.add(canopy);

      // Central Museum Vitrine Pedestal
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.92, 12), stoneMat);
      pedestal.position.y = 0.68;
      pedestal.castShadow = true;
      pav.add(pedestal);

      // Pick a verified cultural exhibit for this pavilion
      const item = this._pickExhibit(spec.category, islandKey, idx);
      const displayMesh = this._createDisplayArtifact(spec.category, spec.accent, item);
      displayMesh.position.y = 1.48;
      pav.add(displayMesh);
      this.animatedDisplays.push(displayMesh);

      this.group.add(pav);

      if (item) {
        this.interaction.addInteractable({
          id: `exhibit-${item.id}`,
          x: spec.pos[0],
          y: 0.22,
          z: spec.pos[2] + 2.1,
          radius: 3.1,
          label: `${spec.title}: ${item.name}`,
          kind: 'exhibit',
          payload: { ...item, pavilionTitle: spec.title },
          color: spec.accent
        });
      }
    });
  }

  _pickExhibit(category, islandKey, fallbackIdx) {
    if (!this.culturalItems.length) return null;
    const byCat = this.culturalItems.filter((it) => it.category === category || (category === 'weapon' && (it.category === 'weapon' || it.category === 'craft')));
    const regional = byCat.find((it) => String(it.province || it.regionId || '').toLowerCase().includes(String(islandKey).toLowerCase()));
    return regional || byCat[fallbackIdx % Math.max(1, byCat.length)] || this.culturalItems[fallbackIdx % this.culturalItems.length];
  }

  _createDisplayArtifact(category, accentHex, item) {
    const grp = new THREE.Group();
    if (category === 'clothing') {
      const tex = getRegionalTextileTexture(item?.slug || 'batik-parang-solo');
      const cloth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 0.78, 16, 1, true),
        new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.75 })
      );
      grp.add(cloth);
    } else if (category === 'music') {
      // Stylized bronze Gong / Gamelan kettles
      const bronze = new THREE.MeshStandardMaterial({ color: 0xc99c44, roughness: 0.35, metalness: 0.65 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 20), bronze);
      disc.rotation.x = Math.PI / 2;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), bronze);
      boss.position.z = 0.08;
      grp.add(disc, boss);
    } else if (category === 'food') {
      // Ceremonial woven tumpeng / copper serving tray
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.08, 18), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 }));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.48, 16), new THREE.MeshStandardMaterial({ color: 0xd9a13b, roughness: 0.65 }));
      cone.position.y = 0.28;
      grp.add(tray, cone);
    } else {
      // Stylized historical pusaka / craft display stand
      const gold = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.4, metalness: 0.5 });
      const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), gold);
      blade.scale.set(0.35, 1.45, 0.2);
      grp.add(blade);
    }
    return grp;
  }

  update(dt) {
    this._t += dt;
    for (const d of this.animatedDisplays) {
      d.rotation.y += dt * 0.75;
      d.position.y = 1.48 + Math.sin(this._t * 2.0) * 0.05;
    }
  }
}
