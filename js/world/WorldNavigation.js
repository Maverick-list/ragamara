/**
 * NULAR Living Archipelago — WorldNavigation (js/world/WorldNavigation.js)
 * Builds the 3D Nusantara Entrance Hub Plaza (7 Island Gateways + Central Archipelago Relief Table)
 * when the player is in Hub mode, allowing walk-up portal exploration into any Indonesian region!
 */
import * as THREE from 'three';

const ISLAND_PORTALS = [
  { id: 'Sumatra', label: 'Gerbang Sumatra', sampleHouse: 'rumah-gadang', color: 0x8f4232 },
  { id: 'Java', label: 'Gerbang Jawa', sampleHouse: 'rumah-joglo', color: 0x9c7a4c },
  { id: 'Kalimantan', label: 'Gerbang Kalimantan', sampleHouse: 'rumah-betang', color: 0x3b6e52 },
  { id: 'Sulawesi', label: 'Gerbang Sulawesi', sampleHouse: 'tongkonan-toraja', color: 0x7c3e4c },
  { id: 'Bali & Nusa Tenggara', label: 'Gerbang Bali & Nusra', sampleHouse: 'mbaru-niang', color: 0xb57c3a },
  { id: 'Maluku', label: 'Gerbang Maluku', sampleHouse: 'baileo-maluku', color: 0x3a6b7c },
  { id: 'Papua', label: 'Gerbang Papua', sampleHouse: 'honai-papua', color: 0x5c6e3b }
];

export class WorldNavigation {
  constructor(gameScene, collisionManager, interactionManager) {
    this.gameScene = gameScene;
    this.collision = collisionManager;
    this.interaction = interactionManager;
    this.hubGroup = new THREE.Group();
    this.hubGroup.name = 'NUSANTARA_HUB_PLAZA';
  }

  mountHubPlaza(containerGroup) {
    this.unmountHubPlaza(containerGroup);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x59564f, roughness: 0.88 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xc99c44, roughness: 0.42, metalness: 0.45 });
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x523421, roughness: 0.78 });

    // Central Archipelago Atlas Pedestal
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.75, 16), stoneMat);
    base.position.set(0, 0.375, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    this.hubGroup.add(base);

    const mapPlate = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x1a3329, roughness: 0.6 }));
    mapPlate.position.set(0, 0.81, 0);
    this.hubGroup.add(mapPlate);

    // Stylized bronze archipelago crest on central table
    for (let i = -3; i <= 3; i++) {
      const isl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.24), bronzeMat);
      isl.position.set(i * 0.48, 0.94, Math.sin(i) * 0.35);
      this.hubGroup.add(isl);
    }

    this.collision.addStaticWall(-2.5, 0, -2.5, 2.5, 1.5, 2.5, 'HUB_CENTER_PEDESTAL');
    this.interaction.addInteractable({
      id: 'hub-atlas-pedestal',
      x: 0,
      y: 0.04,
      z: 3.1,
      radius: 2.6,
      label: 'Buka Peta Teleportasi 38 Provinsi',
      kind: 'open-atlas',
      payload: null,
      color: 0xd4a853
    });

    // 7 Regional Island Gateways arranged in a welcoming grand semicircle
    const R = 10.5;
    ISLAND_PORTALS.forEach((p, idx) => {
      const ang = Math.PI + ((idx + 0.5) / ISLAND_PORTALS.length) * Math.PI;
      const gx = Math.cos(ang) * R;
      const gz = Math.sin(ang) * R;

      const gate = new THREE.Group();
      gate.position.set(gx, 0, gz);
      gate.lookAt(0, 0, 0);

      const pMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.65, metalness: 0.15 });
      const leftCol = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.6, 0.45), timberMat);
      leftCol.position.set(-1.3, 1.8, 0);
      leftCol.castShadow = true;
      gate.add(leftCol);

      const rightCol = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.6, 0.45), timberMat);
      rightCol.position.set(1.3, 1.8, 0);
      rightCol.castShadow = true;
      gate.add(rightCol);

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 0.65), pMat);
      lintel.position.set(0, 3.7, 0);
      lintel.castShadow = true;
      gate.add(lintel);

      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.9, 4), bronzeMat);
      crest.position.set(0, 4.4, 0);
      crest.rotation.y = Math.PI / 4;
      gate.add(crest);

      this.hubGroup.add(gate);

      this.interaction.addInteractable({
        id: `portal-${p.id}`,
        x: gx * 0.84,
        y: 0.04,
        z: gz * 0.84,
        radius: 2.8,
        label: `Masuk ${p.label} (38 Provinsi)`,
        kind: 'island-portal',
        payload: p,
        color: p.color
      });
    });

    containerGroup.add(this.hubGroup);
  }

  unmountHubPlaza(containerGroup) {
    if (this.hubGroup.parent === containerGroup) {
      containerGroup.remove(this.hubGroup);
    }
    while (this.hubGroup.children.length > 0) {
      const c = this.hubGroup.children[0];
      this.hubGroup.remove(c);
      this.gameScene.disposeObject(c);
    }
  }
}
