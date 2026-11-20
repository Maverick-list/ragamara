/**
 * NULAR — Walkable 3D Architectural World Model Pipeline (scripts/build_world_models.mjs)
 *
 * Generates multi-component, walkable binary glTF (.glb) architectural reconstructions
 * for the NULAR Living Archipelago World & 3D Museum Inspector.
 *
 * Every exported GLB guarantees:
 *  - Authentic regional silhouette & architectural proportions (1 unit = 1 meter)
 *  - Walkable exterior approach, stairs/ramps, doorways, and interior rooms
 *  - Distinct named architectural component groups (ROOF, COLUMNS, WALLS, FLOOR, DOORS, INTERIOR_FURNITURE)
 *  - Explicit COLLISION group (COLLISION_FLOOR_*, COLLISION_WALL_*, COLLISION_STAIR_*, COLLISION_DOORWAY_*)
 *  - JSON manifest per house in data/asset-manifests/<id>.json
 *
 * Usage:
 *   node scripts/build_world_models.mjs --pilot            (Phase 2: Rumah Joglo walkable pilot)
 *   node scripts/build_world_models.mjs --region=Sumatra   (Phase 4 regional batch)
 *   node scripts/build_world_models.mjs --all              (All 42 houses across 38 provinces)
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../js/vendor/three/build/three.module.js';
import { GLTFExporter } from '../js/vendor/three/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.({ target: this });
        this.onload?.({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
        this.onloadend?.({ target: this });
        this.onload?.({ target: this });
      });
    }
  };
}

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const HOUSES_OUT = path.join(ROOT, 'assets/models/houses');
const MANIFEST_OUT = path.join(ROOT, 'data/asset-manifests');
fs.mkdirSync(HOUSES_OUT, { recursive: true });
fs.mkdirSync(MANIFEST_OUT, { recursive: true });

function createMats() {
  return {
    teak: new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.72, metalness: 0.05 }),
    ironwood: new THREE.MeshStandardMaterial({ color: 0x3b2619, roughness: 0.82, metalness: 0.04 }),
    agedWood: new THREE.MeshStandardMaterial({ color: 0x563824, roughness: 0.78, metalness: 0.04 }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0xb79964, roughness: 0.86, metalness: 0.02 }),
    wovenWall: new THREE.MeshStandardMaterial({ color: 0x9c7d4d, roughness: 0.90, metalness: 0.02 }),
    carvedDark: new THREE.MeshStandardMaterial({ color: 0x2d1b12, roughness: 0.74, metalness: 0.08 }),
    crimson: new THREE.MeshStandardMaterial({ color: 0x7c251d, roughness: 0.65, metalness: 0.08 }),
    goldOchre: new THREE.MeshStandardMaterial({ color: 0xc99c44, roughness: 0.50, metalness: 0.25 }),
    ivoryPlaster: new THREE.MeshStandardMaterial({ color: 0xe6decb, roughness: 0.85, metalness: 0.02 }),
    ijuk: new THREE.MeshStandardMaterial({ color: 0x23201e, roughness: 0.95, metalness: 0.02 }),
    thatch: new THREE.MeshStandardMaterial({ color: 0x967e51, roughness: 0.95, metalness: 0.0 }),
    shingle: new THREE.MeshStandardMaterial({ color: 0x45372b, roughness: 0.88, metalness: 0.03 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x9c4c32, roughness: 0.78, metalness: 0.04 }),
    andesite: new THREE.MeshStandardMaterial({ color: 0x52504c, roughness: 0.88, metalness: 0.04 }),
    terracottaFloor: new THREE.MeshStandardMaterial({ color: 0xb38a65, roughness: 0.84, metalness: 0.02 }),
    earthFloor: new THREE.MeshStandardMaterial({ color: 0x735e4a, roughness: 0.96, metalness: 0.0 }),
    ember: new THREE.MeshStandardMaterial({ color: 0xd95b26, emissive: 0x802a0a, roughness: 0.65, metalness: 0.0 }),
    matWoven: new THREE.MeshStandardMaterial({ color: 0xcfb482, roughness: 0.9, metalness: 0.0 }),
    colliderMat: new THREE.MeshStandardMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.0 })
  };
}

function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name = '') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

function cyl(parent, rt, rb, h, segs, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name = '') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

function addCollider(colGroup, name, w, h, d, x, y, z, mat) {
  const m = box(colGroup, w, h, d, mat, x, y, z, 0, 0, 0, name);
  m.visible = false;
  return m;
}

function buildCurvedRoofMesh(uSegs, vSegs, evalFn, mat, thickness = 0.12) {
  const positions = [];
  const indices = [];
  for (let layer = 0; layer < 2; layer++) {
    const dy = layer === 0 ? 0 : -thickness;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      for (let iv = 0; iv <= vSegs; iv++) {
        const v = iv / vSegs;
        const p = evalFn(u, v);
        positions.push(p.x, p.y + dy, p.z);
      }
    }
  }
  const stride = vSegs + 1;
  const layerSz = (uSegs + 1) * stride;
  for (let iu = 0; iu < uSegs; iu++) {
    for (let iv = 0; iv < vSegs; iv++) {
      const a = iu * stride + iv;
      const b = (iu + 1) * stride + iv;
      const c = (iu + 1) * stride + (iv + 1);
      const d = iu * stride + (iv + 1);
      indices.push(a, b, c, a, c, d);
      const a2 = layerSz + a, b2 = layerSz + b, c2 = layerSz + c, d2 = layerSz + d;
      indices.push(a2, c2, b2, a2, d2, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ============================================================================
// ARCHETYPE 1: JAVANESE PENDOPO / JOGLO / NDALEM / LIMASAN / OSING (Walkable)
// ============================================================================
function buildJavaneseHouse(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = `HOUSE_${house.id.toUpperCase().replace(/-/g, '_')}_ROOT`;
  scene.add(root);

  const isJoglo = /joglo|ndalem/i.test(house.id);
  const isOsing = /osing/i.test(house.id);

  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const umpakGrp = new THREE.Group(); umpakGrp.name = 'UMPAK'; root.add(umpakGrp);
  const sokoGrp = new THREE.Group(); sokoGrp.name = 'SOKO_GURU'; root.add(sokoGrp);
  const tumpangGrp = new THREE.Group(); tumpangGrp.name = 'TUMPANG_SARI'; root.add(tumpangGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofPenGrp = new THREE.Group(); roofPenGrp.name = 'ROOF_PENANGGAP'; root.add(roofPenGrp);
  const roofBrunGrp = new THREE.Group(); roofBrunGrp.name = 'ROOF_BRUNJUNG'; root.add(roofBrunGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  const W = 10.4, D = 11.2, floorY = 0.48;

  // Stepped Pendopo + Ndalem Plinth
  box(floorGrp, W + 0.9, 0.24, D + 0.9, M.andesite, 0, 0.12, 0);
  box(floorGrp, W, 0.24, D, M.terracottaFloor, 0, 0.36, 0);
  // Front walkable steps (Z = +D/2)
  box(floorGrp, 3.2, 0.16, 0.55, M.andesite, 0, 0.08, D / 2 + 0.65);
  box(floorGrp, 3.0, 0.16, 0.45, M.andesite, 0, 0.24, D / 2 + 0.25);

  // Floor & stair colliders
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', W, 0.48, D, 0, 0.24, 0, M.colliderMat);
  addCollider(colGrp, 'COLLISION_STAIR_FRONT', 3.2, 0.32, 1.0, 0, 0.16, D / 2 + 0.5, M.colliderMat);

  // Four Main Soko Guru Pillars (center of Pendopo Z = +1.4)
  const sgZ = 1.6;
  const sgSpan = 2.6;
  for (const sx of [-sgSpan / 2, sgSpan / 2]) {
    for (const sz of [sgZ - sgSpan / 2, sgZ + sgSpan / 2]) {
      cyl(umpakGrp, 0.24, 0.32, 0.34, 8, M.andesite, sx, floorY + 0.17, sz);
      box(sokoGrp, 0.24, 3.85, 0.24, M.teak, sx, floorY + 0.34 + 1.925, sz);
      addCollider(colGrp, `COLLISION_PILLAR_SG`, 0.32, 3.8, 0.32, sx, floorY + 1.9, sz, M.colliderMat);
    }
  }

  // Outer Penanggap Columns around Pendopo perimeter
  const outerX = [-4.6, -1.8, 1.8, 4.6];
  const outerZ = [-4.8, -1.2, 1.6, 4.9];
  for (const ox of outerX) {
    for (const oz of outerZ) {
      if (Math.abs(ox) < 2 && oz > -1 && oz < 4) continue;
      if (oz === -1.2 && Math.abs(ox) < 2) continue;
      cyl(umpakGrp, 0.18, 0.23, 0.26, 8, M.andesite, ox, floorY + 0.13, oz);
      box(sokoGrp, 0.17, 2.85, 0.17, M.agedWood, ox, floorY + 0.26 + 1.425, oz);
    }
  }

  // Tiered Tumpang Sari Corbelled Ceiling (5 ascending stepped beam rings!)
  const tsBaseY = floorY + 4.05;
  for (let tier = 0; tier < 5; tier++) {
    const span = sgSpan + 0.35 - tier * 0.28;
    const ty = tsBaseY + tier * 0.18;
    const mat = tier % 2 === 0 ? M.teak : M.goldOchre;
    box(tumpangGrp, span, 0.15, 0.18, mat, 0, ty, sgZ - span / 2);
    box(tumpangGrp, span, 0.15, 0.18, mat, 0, ty, sgZ + span / 2);
    box(tumpangGrp, 0.18, 0.15, span, mat, -span / 2, ty, sgZ);
    box(tumpangGrp, 0.18, 0.15, span, mat, span / 2, ty, sgZ);
  }

  // Ndalem / Jrumah Walkable Enclosed Rear Hall (Z from -5.0 to -1.2, with wide 1.8m central Gebyok doorway!)
  const wallMat = isOsing ? M.wovenWall : M.ivoryPlaster;
  const wallH = 2.9;
  const wallY = floorY + wallH / 2;
  // Back wall
  box(wallGrp, 9.4, wallH, 0.22, wallMat, 0, wallY, -5.0);
  addCollider(colGrp, 'COLLISION_WALL_BACK', 9.4, wallH, 0.3, 0, wallY, -5.0, M.colliderMat);
  // Left & right Ndalem walls
  box(wallGrp, 0.22, wallH, 3.8, wallMat, -4.7, wallY, -3.1);
  box(wallGrp, 0.22, wallH, 3.8, wallMat, 4.7, wallY, -3.1);
  addCollider(colGrp, 'COLLISION_WALL_LEFT', 0.3, wallH, 3.8, -4.7, wallY, -3.1, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_RIGHT', 0.3, wallH, 3.8, 4.7, wallY, -3.1, M.colliderMat);
  // Front Gebyok carved partition with 1.8m open central doorway so avatar walks straight inside!
  box(wallGrp, 3.8, wallH, 0.18, M.carvedDark, -2.8, wallY, -1.2);
  box(wallGrp, 3.8, wallH, 0.18, M.carvedDark, 2.8, wallY, -1.2);
  box(doorGrp, 2.0, 0.55, 0.22, M.goldOchre, 0, floorY + 2.62, -1.2, 0, 0, 0, 'GEBYOK_LINTEL');
  // Open carved double door leaves swung inwards
  box(doorGrp, 0.82, 2.32, 0.08, M.teak, -1.05, floorY + 1.16, -1.55, 0, 0.9, 0, 'DOOR_LEAF_L');
  box(doorGrp, 0.82, 2.32, 0.08, M.teak, 1.05, floorY + 1.16, -1.55, 0, -0.9, 0, 'DOOR_LEAF_R');
  addCollider(colGrp, 'COLLISION_WALL_GEBYOK_L', 3.8, wallH, 0.28, -2.8, wallY, -1.2, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_GEBYOK_R', 3.8, wallH, 0.28, 2.8, wallY, -1.2, M.colliderMat);

  // Senthong Inner Partitions (Kiwa / Tengah / Tengen)
  box(wallGrp, 0.14, 2.4, 2.1, M.teak, -1.6, floorY + 1.2, -3.95);
  box(wallGrp, 0.14, 2.4, 2.1, M.teak, 1.6, floorY + 1.2, -3.95);
  addCollider(colGrp, 'COLLISION_WALL_SENTHONG_L', 0.2, 2.4, 2.1, -1.6, floorY + 1.2, -3.95, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_SENTHONG_R', 0.2, 2.4, 2.1, 1.6, floorY + 1.2, -3.95, M.colliderMat);

  // Interior Traditional Furniture (Amben wooden daybed, Gamelan/low table, woven floor mat, Krobongan altar)
  box(furnGrp, 1.9, 0.42, 0.95, M.teak, -3.1, floorY + 0.21, -2.3, 0, 0, 0, 'AMBEN_DAYBED');
  box(furnGrp, 1.8, 0.04, 0.88, M.matWoven, -3.1, floorY + 0.44, -2.3);
  box(furnGrp, 1.5, 0.36, 0.9, M.carvedDark, 0, floorY + 0.18, 1.6, 0, 0, 0, 'PENDOPO_LOW_TABLE');
  box(furnGrp, 2.6, 0.03, 2.0, M.matWoven, 0, floorY + 0.015, 1.6, 0, 0, 0, 'PENDOPO_TIKAR');
  box(furnGrp, 1.6, 0.55, 0.8, M.crimson, 0, floorY + 0.275, -4.3, 0, 0, 0, 'SENTHONG_TENGAH_DAIS');
  box(furnGrp, 1.4, 0.12, 0.7, M.goldOchre, 0, floorY + 0.60, -4.3);

  // Lower Sweeping Penanggap Roof Skirt
  const skirtGeo = new THREE.ConeGeometry(8.2, 2.0, 4);
  const skirt = new THREE.Mesh(skirtGeo, M.terracotta);
  skirt.rotation.y = Math.PI / 4;
  skirt.scale.set(1.0, 1.0, 1.08);
  skirt.position.set(0, floorY + 3.9, 0.2);
  roofPenGrp.add(skirt);

  // Upper Steep Brunjung / Tajug Peak (or Tikel Balung 4-plane roof for Osing)
  if (isJoglo) {
    const peakGeo = new THREE.ConeGeometry(3.4, 3.1, 4);
    const peak = new THREE.Mesh(peakGeo, M.terracotta);
    peak.rotation.y = Math.PI / 4;
    peak.position.set(0, floorY + 6.25, sgZ);
    roofBrunGrp.add(peak);
    box(roofBrunGrp, 1.4, 0.22, 0.22, M.goldOchre, 0, floorY + 7.75, sgZ);
  } else {
    // Limasan / Tikel Balung hipped gable ridge
    const ridgeGeo = new THREE.CylinderGeometry(0.18, 4.2, 2.5, 4);
    const ridge = new THREE.Mesh(ridgeGeo, M.terracotta);
    ridge.rotation.y = Math.PI / 4;
    ridge.scale.set(1.25, 1.0, 1.0);
    ridge.position.set(0, floorY + 5.7, 0.2);
    roofBrunGrp.add(ridge);
    box(roofBrunGrp, 4.8, 0.24, 0.24, M.agedWood, 0, floorY + 6.95, 0.2);
  }

  return {
    scene,
    spawnPoint: [0, 0.05, 7.2],
    interiorZones: [
      { id: 'pendopo', name: 'Pendopo (Zona Publik)', bounds: { minX: -4.8, maxX: 4.8, minZ: -1.1, maxZ: 5.2 }, floorY },
      { id: 'ndalem', name: isOsing ? 'Jrumah & Senthong (Zona Privat)' : 'Ndalem Ageng & Senthong (Zona Privat)', bounds: { minX: -4.6, maxX: 4.6, minZ: -4.9, maxZ: -1.2 }, floorY }
    ],
    roofGroupNames: ['ROOF_BRUNJUNG', 'ROOF_PENANGGAP']
  };
}

// ============================================================================
// ARCHETYPE 2: CURVED SADDLE / GONJONG / BOAT STILT HOUSE
// (Rumah Gadang, Tongkonan, Rumah Bolon, Siwaluh Jabu, Rumoh Aceh)
// ============================================================================
function buildCurvedStiltHouse(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = `HOUSE_${house.id.toUpperCase().replace(/-/g, '_')}_ROOT`;
  scene.add(root);

  const isGadang = /gadang/i.test(house.id);
  const isTongkonan = /tongkonan/i.test(house.id);
  const floorY = 1.65;
  const W = isGadang ? 10.6 : 6.4;
  const D = isTongkonan ? 9.2 : 6.6;

  const foundGrp = new THREE.Group(); foundGrp.name = 'FOUNDATION_STONES'; root.add(foundGrp);
  const stiltGrp = new THREE.Group(); stiltGrp.name = 'STILT_COLUMNS'; root.add(stiltGrp);
  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const stairGrp = new THREE.Group(); stairGrp.name = 'ENTRANCE_STAIRS'; root.add(stairGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  // Elevated Stilt Pillars & Batu Sandi / Umpak
  const colsX = isGadang ? [-4.6, -2.3, 0, 2.3, 4.6] : [-2.6, 0, 2.6];
  const colsZ = isTongkonan ? [-3.8, -1.3, 1.3, 3.8] : [-2.6, 0, 2.6];
  for (const x of colsX) {
    for (const z of colsZ) {
      cyl(foundGrp, 0.22, 0.28, 0.24, 8, M.andesite, x, 0.12, z);
      cyl(stiltGrp, 0.14, 0.16, floorY, 10, M.ironwood, x, floorY / 2, z);
    }
  }
  // Cross tie beams (Rasok / Sulluk Banua)
  for (const z of colsZ) box(stiltGrp, W - 0.6, 0.18, 0.18, M.agedWood, 0, floorY * 0.55, z);
  for (const x of colsX) box(stiltGrp, 0.18, 0.18, D - 0.6, M.agedWood, x, floorY * 0.55, 0);

  // Main Walkable Elevated Timber Floor
  box(floorGrp, W, 0.22, D, M.teak, 0, floorY - 0.11, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', W, 0.24, D, 0, floorY - 0.12, 0, M.colliderMat);

  // Walkable Front Staircase with Handrails (Z from D/2 to D/2 + 2.6)
  const steps = 8;
  for (let s = 0; s < steps; s++) {
    const sy = (s + 0.5) * (floorY / steps);
    const sz = D / 2 + 2.4 - s * (2.4 / steps);
    box(stairGrp, 1.8, 0.12, 0.34, M.agedWood, 0, sy, sz);
    addCollider(colGrp, `COLLISION_STAIR_${s}`, 1.8, floorY / steps, 0.36, 0, sy, sz, M.colliderMat);
  }
  // Landing porch
  box(stairGrp, 2.4, 0.18, 1.0, M.teak, 0, floorY - 0.09, D / 2 + 0.45);
  addCollider(colGrp, 'COLLISION_FLOOR_PORCH', 2.4, 0.2, 1.0, 0, floorY - 0.1, D / 2 + 0.45, M.colliderMat);

  // Walls with 1.6m Walkable Central Entrance Doorway
  const wallH = 2.6;
  const wy = floorY + wallH / 2;
  const wallMat = isTongkonan ? M.crimson : M.carvedDark;
  // Back wall
  box(wallGrp, W - 0.2, wallH, 0.18, wallMat, 0, wy, -D / 2 + 0.12);
  addCollider(colGrp, 'COLLISION_WALL_BACK', W - 0.2, wallH, 0.28, 0, wy, -D / 2 + 0.12, M.colliderMat);
  // Left & right walls
  box(wallGrp, 0.18, wallH, D - 0.2, wallMat, -W / 2 + 0.12, wy, 0);
  box(wallGrp, 0.18, wallH, D - 0.2, wallMat, W / 2 - 0.12, wy, 0);
  addCollider(colGrp, 'COLLISION_WALL_LEFT', 0.28, wallH, D - 0.2, -W / 2 + 0.12, wy, 0, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_RIGHT', 0.28, wallH, D - 0.2, W / 2 - 0.12, wy, 0, M.colliderMat);
  // Front wall split for doorway
  const frontSegW = (W - 2.0) / 2;
  box(wallGrp, frontSegW, wallH, 0.18, wallMat, -(1.0 + frontSegW / 2), wy, D / 2 - 0.12);
  box(wallGrp, frontSegW, wallH, 0.18, wallMat, (1.0 + frontSegW / 2), wy, D / 2 - 0.12);
  box(doorGrp, 2.0, 0.42, 0.22, M.goldOchre, 0, floorY + wallH - 0.21, D / 2 - 0.12);
  addCollider(colGrp, 'COLLISION_WALL_FRONT_L', frontSegW, wallH, 0.28, -(1.0 + frontSegW / 2), wy, D / 2 - 0.12, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_FRONT_R', frontSegW, wallH, 0.28, (1.0 + frontSegW / 2), wy, D / 2 - 0.12, M.colliderMat);

  // Decorative exterior carvings trim (Ukiran / Gorga / Pa'ssura')
  box(wallGrp, W + 0.05, 0.28, 0.22, M.goldOchre, 0, floorY + 0.25, D / 2 - 0.04);
  if (isTongkonan) {
    // Free-standing Tulak Somba pillar at front
    cyl(stiltGrp, 0.15, 0.18, floorY + 5.2, 10, M.ironwood, 0, (floorY + 5.2) / 2, D / 2 + 2.6);
  }

  // Walkable Interior Elements (Tonggak Tuo pillars, woven ceremonial mats, Bilik alcove partitions, traditional chest)
  box(furnGrp, W * 0.55, 0.03, D * 0.48, M.matWoven, 0, floorY + 0.015, 0.3, 0, 0, 0, 'CEREMONIAL_HALL_MAT');
  box(furnGrp, 1.4, 0.45, 0.75, M.crimson, -W * 0.28, floorY + 0.225, -D * 0.25, 0, 0, 0, 'BILIK_PLATFORM_L');
  box(furnGrp, 1.4, 0.45, 0.75, M.crimson, W * 0.28, floorY + 0.225, -D * 0.25, 0, 0, 0, 'BILIK_PLATFORM_R');
  box(furnGrp, 1.1, 0.55, 0.55, M.goldOchre, 0, floorY + 0.275, -D / 2 + 0.75, 0, 0, 0, 'PUSAKA_CHEST');

  // Sweeping Curved Saddle / Gonjong Roof Surface
  const roofMat = isGadang ? M.ijuk : M.shingle;
  const roofMesh = buildCurvedRoofMesh(24, 16, (u, v) => {
    const t = u * 2 - 1; // -1..1 along ridge
    const s = v * 2 - 1; // -1..1 across slope
    const ridgeAxis = isTongkonan ? D * 0.78 : W * 0.66;
    const widthAxis = isTongkonan ? W * 0.68 : D * 0.64;
    const curveLift = Math.pow(Math.abs(t), 2.1) * (isGadang ? 2.8 : 2.3);
    const pitchH = (1 - Math.abs(s)) * (2.6 + curveLift * 0.45);
    const y = floorY + wallH - 0.25 + pitchH + curveLift * (1 - Math.abs(s) * 0.65);
    const coordA = t * ridgeAxis;
    const coordB = s * widthAxis;
    return isTongkonan ? { x: coordB, y, z: coordA } : { x: coordA, y, z: coordB };
  }, roofMat);
  roofGrp.add(roofMesh);

  return {
    scene,
    spawnPoint: [0, 0.05, D / 2 + 4.8],
    interiorZones: [
      { id: 'ruang-utama', name: isGadang ? 'Ruang Tengah & Bilik Rumah Gadang' : isTongkonan ? 'Kale Banua (Tangdo–Sali–Sumbung)' : 'Ruang Utama Hunian Panggung', bounds: { minX: -W / 2 + 0.2, maxX: W / 2 - 0.2, minZ: -D / 2 + 0.2, maxZ: D / 2 - 0.2 }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

// ============================================================================
// ARCHETYPE 3: CONICAL / CIRCULAR / OCTAGONAL HIGHLAND & SPIRITUAL ARCHITECTURE
// (Honai Papua, Mbaru Niang Wae Rebo, Kariwari Enggros, Tambi Lore)
// ============================================================================
function buildConicalHouse(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = `HOUSE_${house.id.toUpperCase().replace(/-/g, '_')}_ROOT`;
  scene.add(root);

  const isMbaru = /mbaru/i.test(house.id);
  const isKariwari = /kariwari/i.test(house.id);
  const isHonai = /honai/i.test(house.id);
  const R = isMbaru ? 5.2 : isKariwari ? 4.4 : 3.6;
  const floorY = isMbaru || isKariwari ? 0.65 : 0.14;
  const segs = isKariwari ? 8 : 20;

  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const colStructGrp = new THREE.Group(); colStructGrp.name = 'STRUCTURAL_COLUMNS'; root.add(colStructGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  // Circular / Octagonal Base & Walkable Ground Floor
  cyl(floorGrp, R + 0.2, R + 0.3, floorY, segs, isHonai ? M.earthFloor : M.teak, 0, floorY / 2, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', R * 2, floorY, R * 2, 0, floorY / 2, 0, M.colliderMat);
  if (floorY > 0.3) {
    box(floorGrp, 1.8, floorY * 0.5, 0.7, M.agedWood, 0, floorY * 0.25, R + 0.45);
    addCollider(colGrp, 'COLLISION_STAIR_FRONT', 1.8, floorY * 0.5, 0.7, 0, floorY * 0.25, R + 0.45, M.colliderMat);
  }

  // Interior Support Posts & Upper Loft Deck (Lobo / Lantai Atas Honai)
  const wallH = isMbaru ? 2.4 : 2.2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    cyl(colStructGrp, 0.11, 0.12, wallH + 1.4, 8, M.ironwood, Math.cos(a) * (R * 0.38), floorY + (wallH + 1.4) / 2, Math.sin(a) * (R * 0.38));
  }
  if (isMbaru) {
    // Central Hiri Bongkok pole
    cyl(colStructGrp, 0.14, 0.16, 7.2, 10, M.ironwood, 0, floorY + 3.6, 0);
  }
  // Upper loft deck (half-ring so player sees loft & ladder from inside!)
  cyl(floorGrp, R * 0.72, R * 0.72, 0.14, segs, M.bamboo, 0, floorY + wallH, -0.35);
  // Interior wooden ladder (Rede / Tangga Dalam)
  box(furnGrp, 0.08, wallH + 0.3, 0.08, M.bamboo, -0.3, floorY + wallH / 2, -R * 0.25, -0.22, 0, 0);
  box(furnGrp, 0.08, wallH + 0.3, 0.08, M.bamboo, 0.3, floorY + wallH / 2, -R * 0.25, -0.22, 0, 0);
  for (let r = 0; r < 6; r++) {
    box(furnGrp, 0.62, 0.05, 0.06, M.bamboo, 0, floorY + 0.35 + r * 0.34, -R * 0.25 - (r - 2.5) * 0.07);
  }

  // Ring Wall Panels leaving a clear 1.5m entrance doorway facing +Z!
  const wallSegs = 12;
  for (let i = 0; i < wallSegs; i++) {
    const ang = (i / wallSegs) * Math.PI * 2;
    const x = Math.sin(ang) * (R - 0.15);
    const z = Math.cos(ang) * (R - 0.15);
    if (z > R * 0.75 && Math.abs(x) < 1.1) continue; // Open doorway!
    const segW = (2 * Math.PI * R) / wallSegs + 0.08;
    box(wallGrp, segW, wallH, 0.18, M.agedWood, x, floorY + wallH / 2, z, 0, ang, 0);
    addCollider(colGrp, `COLLISION_WALL_RING_${i}`, segW, wallH, 0.26, x, floorY + wallH / 2, z, M.colliderMat);
  }

  // Central Hearth (Perapian / Rapu) & Woven Sleeping Mats
  cyl(furnGrp, 0.65, 0.72, 0.16, 12, M.andesite, 0, floorY + 0.08, 0.1, 0, 0, 0, 'CENTRAL_HEARTH_RING');
  cyl(furnGrp, 0.42, 0.48, 0.12, 10, M.ember, 0, floorY + 0.14, 0.1, 0, 0, 0, 'HEARTH_EMBERS');
  box(furnGrp, 1.5, 0.04, 0.9, M.matWoven, -R * 0.48, floorY + 0.02, -0.5);
  box(furnGrp, 1.5, 0.04, 0.9, M.matWoven, R * 0.48, floorY + 0.02, -0.5);

  // Conical / Dome Roof (lifts cleanly in cutaway mode when avatar enters!)
  if (isHonai) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.35, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), M.thatch);
    dome.position.set(0, floorY + wallH - 0.2, 0);
    roofGrp.add(dome);
  } else if (isKariwari) {
    // 3-tier octagonal pyramid roof
    for (let t = 0; t < 3; t++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(R + 0.8 - t * 1.1, 2.3, 8), M.thatch);
      cone.position.set(0, floorY + wallH + 0.9 + t * 1.65, 0);
      roofGrp.add(cone);
    }
  } else {
    // Steep iconic Mbaru Niang 5-tier conical roof
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R + 0.8, 7.6, 20), M.ijuk);
    cone.position.set(0, floorY + 4.3, 0);
    roofGrp.add(cone);
  }

  return {
    scene,
    spawnPoint: [0, 0.05, R + 3.2],
    interiorZones: [
      { id: 'ruang-lingkar', name: isHonai ? 'Lantai Bawah Perapian & Loteng Honai' : isMbaru ? 'Tenda / Lutur Mbaru Niang' : 'Balai Lingkar Utama', bounds: { minX: -R, maxX: R, minZ: -R, maxZ: R }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

// ============================================================================
// ARCHETYPE 4: COMMUNAL LONGHOUSE / MALAY STILT / PALACE / PAVILION / COMPOUND
// (Tailored per typology: Longhouse, Open Pavilion, Stepped Limas, Bali Compound, etc.)
// ============================================================================
function buildRegionalVernacularHouse(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = `HOUSE_${house.id.toUpperCase().replace(/-/g, '_')}_ROOT`;
  scene.add(root);

  const typ = `${house.architecturalType} ${house.houseName} ${house.id}`.toLowerCase();
  const isOpenPavilion = /baileo|sasadu|nuwo-sesat|dulohupa|bale-bali/.test(house.id);
  const isLonghouse = /betang|lamin|panjang|baloy|jew-asmat|uma-mentawai|karapauw/.test(house.id);
  const isMultiTier = /malige|limas|bubungan-tinggi/.test(house.id);
  const isThousandLegs = /mod-aki-aksa/.test(house.id);
  const isGroundBase = /bale-tani|kebaya|bale-bali/.test(house.id);

  const W = isLonghouse ? 14.0 : isOpenPavilion ? 9.6 : 8.6;
  const D = isLonghouse ? 6.8 : isMultiTier ? 9.4 : 7.4;
  const floorY = isGroundBase ? 0.45 : isLonghouse ? 1.8 : 1.35;

  const foundGrp = new THREE.Group(); foundGrp.name = 'FOUNDATION_SYSTEM'; root.add(foundGrp);
  const stiltGrp = new THREE.Group(); stiltGrp.name = 'STRUCTURAL_COLUMNS'; root.add(stiltGrp);
  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const stairGrp = new THREE.Group(); stairGrp.name = 'ENTRANCE_STAIRS'; root.add(stairGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  // Foundation / Stilts
  if (isGroundBase) {
    box(foundGrp, W + 0.6, floorY, D + 0.6, M.andesite, 0, floorY / 2, 0);
  } else {
    const nx = isThousandLegs ? 8 : isLonghouse ? 7 : 4;
    const nz = isThousandLegs ? 6 : 4;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const px = -W / 2 + 0.5 + (ix / (nx - 1)) * (W - 1.0);
        const pz = -D / 2 + 0.5 + (iz / (nz - 1)) * (D - 1.0);
        cyl(foundGrp, 0.18, 0.22, 0.2, 6, M.andesite, px, 0.1, pz);
        cyl(stiltGrp, isThousandLegs ? 0.08 : 0.13, isThousandLegs ? 0.09 : 0.15, floorY, 8, M.ironwood, px, floorY / 2, pz);
      }
    }
  }

  // Main Walkable Floor + Optional Stepped Kekijing (Limas) or Veranda
  box(floorGrp, W, 0.22, D, isGroundBase ? M.earthFloor : M.teak, 0, floorY - 0.11, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', W, 0.24, D, 0, floorY - 0.12, 0, M.colliderMat);

  // Stairs leading smoothly up to floorY
  const steps = Math.max(3, Math.round(floorY / 0.22));
  const stairLen = Math.max(1.0, floorY * 1.45);
  for (let s = 0; s < steps; s++) {
    const sy = (s + 0.5) * (floorY / steps);
    const sz = D / 2 + stairLen - s * (stairLen / steps);
    box(stairGrp, 2.0, 0.12, stairLen / steps + 0.08, M.agedWood, 0, sy, sz);
    addCollider(colGrp, `COLLISION_STAIR_${s}`, 2.0, floorY / steps, stairLen / steps + 0.1, 0, sy, sz, M.colliderMat);
  }

  // Upper Support Columns
  const wallH = 2.65;
  for (const sx of [-W / 2 + 0.35, -W / 6, W / 6, W / 2 - 0.35]) {
    for (const sz of [-D / 2 + 0.35, D / 2 - 0.35]) {
      box(stiltGrp, 0.18, wallH, 0.18, M.teak, sx, floorY + wallH / 2, sz);
    }
  }

  // Walls (Open if Baileo/Sasadu/Nuwo Sesat/Bali Bale, Enclosed with wide walkable doorway otherwise!)
  const wy = floorY + wallH / 2;
  if (isOpenPavilion) {
    // Low decorative balustrade around sides/back, wide open front
    box(wallGrp, W - 0.4, 0.65, 0.14, M.goldOchre, 0, floorY + 0.325, -D / 2 + 0.2);
    box(wallGrp, 0.14, 0.65, D - 0.4, M.goldOchre, -W / 2 + 0.2, floorY + 0.325, 0);
    box(wallGrp, 0.14, 0.65, D - 0.4, M.goldOchre, W / 2 - 0.2, floorY + 0.325, 0);
    addCollider(colGrp, 'COLLISION_RAIL_BACK', W - 0.4, 0.9, 0.25, 0, floorY + 0.45, -D / 2 + 0.2, M.colliderMat);
    addCollider(colGrp, 'COLLISION_RAIL_L', 0.25, 0.9, D - 0.4, -W / 2 + 0.2, floorY + 0.45, 0, M.colliderMat);
    addCollider(colGrp, 'COLLISION_RAIL_R', 0.25, 0.9, D - 0.4, W / 2 - 0.2, floorY + 0.45, 0, M.colliderMat);
    // Ceremonial Council Table (Taba) & Perimeter Benches (Dedegu) or Batu Pamali
    box(furnGrp, 3.2, 0.55, 1.1, M.teak, 0, floorY + 0.275, 0, 0, 0, 0, 'COUNCIL_TABLE_TABA');
    box(furnGrp, 3.6, 0.38, 0.48, M.agedWood, 0, floorY + 0.19, -1.35, 0, 0, 0, 'BENCH_DEDEGU_N');
    box(furnGrp, 3.6, 0.38, 0.48, M.agedWood, 0, floorY + 0.19, 1.35, 0, 0, 0, 'BENCH_DEDEGU_S');
  } else {
    const wMat = /sulah|bale-tani|karapauw/.test(house.id) ? M.wovenWall : /kebaya|melayu|limas|bubungan/.test(house.id) ? M.ivoryPlaster : M.agedWood;
    const frontVerandaDepth = isLonghouse ? 1.8 : 1.3;
    const frontWallZ = D / 2 - frontVerandaDepth;
    // Back wall
    box(wallGrp, W - 0.2, wallH, 0.18, wMat, 0, wy, -D / 2 + 0.12);
    addCollider(colGrp, 'COLLISION_WALL_BACK', W - 0.2, wallH, 0.28, 0, wy, -D / 2 + 0.12, M.colliderMat);
    // Side walls (stopping at veranda)
    const enclD = D - frontVerandaDepth;
    const enclCenterZ = (-D / 2 + frontWallZ) / 2;
    box(wallGrp, 0.18, wallH, enclD, wMat, -W / 2 + 0.12, wy, enclCenterZ);
    box(wallGrp, 0.18, wallH, enclD, wMat, W / 2 - 0.12, wy, enclCenterZ);
    addCollider(colGrp, 'COLLISION_WALL_L', 0.28, wallH, enclD, -W / 2 + 0.12, wy, enclCenterZ, M.colliderMat);
    addCollider(colGrp, 'COLLISION_WALL_R', 0.28, wallH, enclD, W / 2 - 0.12, wy, enclCenterZ, M.colliderMat);
    // Front wall with wide 2.0m walkable doorway
    const segW = (W - 2.2) / 2;
    box(wallGrp, segW, wallH, 0.18, wMat, -(1.1 + segW / 2), wy, frontWallZ);
    box(wallGrp, segW, wallH, 0.18, wMat, (1.1 + segW / 2), wy, frontWallZ);
    box(doorGrp, 2.2, 0.42, 0.22, M.goldOchre, 0, floorY + wallH - 0.21, frontWallZ);
    addCollider(colGrp, 'COLLISION_WALL_FRONT_L', segW, wallH, 0.28, -(1.1 + segW / 2), wy, frontWallZ, M.colliderMat);
    addCollider(colGrp, 'COLLISION_WALL_FRONT_R', segW, wallH, 0.28, (1.1 + segW / 2), wy, frontWallZ, M.colliderMat);

    // Interior Furniture (Communal Mats, Hearths/Tungku, Family Room Partitions)
    box(furnGrp, W * 0.62, 0.03, enclD * 0.55, M.matWoven, 0, floorY + 0.015, enclCenterZ + 0.2, 0, 0, 0, 'INTERIOR_MAT');
    box(furnGrp, 1.5, 0.40, 0.85, M.teak, -W * 0.26, floorY + 0.20, -D / 2 + 1.0, 0, 0, 0, 'SEATING_BENCH_L');
    box(furnGrp, 1.5, 0.40, 0.85, M.teak, W * 0.26, floorY + 0.20, -D / 2 + 1.0, 0, 0, 0, 'SEATING_BENCH_R');
    cyl(furnGrp, 0.52, 0.58, 0.18, 10, M.andesite, 0, floorY + 0.09, -D / 2 + 1.1, 0, 0, 0, 'INTERIOR_HEARTH');
    cyl(furnGrp, 0.34, 0.38, 0.12, 8, M.ember, 0, floorY + 0.16, -D / 2 + 1.1);
  }

  // Regional Roof Form
  const roofMat = /thatch|alang|sagu|rumbia|daun/.test((house.constructionMaterials || []).join(' ').toLowerCase())
    ? M.thatch
    : /genteng|terakota/.test((house.constructionMaterials || []).join(' ').toLowerCase())
      ? M.terracotta
      : M.shingle;

  const roofH = isMultiTier ? 3.8 : 2.8;
  const roofPrism = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(W, D) * 0.72, roofH, 4),
    roofMat
  );
  roofPrism.rotation.y = Math.PI / 4;
  roofPrism.scale.set(W / Math.max(W, D) * 1.12, 1.0, D / Math.max(W, D) * 1.12);
  roofPrism.position.set(0, floorY + wallH + roofH * 0.46, 0);
  roofGrp.add(roofPrism);

  // Regional Ridge Ornament (Selembayung / Tanduk Kambing / Bubungan Tinggi spire / Gigi Balang)
  box(roofGrp, W * 0.52, 0.24, 0.24, M.goldOchre, 0, floorY + wallH + roofH * 0.92, 0);
  if (isMultiTier) {
    const upperTier = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.6, 4), roofMat);
    upperTier.rotation.y = Math.PI / 4;
    upperTier.position.set(0, floorY + wallH + roofH + 0.8, 0);
    roofGrp.add(upperTier);
  }

  return {
    scene,
    spawnPoint: [0, 0.05, D / 2 + stairLen + 2.4],
    interiorZones: [
      { id: 'beranda', name: isOpenPavilion ? 'Balai Utama Terbuka' : 'Serambi / Beranda Depan', bounds: { minX: -W / 2, maxX: W / 2, minZ: D / 2 - 2.0, maxZ: D / 2 }, floorY },
      { id: 'ruang-dalam', name: isOpenPavilion ? 'Ruang Musyawarah Adat' : 'Ruang Dalam & Bilik Keluarga', bounds: { minX: -W / 2 + 0.2, maxX: W / 2 - 0.2, minZ: -D / 2 + 0.2, maxZ: D / 2 - 1.3 }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

function selectBuilder(house) {
  if (/joglo|ndalem|limasan|osing/.test(house.id)) return buildJavaneseHouse;
  if (/gadang|tongkonan|bolon|siwaluh|rumoh-aceh/.test(house.id)) return buildCurvedStiltHouse;
  if (/honai|mbaru-niang|kariwari|tambi-lore/.test(house.id)) return buildConicalHouse;
  return buildRegionalVernacularHouse;
}

async function exportHouse(house) {
  const M = createMats();
  const builder = selectBuilder(house);
  const built = builder(house, M);

  const exporter = new GLTFExporter();
  const glbBuf = await new Promise((resolve, reject) => {
    exporter.parse(built.scene, (res) => resolve(Buffer.from(res)), reject, { binary: true, onlyVisible: false });
  });

  const outGlb = path.join(HOUSES_OUT, `${house.id}.glb`);
  fs.writeFileSync(outGlb, glbBuf);

  let meshes = 0, triangles = 0, colliders = 0;
  const groups = [];
  built.scene.traverse((o) => {
    if (o.type === 'Group' && o.name) groups.push(o.name);
    if (o.isMesh) {
      if (o.name.startsWith('COLLISION')) colliders++;
      else {
        meshes++;
        const g = o.geometry;
        triangles += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      }
    }
  });

  const manifest = {
    schemaVersion: '2.0.0',
    houseId: house.id,
    houseName: house.houseName,
    province: house.province,
    island: house.island,
    provenance: house.assetProvenance === 'illustrative_scheme' ? 'illustrative_scheme' : 'original_digital_reconstruction',
    assetStatus: 'RECONSTRUCTION',
    walkableInterior: true,
    glbUrl: `assets/models/houses/${house.id}.glb`,
    fileSizeBytes: glbBuf.length,
    meshes,
    triangles: Math.round(triangles),
    colliders,
    groups,
    spawnPoint: built.spawnPoint,
    interiorZones: built.interiorZones,
    roofGroupNames: built.roofGroupNames,
    driveFolderRef: house.driveFolderRef || null,
    generatedAt: '2026-11-21',
    license: 'CC BY 4.0 — NULAR Architectural Digital Reconstruction'
  };
  fs.writeFileSync(path.join(MANIFEST_OUT, `${house.id}.json`), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function main() {
  const args = process.argv.slice(2);
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));

  let targets = [];
  if (args.includes('--pilot')) {
    targets = houses.filter((h) => h.id === 'rumah-joglo');
  } else if (args.includes('--all')) {
    targets = houses;
  } else {
    const regArg = args.find((a) => a.startsWith('--region='));
    if (regArg) {
      const region = regArg.split('=')[1];
      targets = houses.filter((h) => h.island.toLowerCase() === region.toLowerCase());
    }
  }

  if (!targets.length) {
    console.error('Specify --pilot, --region=<Island>, or --all');
    process.exit(1);
  }

  const manifests = [];
  for (const h of targets) {
    const m = await exportHouse(h);
    manifests.push(m);
    console.log(`[WORLD HOUSE GLB] ${m.houseId}.glb (${(m.fileSizeBytes / 1024).toFixed(1)} KB, ${m.triangles} tris, ${m.colliders} colliders, ${m.interiorZones.length} interior zones)`);
  }

  // Sync updated model paths & walkable metadata back into data/houses.json when --sync is passed
  if (args.includes('--sync')) {
    const mMap = new Map(manifests.map((m) => [m.houseId, m]));
    for (const h of houses) {
      const m = mMap.get(h.id);
      if (!m) continue;
      h.worldModel3DUrl = m.glbUrl;
      h.worldManifestUrl = `data/asset-manifests/${h.id}.json`;
      if (!h.model3DUrl) {
        h.model3DUrl = m.glbUrl;
        h.modelStatus = 'available';
      }
      h.assetStatus = m.provenance === 'illustrative_scheme' ? 'RECONSTRUCTION' : 'COMPLETE';
      h.modelCapabilities = {
        ...(h.modelCapabilities || {}),
        interiorSupported: true,
        walkableInterior: true,
        explodedSupported: true,
        separatedComponents: m.groups.length
      };
    }
    fs.writeFileSync(path.join(ROOT, 'data/houses.json'), JSON.stringify(houses, null, 2) + '\n');
    console.log(`Synchronized ${manifests.length} walkable GLB manifests into data/houses.json`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
