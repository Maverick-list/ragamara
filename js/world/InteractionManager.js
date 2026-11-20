/**
 * NULAR Living Archipelago — InteractionManager (js/world/InteractionManager.js)
 * Manages spatial proximity interactables (architectural component pedestals, interior stations,
 * and Island Gateways in the Nusantara Hub Plaza) with subtle glowing museum markers.
 */
import * as THREE from 'three';

export class InteractionManager {
  constructor(scene) {
    this.scene = scene;
    this.markerGroup = new THREE.Group();
    this.markerGroup.name = 'WORLD_INTERACTABLES';
    this.scene.add(this.markerGroup);

    this.interactables = []; // { id, position: Vector3, radius, label, kind, payload, mesh }
    this.nearest = null;
    this._pulseT = 0;
  }

  clear() {
    while (this.markerGroup.children.length > 0) {
      const c = this.markerGroup.children[0];
      this.markerGroup.remove(c);
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.interactables = [];
    this.nearest = null;
  }

  addInteractable({ id, x, y, z, radius = 2.6, label, kind = 'component', payload = null, color = 0xc99c44 }) {
    const marker = new THREE.Group();
    marker.position.set(x, y, z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.44, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    marker.add(ring);

    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.4 })
    );
    diamond.position.y = 0.85;
    diamond.name = 'FLOATING_BEACON';
    marker.add(diamond);

    this.markerGroup.add(marker);
    this.interactables.push({
      id,
      position: new THREE.Vector3(x, y, z),
      radius,
      label,
      kind,
      payload,
      mesh: marker,
      beacon: diamond
    });
  }

  registerHouseInteractables(house, manifest) {
    this.clear();
    const floorY = manifest?.interiorZones?.[0]?.floorY ?? 0.48;
    const hotspots = (house.hotspots || []).slice(0, 6);

    // Place contextual architectural inspection beacons at exterior approach + interior points
    const defaultSpots = [
      [0, floorY, 2.2],
      [-2.4, floorY, 0.2],
      [2.4, floorY, 0.2],
      [0, floorY, -2.2],
      [-2.0, floorY, -2.6],
      [2.0, floorY, -2.6]
    ];

    hotspots.forEach((hs, idx) => {
      const pt = defaultSpots[idx % defaultSpots.length];
      this.addInteractable({
        id: hs.id,
        x: pt[0],
        y: pt[1],
        z: pt[2],
        radius: 2.5,
        label: `Inspeksi: ${hs.title}`,
        kind: 'component',
        payload: hs,
        color: 0xd4a853
      });
    });

    // Always place an entrance Historical Plaque outside the house
    const spawn = manifest?.spawnPoint || [0, 0.05, 8.5];
    this.addInteractable({
      id: `${house.id}-plaque`,
      x: 2.3,
      y: 0.02,
      z: Math.max(4.5, spawn[2] - 1.6),
      radius: 2.8,
      label: `Baca Monografi: ${house.houseName}`,
      kind: 'article',
      payload: house,
      color: 0x6ba88b
    });
  }

  update(dt, playerPos) {
    this._pulseT += dt;
    let closest = null;
    let bestDist = Infinity;

    for (const item of this.interactables) {
      if (item.beacon) {
        item.beacon.rotation.y += dt * 1.4;
        item.beacon.position.y = 0.85 + Math.sin(this._pulseT * 2.4) * 0.09;
      }
      const dist = Math.hypot(playerPos.x - item.position.x, playerPos.z - item.position.z);
      if (dist <= item.radius && dist < bestDist) {
        bestDist = dist;
        closest = item;
      }
    }
    this.nearest = closest;
    return closest;
  }
}
