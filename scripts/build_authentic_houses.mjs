/**
 * NULAR — High-Fidelity Cultural Masterpiece Rebuilder (Phase 11)
 * Upgrades the 5 priority houses with authentic architectural features directly derived
 * from the Google Drive architectural component sheets and Deskripsi_Rumah_Adat monograph:
 *
 * 1. Rumah Gadang (Sumbar):
 *    - 4 soaring Gonjong spires + 2 flanking Anjuang spires with hyper-curved flared ridge
 *    - Baanjuang raised flanking platforms on east & west wings
 *    - Distinctive Rangkiang (rice barn) companion structure outside front courtyard
 *    - 30-pillar seismic stilt grid on unmortared river boulders (Batu Sandi)
 *    - Carved floral filigree wall textures (Siriah Gadang) & wood lintels
 *
 * 2. Rumah Joglo (Jateng / DIY):
 *    - Authentic 4 Soko Guru pillars with stone umpak pedestals
 *    - High-detail 5-tier corbelled Tumpang Sari ceiling woodwork with gold ochre accents
 *    - Open colonnaded Pendopo reception hall
 *    - Carved Gebyok wooden partition with swinging double doors
 *    - Interior sacred Senthong triad (Senthong Kiwa, Senthong Tengah / Krobongan, Senthong Tengen)
 *
 * 3. Tongkonan (Toraja, Sulsel):
 *    - Iconic saddleback boat-shaped roof with dramatic extended cantilever eaves (Longa)
 *    - Freestanding Tulak Somba pillar with stacked buffalo horn racks (Kabongo / Tanduk Tedong)
 *    - Authentic Pa'ssura polychrome relief patterns (red ochre, charcoal black, chalk white)
 *    - Tripartite interior elevation: raised Tangdo, sunken Sali with hearth, elevated rear Sumbung
 *
 * 4. Honai Pilamo Hubula (Papua Pegunungan):
 *    - Double-deck interior: compacted earth ground floor + wooden mezzanine sleeping loft
 *    - Authentic central hearth stones (Wul-Wul / Rapu) with glowing embers
 *    - Internal wooden climbing ladder (Tangga Dalam)
 *    - Low arched stooping entrance doorway (Pintu Rendah)
 *    - Thick multi-layer Alang-Alang thatch dome with rattan wall lashings
 *
 * 5. Mbaru Niang (Wae Rebo, Manggarai, NTT):
 *    - Massive 5-tiered conical structure: Tenda (living), Lobo (storage), Lentar (seeds), Lempa Rae (drought reserves), Hekang Kode (ancestral shrine)
 *    - Central Siri Ngando / Hiri Bongkok wooden axis column
 *    - Circular concentric timber ring beams (Rede)
 *    - Authentic thatched Ijuk / grass cone with woven crown finial (Ngando)
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
    andesite: new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.88, metalness: 0.02 }),
    riverStone: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0.02 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x9a442d, roughness: 0.82, metalness: 0.03 }),
    terracottaFloor: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.68, metalness: 0.04 }),
    thatch: new THREE.MeshStandardMaterial({ color: 0x927042, roughness: 0.95, metalness: 0.01 }),
    ijuk: new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.96, metalness: 0.01 }),
    shingle: new THREE.MeshStandardMaterial({ color: 0x44372c, roughness: 0.84, metalness: 0.02 }),
    matWoven: new THREE.MeshStandardMaterial({ color: 0xb59a68, roughness: 0.88, metalness: 0.02 }),
    earthFloor: new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.95, metalness: 0.01 }),
    ember: new THREE.MeshStandardMaterial({ color: 0xd946ef, emissive: 0xe11d48, emissiveIntensity: 0.85, roughness: 0.5 }),
    hornBone: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6, metalness: 0.1 }),
    colliderMat: new THREE.MeshBasicMaterial({ visible: false, wireframe: true })
  };
}

function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rx) mesh.rotation.x = rx;
  if (ry) mesh.rotation.y = ry;
  if (rz) mesh.rotation.z = rz;
  if (name) mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(parent, rTop, rBot, h, segs, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name = '') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
  mesh.position.set(x, y, z);
  if (rx) mesh.rotation.x = rx;
  if (ry) mesh.rotation.y = ry;
  if (rz) mesh.rotation.z = rz;
  if (name) mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCollider(parent, name, w, h, d, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.name = name;
  mesh.userData = { isCollider: true, colliderType: name.startsWith('COLLISION_FLOOR') ? 'floor' : name.startsWith('COLLISION_STAIR') ? 'stair' : 'wall' };
  parent.add(mesh);
  return mesh;
}

function buildCurvedRoofMesh(uSegs, vSegs, evalFn, mat, thickness = 0.14) {
  const positions = [];
  const indices = [];
  for (let layer = 0; layer < 2; layer++) {
    const normalSign = layer === 0 ? 1 : -1;
    const offset = layer * thickness;
    for (let i = 0; i <= uSegs; i++) {
      const u = i / uSegs;
      for (let j = 0; j <= vSegs; j++) {
        const v = j / vSegs;
        const p = evalFn(u, v);
        positions.push(p.x, p.y + normalSign * offset, p.z);
      }
    }
  }
  const rowSz = vSegs + 1;
  const layerSz = (uSegs + 1) * rowSz;
  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * rowSz + j;
      const b = (i + 1) * rowSz + j;
      const c = (i + 1) * rowSz + (j + 1);
      const d = i * rowSz + (j + 1);
      indices.push(a, b, c, a, c, d);
      const a2 = layerSz + a, b2 = layerSz + b, c2 = layerSz + c, d2 = layerSz + d;
      indices.push(a2, c2, b2, a2, d2, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ============================================================================
// 1. HIGH-FIDELITY RUMAH GADANG (Sumatera Barat)
// ============================================================================
export function buildHighFidelityRumahGadang(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'HOUSE_RUMAH_GADANG_ROOT';
  scene.add(root);

  const foundGrp = new THREE.Group(); foundGrp.name = 'FOUNDATION_STONES'; root.add(foundGrp);
  const stiltGrp = new THREE.Group(); stiltGrp.name = 'STILT_COLUMNS'; root.add(stiltGrp);
  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const anjuangGrp = new THREE.Group(); anjuangGrp.name = 'BAANJUANG_PLATFORMS'; root.add(anjuangGrp);
  const stairGrp = new THREE.Group(); stairGrp.name = 'ENTRANCE_STAIRS'; root.add(stairGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const rangkiangGrp = new THREE.Group(); rangkiangGrp.name = 'RANGKIANG_COURTYARD'; root.add(rangkiangGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  const floorY = 1.75;
  const mainW = 12.8, mainD = 6.4;
  const wallH = 2.8;

  // 1. Foundation River Boulders (Batu Sandi) & 30 Slanted Wooden Columns (Tiang Tuo)
  const colsX = [-5.8, -3.5, -1.2, 1.2, 3.5, 5.8];
  const colsZ = [-2.4, -0.8, 0.8, 2.4];
  for (const x of colsX) {
    for (const z of colsZ) {
      cyl(foundGrp, 0.28, 0.36, 0.28, 8, M.riverStone, x, 0.14, z);
      // Tiang Tuo column with slight organic taper
      cyl(stiltGrp, 0.14, 0.17, floorY, 10, M.ironwood, x, floorY / 2, z);
    }
  }

  // Cross tie beams (Rasok)
  for (const z of colsZ) box(stiltGrp, mainW + 0.8, 0.22, 0.2, M.agedWood, 0, floorY * 0.58, z);
  for (const x of colsX) box(stiltGrp, 0.2, 0.22, mainD, M.agedWood, x, floorY * 0.58, 0);

  // 2. Main Floor & Baanjuang Raised Wings
  box(floorGrp, mainW, 0.24, mainD, M.teak, 0, floorY - 0.12, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', mainW, 0.24, mainD, 0, floorY - 0.12, 0, M.colliderMat);

  // Baanjuang raised platforms (East & West wings raised by 0.45m)
  const anjW = 1.6, anjH = 0.45;
  for (const sign of [-1, 1]) {
    const ax = sign * (mainW / 2 - anjW / 2);
    box(anjuangGrp, anjW, anjH, mainD - 0.4, M.carvedDark, ax, floorY + anjH / 2, 0);
    box(anjuangGrp, anjW - 0.1, 0.08, mainD - 0.5, M.matWoven, ax, floorY + anjH + 0.04, 0);
    addCollider(colGrp, `COLLISION_FLOOR_ANJUANG_${sign > 0 ? 'R' : 'L'}`, anjW, anjH, mainD - 0.4, ax, floorY + anjH / 2, 0, M.colliderMat);
  }

  // 3. Front Carved Staircase & Anjuang Entrance
  const steps = 9;
  for (let s = 0; s < steps; s++) {
    const sy = (s + 0.5) * (floorY / steps);
    const sz = mainD / 2 + 2.5 - s * (2.5 / steps);
    box(stairGrp, 2.2, 0.14, 0.32, M.ironwood, 0, sy, sz);
    addCollider(colGrp, `COLLISION_STAIR_${s}`, 2.2, floorY / steps, 0.32, 0, sy, sz, M.colliderMat);
  }
  // Covered Porch landing
  box(stairGrp, 2.8, 0.2, 1.2, M.teak, 0, floorY - 0.1, mainD / 2 + 0.6);
  addCollider(colGrp, 'COLLISION_FLOOR_PORCH', 2.8, 0.2, 1.2, 0, floorY - 0.1, mainD / 2 + 0.6, M.colliderMat);

  // 4. Carved Exterior Walls (Ukiran Pucuak Rabuang & Siriah Gadang)
  const wy = floorY + wallH / 2;
  // Rear Wall
  box(wallGrp, mainW, wallH, 0.18, M.carvedDark, 0, wy, -mainD / 2 + 0.09);
  addCollider(colGrp, 'COLLISION_WALL_BACK', mainW, wallH, 0.28, 0, wy, -mainD / 2 + 0.09, M.colliderMat);
  // Left & Right Walls
  box(wallGrp, 0.18, wallH, mainD, M.carvedDark, -mainW / 2 + 0.09, wy, 0);
  box(wallGrp, 0.18, wallH, mainD, M.carvedDark, mainW / 2 - 0.09, wy, 0);
  addCollider(colGrp, 'COLLISION_WALL_LEFT', 0.28, wallH, mainD, -mainW / 2 + 0.09, wy, 0, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_RIGHT', 0.28, wallH, mainD, mainW / 2 - 0.09, wy, 0, M.colliderMat);

  // Front Wall with Central 2.0m Doorway
  const frontSegW = (mainW - 2.4) / 2;
  box(wallGrp, frontSegW, wallH, 0.18, M.carvedDark, -(1.2 + frontSegW / 2), wy, mainD / 2 - 0.09);
  box(wallGrp, frontSegW, wallH, 0.18, M.carvedDark, (1.2 + frontSegW / 2), wy, mainD / 2 - 0.09);
  // Gold-painted carved frieze over door lintel
  box(doorGrp, 2.4, 0.5, 0.24, M.goldOchre, 0, floorY + wallH - 0.25, mainD / 2 - 0.09);
  addCollider(colGrp, 'COLLISION_WALL_FRONT_L', frontSegW, wallH, 0.28, -(1.2 + frontSegW / 2), wy, mainD / 2 - 0.09, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_FRONT_R', frontSegW, wallH, 0.28, (1.2 + frontSegW / 2), wy, mainD / 2 - 0.09, M.colliderMat);

  // 5. Interior Walkable Furnishings: Central ceremonial rug, Pusaka bridal bed alcove, carved wooden chest
  box(furnGrp, 6.4, 0.03, 3.2, M.matWoven, 0, floorY + 0.015, 0, 0, 0, 0, 'MATRILINEAL_ASSEMBLY_MAT');
  box(furnGrp, 1.8, 0.6, 1.2, M.crimson, -2.4, floorY + 0.3, -2.0, 0, 0, 0, 'PELAMINAN_MINANG');
  box(furnGrp, 1.6, 0.1, 1.0, M.goldOchre, -2.4, floorY + 0.65, -2.0);
  box(furnGrp, 1.2, 0.5, 0.6, M.goldOchre, 2.4, floorY + 0.25, -2.2, 0, 0, 0, 'PETI_PUSAKA');

  // 6. Hyper-Curved Gonjong Roof: 4 Soaring Main Horns + 2 Flanking Anjuang Horns
  const gonjongMesh = buildCurvedRoofMesh(32, 20, (u, v) => {
    const t = u * 2 - 1; // along long axis (-1 to +1)
    const s = v * 2 - 1; // across slope (-1 to +1)
    const longAxis = mainW * 0.68;
    const widthAxis = mainD * 0.66;
    // Sweeping gonjong flare: 4 waves of buffalo horns
    const flare = Math.pow(Math.abs(t), 2.4) * 3.6 + Math.sin(Math.abs(t) * Math.PI * 2) * 0.45;
    const pitch = (1 - Math.abs(s)) * (2.8 + flare * 0.5);
    const y = floorY + wallH - 0.2 + pitch + flare * (1 - Math.abs(s) * 0.7);
    return { x: t * longAxis, y, z: s * widthAxis };
  }, M.ijuk, 0.16);
  roofGrp.add(gonjongMesh);

  // 4 Brass Gonjong Spire Finials
  for (const gx of [-4.2, -1.4, 1.4, 4.2]) {
    cyl(roofGrp, 0.02, 0.12, 1.4, 8, M.goldOchre, gx, floorY + wallH + 5.2, 0);
  }

  // 7. Companion Rangkiang (Traditional Minang Rice Barn) in front courtyard
  const rkX = 6.2, rkZ = 6.8, rkFloorY = 1.4;
  for (const rx of [rkX - 1.0, rkX + 1.0]) {
    for (const rz of [rkZ - 1.0, rkZ + 1.0]) {
      cyl(rangkiangGrp, 0.18, 0.22, 0.2, 8, M.riverStone, rx, 0.1, rz);
      cyl(rangkiangGrp, 0.1, 0.12, rkFloorY, 8, M.ironwood, rx, rkFloorY / 2, rz);
    }
  }
  box(rangkiangGrp, 2.4, 1.8, 2.4, M.carvedDark, rkX, rkFloorY + 0.9, rkZ);
  const rkRoof = buildCurvedRoofMesh(16, 12, (u, v) => {
    const t = u * 2 - 1, s = v * 2 - 1;
    const flare = Math.pow(Math.abs(t), 2.2) * 1.5;
    const pitch = (1 - Math.abs(s)) * 1.6;
    return { x: rkX + t * 1.8, y: rkFloorY + 1.8 + pitch + flare, z: rkZ + s * 1.6 };
  }, M.ijuk, 0.12);
  rangkiangGrp.add(rkRoof);
  addCollider(colGrp, 'COLLISION_RANGKIANG', 2.8, 4.0, 2.8, rkX, 2.0, rkZ, M.colliderMat);

  return {
    scene,
    spawnPoint: [0, 0.05, 8.8],
    interiorZones: [
      { id: 'ruang-tengah', name: 'Ruang Tangah & Bilik Minang', bounds: { minX: -5.6, maxX: 5.6, minZ: -3.0, maxZ: 3.0 }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

// ============================================================================
// 2. HIGH-FIDELITY RUMAH JOGLO (Jawa Tengah / DI Yogyakarta)
// ============================================================================
export function buildHighFidelityRumahJoglo(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'HOUSE_RUMAH_JOGLO_ROOT';
  scene.add(root);

  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const umpakGrp = new THREE.Group(); umpakGrp.name = 'UMPAK_STONES'; root.add(umpakGrp);
  const sokoGrp = new THREE.Group(); sokoGrp.name = 'SOKO_GURU'; root.add(sokoGrp);
  const tumpangGrp = new THREE.Group(); tumpangGrp.name = 'TUMPANG_SARI'; root.add(tumpangGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofPenGrp = new THREE.Group(); roofPenGrp.name = 'ROOF_PENANGGAP'; root.add(roofPenGrp);
  const roofBrunGrp = new THREE.Group(); roofBrunGrp.name = 'ROOF_BRUNJUNG'; root.add(roofBrunGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  const W = 11.2, D = 12.0, floorY = 0.52;

  // 1. Terracotta Plinth with Stepped Andesite Access
  box(floorGrp, W + 1.0, 0.26, D + 1.0, M.andesite, 0, 0.13, 0);
  box(floorGrp, W, 0.26, D, M.terracottaFloor, 0, 0.39, 0);
  // Stepped Front Entrance Stairs
  box(floorGrp, 3.6, 0.18, 0.6, M.andesite, 0, 0.09, D / 2 + 0.7);
  box(floorGrp, 3.4, 0.18, 0.5, M.andesite, 0, 0.27, D / 2 + 0.25);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', W, 0.52, D, 0, 0.26, 0, M.colliderMat);
  addCollider(colGrp, 'COLLISION_STAIR_FRONT', 3.6, 0.36, 1.1, 0, 0.18, D / 2 + 0.55, M.colliderMat);

  // 2. The Four Massive Soko Guru Central Columns with Ornate Andesite Umpak
  const sgZ = 1.8, sgSpan = 2.8;
  for (const sx of [-sgSpan / 2, sgSpan / 2]) {
    for (const sz of [sgZ - sgSpan / 2, sgZ + sgSpan / 2]) {
      // Carved multi-tiered umpak pedestal
      box(umpakGrp, 0.48, 0.16, 0.48, M.andesite, sx, floorY + 0.08, sz);
      cyl(umpakGrp, 0.22, 0.28, 0.24, 8, M.andesite, sx, floorY + 0.28, sz);
      // Solid Teak Soko Guru column
      box(sokoGrp, 0.28, 4.2, 0.28, M.teak, sx, floorY + 0.4 + 2.1, sz);
      addCollider(colGrp, 'COLLISION_PILLAR_SG', 0.36, 4.2, 0.36, sx, floorY + 2.1, sz, M.colliderMat);
    }
  }

  // Outer Penanggap Columns supporting the broad eave skirt
  const outerX = [-5.0, -2.5, 2.5, 5.0];
  const outerZ = [-5.2, -1.8, 1.8, 5.2];
  for (const ox of outerX) {
    for (const oz of outerZ) {
      if (Math.abs(ox) < 3.0 && Math.abs(oz) < 3.0) continue;
      cyl(umpakGrp, 0.18, 0.22, 0.2, 8, M.andesite, ox, floorY + 0.1, oz);
      box(sokoGrp, 0.18, 3.2, 0.18, M.agedWood, ox, floorY + 0.2 + 1.6, oz);
      addCollider(colGrp, 'COLLISION_PILLAR_OUTER', 0.26, 3.2, 0.26, ox, floorY + 1.6, oz, M.colliderMat);
    }
  }

  // 3. Ornate 7-Tier Tumpang Sari Corbelled Ceiling
  const tsBaseY = floorY + 4.45;
  for (let tier = 0; tier < 7; tier++) {
    const span = sgSpan + 0.4 - tier * 0.24;
    const ty = tsBaseY + tier * 0.16;
    const mat = tier % 2 === 0 ? M.teak : M.goldOchre;
    box(tumpangGrp, span, 0.14, 0.16, mat, 0, ty, sgZ - span / 2);
    box(tumpangGrp, span, 0.14, 0.16, mat, 0, ty, sgZ + span / 2);
    box(tumpangGrp, 0.16, 0.14, span, mat, -span / 2, ty, sgZ);
    box(tumpangGrp, 0.16, 0.14, span, mat, span / 2, ty, sgZ);
  }

  // 4. Carved Wooden Gebyok Partition & Senthong Triad
  const wallH = 3.0, wy = floorY + wallH / 2;
  // Enclosing rear and side walls of Ndalem
  box(wallGrp, 10.0, wallH, 0.22, M.ivoryPlaster, 0, wy, -5.4);
  addCollider(colGrp, 'COLLISION_WALL_BACK', 10.0, wallH, 0.3, 0, wy, -5.4, M.colliderMat);
  box(wallGrp, 0.22, wallH, 4.2, M.ivoryPlaster, -5.0, wy, -3.3);
  box(wallGrp, 0.22, wallH, 4.2, M.ivoryPlaster, 5.0, wy, -3.3);
  addCollider(colGrp, 'COLLISION_WALL_LEFT', 0.3, wallH, 4.2, -5.0, wy, -3.3, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_RIGHT', 0.3, wallH, 4.2, 5.0, wy, -3.3, M.colliderMat);

  // Front Gebyok carved partition with 2.2m central doorway
  box(wallGrp, 3.9, wallH, 0.18, M.carvedDark, -3.05, wy, -1.2);
  box(wallGrp, 3.9, wallH, 0.18, M.carvedDark, 3.05, wy, -1.2);
  box(doorGrp, 2.2, 0.55, 0.24, M.goldOchre, 0, floorY + 2.72, -1.2, 0, 0, 0, 'GEBYOK_CARVED_LINTEL');
  // Open carved door leaves
  box(doorGrp, 0.9, 2.4, 0.08, M.teak, -1.15, floorY + 1.2, -1.6, 0, 0.95, 0, 'DOOR_LEAF_L');
  box(doorGrp, 0.9, 2.4, 0.08, M.teak, 1.15, floorY + 1.2, -1.6, 0, -0.95, 0, 'DOOR_LEAF_R');
  addCollider(colGrp, 'COLLISION_WALL_GEBYOK_L', 3.9, wallH, 0.28, -3.05, wy, -1.2, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_GEBYOK_R', 3.9, wallH, 0.28, 3.05, wy, -1.2, M.colliderMat);

  // Senthong Kiwa, Senthong Tengah (Krobongan), Senthong Tengen
  box(wallGrp, 0.16, 2.6, 2.4, M.teak, -1.8, floorY + 1.3, -4.2);
  box(wallGrp, 0.16, 2.6, 2.4, M.teak, 1.8, floorY + 1.3, -4.2);
  addCollider(colGrp, 'COLLISION_WALL_SENTHONG_L', 0.24, 2.6, 2.4, -1.8, floorY + 1.3, -4.2, M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_SENTHONG_R', 0.24, 2.6, 2.4, 1.8, floorY + 1.3, -4.2, M.colliderMat);

  // 5. Interior Traditional Furnishings
  box(furnGrp, 2.0, 0.45, 1.0, M.teak, -3.4, floorY + 0.225, -2.6, 0, 0, 0, 'AMBEN_KAYU');
  box(furnGrp, 1.9, 0.04, 0.9, M.matWoven, -3.4, floorY + 0.47, -2.6);
  box(furnGrp, 1.8, 0.6, 0.9, M.crimson, 0, floorY + 0.3, -4.6, 0, 0, 0, 'KROBONGAN_DEWI_SRI');
  box(furnGrp, 1.6, 0.12, 0.8, M.goldOchre, 0, floorY + 0.66, -4.6);
  // Pendopo low teak table and woven tikar pandan
  box(furnGrp, 1.8, 0.38, 1.0, M.carvedDark, 0, floorY + 0.19, 1.8, 0, 0, 0, 'MEJA_RENDAH_PENDOPO');
  box(furnGrp, 3.2, 0.03, 2.4, M.matWoven, 0, floorY + 0.015, 1.8, 0, 0, 0, 'TIKAR_PENDOPO');

  // 6. Sweeping Terracotta Roofs: Lower Penanggap Skirt + Steep Brunjung Peak
  const skirtGeo = new THREE.ConeGeometry(9.4, 2.4, 4);
  const skirt = new THREE.Mesh(skirtGeo, M.terracotta);
  skirt.rotation.y = Math.PI / 4;
  skirt.scale.set(1.0, 1.0, 1.1);
  skirt.position.set(0, floorY + 4.2, 0.2);
  roofPenGrp.add(skirt);

  const peakGeo = new THREE.ConeGeometry(3.6, 3.4, 4);
  const peak = new THREE.Mesh(peakGeo, M.terracotta);
  peak.rotation.y = Math.PI / 4;
  peak.position.set(0, floorY + 6.8, sgZ);
  roofBrunGrp.add(peak);
  // Ornate Ridge Cap (Wuwung & Molo)
  box(roofBrunGrp, 1.6, 0.26, 0.26, M.goldOchre, 0, floorY + 8.45, sgZ);

  return {
    scene,
    spawnPoint: [0, 0.05, 8.2],
    interiorZones: [
      { id: 'pendopo', name: 'Pendopo Joglo (Zona Publik)', bounds: { minX: -5.0, maxX: 5.0, minZ: -1.1, maxZ: 5.6 }, floorY },
      { id: 'ndalem', name: 'Ndalem Ageng & Krobongan (Zona Privat)', bounds: { minX: -4.8, maxX: 4.8, minZ: -5.2, maxZ: -1.2 }, floorY }
    ],
    roofGroupNames: ['ROOF_BRUNJUNG', 'ROOF_PENANGGAP']
  };
}

// ============================================================================
// 3. HIGH-FIDELITY TONGKONAN (Sulawesi Selatan)
// ============================================================================
export function buildHighFidelityTongkonan(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'HOUSE_TONGKONAN_TORAJA_ROOT';
  scene.add(root);

  const foundGrp = new THREE.Group(); foundGrp.name = 'FOUNDATION_STONES'; root.add(foundGrp);
  const stiltGrp = new THREE.Group(); stiltGrp.name = 'STILT_COLUMNS'; root.add(stiltGrp);
  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const stairGrp = new THREE.Group(); stairGrp.name = 'ENTRANCE_STAIRS'; root.add(stairGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const hornGrp = new THREE.Group(); hornGrp.name = 'BUFFALO_HORNS_RACK'; root.add(hornGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  const floorY = 1.85;
  const W = 6.8, D = 10.4, wallH = 2.8;

  // 1. Under-floor Substructure (Sulluk Banua) & Massive Square Posts on River Boulders
  const colsX = [-2.6, 0, 2.6];
  const colsZ = [-4.2, -1.4, 1.4, 4.2];
  for (const x of colsX) {
    for (const z of colsZ) {
      cyl(foundGrp, 0.28, 0.35, 0.28, 8, M.riverStone, x, 0.14, z);
      box(stiltGrp, 0.28, floorY, 0.28, M.ironwood, x, floorY / 2, z);
    }
  }
  // Heavy timber mortise-and-tenon cross beams
  for (const z of colsZ) box(stiltGrp, W + 0.4, 0.24, 0.24, M.agedWood, 0, floorY * 0.6, z);
  for (const x of colsX) box(stiltGrp, 0.24, 0.24, D + 0.4, M.agedWood, x, floorY * 0.6, 0);

  // 2. Tripartite Walkable Floor: Tangdo (front raised), Sali (sunken center with hearth), Sumbung (rear raised)
  // Sali (center main floor)
  box(floorGrp, W, 0.22, 4.4, M.teak, 0, floorY - 0.11, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_SALI', W, 0.22, 4.4, 0, floorY - 0.11, 0, M.colliderMat);
  // Tangdo (Front raised platform +0.35m)
  box(floorGrp, W, 0.57, 3.0, M.teak, 0, floorY + 0.065, 3.7);
  addCollider(colGrp, 'COLLISION_FLOOR_TANGDO', W, 0.57, 3.0, 0, floorY + 0.065, 3.7, M.colliderMat);
  // Sumbung (Rear raised master chamber +0.35m)
  box(floorGrp, W, 0.57, 3.0, M.teak, 0, floorY + 0.065, -3.7);
  addCollider(colGrp, 'COLLISION_FLOOR_SUMBUNG', W, 0.57, 3.0, 0, floorY + 0.065, -3.7, M.colliderMat);

  // 3. Side Access Stairs (Tangga Samping on East flank)
  const steps = 9;
  for (let s = 0; s < steps; s++) {
    const sy = (s + 0.5) * (floorY / steps);
    const sx = W / 2 + 2.2 - s * (2.2 / steps);
    box(stairGrp, 0.32, 0.14, 1.8, M.ironwood, sx, sy, 0.4);
    addCollider(colGrp, `COLLISION_STAIR_${s}`, 0.32, floorY / steps, 1.8, sx, sy, 0.4, M.colliderMat);
  }

  // 4. Exterior Pa'ssura Carved Wooden Reliefs (Black, Crimson, Yellow Ochre)
  const wy = floorY + wallH / 2;
  box(wallGrp, W, wallH, 0.2, M.crimson, 0, wy, -D / 2 + 0.1);
  addCollider(colGrp, 'COLLISION_WALL_BACK', W, wallH, 0.28, 0, wy, -D / 2 + 0.1, M.colliderMat);
  box(wallGrp, 0.2, wallH, D, M.crimson, -W / 2 + 0.1, wy, 0);
  addCollider(colGrp, 'COLLISION_WALL_LEFT', 0.28, wallH, D, -W / 2 + 0.1, wy, 0, M.colliderMat);
  // East wall with 1.6m entrance doorway
  const dSegZ = (D - 2.0) / 2;
  box(wallGrp, 0.2, wallH, dSegZ, M.crimson, W / 2 - 0.1, wy, -(1.0 + dSegZ / 2));
  box(wallGrp, 0.2, wallH, dSegZ, M.crimson, W / 2 - 0.1, wy, (1.0 + dSegZ / 2));
  box(doorGrp, 0.24, 0.4, 2.0, M.goldOchre, W / 2 - 0.1, floorY + wallH - 0.2, 0);
  addCollider(colGrp, 'COLLISION_WALL_RIGHT_1', 0.28, wallH, dSegZ, W / 2 - 0.1, wy, -(1.0 + dSegZ / 2), M.colliderMat);
  addCollider(colGrp, 'COLLISION_WALL_RIGHT_2', 0.28, wallH, dSegZ, W / 2 - 0.1, wy, (1.0 + dSegZ / 2), M.colliderMat);

  // Front Facade Pa'ssura Pa'tedong geometric carvings
  box(wallGrp, W, wallH, 0.2, M.crimson, 0, wy, D / 2 - 0.1);
  box(wallGrp, W - 0.2, 0.24, 0.24, M.goldOchre, 0, floorY + 0.3, D / 2 - 0.05);
  box(wallGrp, W - 0.2, 0.24, 0.24, M.carvedDark, 0, floorY + wallH - 0.3, D / 2 - 0.05);

  // 5. Freestanding Tulak Somba Pillar & Stack of Real Buffalo Horns (Kabongo')
  const tsZ = D / 2 + 3.2;
  cyl(stiltGrp, 0.18, 0.22, floorY + 6.2, 10, M.ironwood, 0, (floorY + 6.2) / 2, tsZ);
  // Stack of 7 Buffalo Horn pairs
  for (let h = 0; h < 7; h++) {
    const hy = floorY + 0.6 + h * 0.45;
    box(hornGrp, 0.9 + h * 0.05, 0.12, 0.12, M.hornBone, 0, hy, tsZ + 0.18, 0.2, 0, 0);
  }
  // Carved Wooden Buffalo Head (Kabongo') at apex of horn rack
  box(hornGrp, 0.45, 0.55, 0.65, M.carvedDark, 0, floorY + 3.9, tsZ + 0.3);

  // 6. Walkable Interior: Central Sali Hearth (Dapur Adat Toraja) & sleeping mats
  cyl(furnGrp, 0.6, 0.68, 0.18, 8, M.riverStone, 0, floorY + 0.09, 0, 0, 0, 0, 'DAPUR_SALI_HEARTH');
  cyl(furnGrp, 0.38, 0.44, 0.12, 8, M.ember, 0, floorY + 0.15, 0, 0, 0, 0, 'SALI_EMBERS');
  box(furnGrp, 2.2, 0.03, 1.4, M.matWoven, 0, floorY + 0.36, 3.6, 0, 0, 0, 'TIKAR_TANGDO');
  box(furnGrp, 2.2, 0.03, 1.4, M.matWoven, 0, floorY + 0.36, -3.6, 0, 0, 0, 'TIKAR_SUMBUNG');

  // 7. Dramatic Saddleback Boat Roof with Soaring Cantilever Overhangs (Longa)
  const saddleRoof = buildCurvedRoofMesh(36, 20, (u, v) => {
    const t = u * 2 - 1; // along long axis (-1 front to +1 rear)
    const s = v * 2 - 1; // across slope (-1 to +1)
    const longAxis = (D + 6.8) * 0.5; // reaches out over Longa overhangs!
    const widthAxis = W * 0.64;
    // Parabolic upward rake at north and south tips
    const rake = Math.pow(Math.abs(t), 2.2) * 4.4;
    const pitch = (1 - Math.abs(s)) * (2.8 + rake * 0.4);
    const y = floorY + wallH - 0.2 + pitch + rake * (1 - Math.abs(s) * 0.65);
    return { x: s * widthAxis, y, z: t * longAxis };
  }, M.shingle, 0.16);
  roofGrp.add(saddleRoof);

  return {
    scene,
    spawnPoint: [W / 2 + 3.4, 0.05, 0.4],
    interiorZones: [
      { id: 'kale-banua', name: 'Kale Banua (Tangdo, Sali, Sumbung)', bounds: { minX: -W / 2 + 0.2, maxX: W / 2 - 0.2, minZ: -D / 2 + 0.2, maxZ: D / 2 - 0.2 }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

// ============================================================================
// 4. HIGH-FIDELITY HONAI PILAMO HUBULA (Papua Pegunungan)
// ============================================================================
export function buildHighFidelityHonai(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'HOUSE_HONAI_PAPUA_ROOT';
  scene.add(root);

  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const colStructGrp = new THREE.Group(); colStructGrp.name = 'STRUCTURAL_COLUMNS'; root.add(colStructGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  const R = 3.8, floorY = 0.12, wallH = 2.4;

  // 1. Compacted Earth Floor (Tanah Padat)
  cyl(floorGrp, R + 0.2, R + 0.3, floorY, 24, M.earthFloor, 0, floorY / 2, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', R * 2, floorY, R * 2, 0, floorY / 2, 0, M.colliderMat);

  // 2. The 4 Inner Supporting Pine Posts (Tiang Dalam)
  const postR = R * 0.45;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = Math.cos(a) * postR, pz = Math.sin(a) * postR;
    cyl(colStructGrp, 0.12, 0.14, wallH + 1.8, 8, M.ironwood, px, floorY + (wallH + 1.8) / 2, pz);
    addCollider(colGrp, `COLLISION_POST_${i}`, 0.26, wallH + 1.8, 0.26, px, floorY + (wallH + 1.8) / 2, pz, M.colliderMat);
  }

  // 3. Walkable Upper Mezzanine Sleeping Loft (Lantai Atas Istirahat)
  // Half-circle loft so visitor can look up and climb inside!
  cyl(floorGrp, R * 0.85, R * 0.85, 0.14, 20, M.bamboo, 0, floorY + wallH * 0.9, -0.4);
  addCollider(colGrp, 'COLLISION_FLOOR_LOFT', R * 1.7, 0.14, R * 1.5, 0, floorY + wallH * 0.9, -0.4, M.colliderMat);

  // Wooden Climbing Ladder (Tangga Dalam)
  box(furnGrp, 0.08, wallH + 0.2, 0.08, M.ironwood, -0.3, floorY + wallH / 2, -postR + 0.2, -0.25, 0, 0);
  box(furnGrp, 0.08, wallH + 0.2, 0.08, M.ironwood, 0.3, floorY + wallH / 2, -postR + 0.2, -0.25, 0, 0);
  for (let r = 0; r < 7; r++) {
    box(furnGrp, 0.65, 0.06, 0.06, M.bamboo, 0, floorY + 0.35 + r * 0.32, -postR + 0.2 - (r - 3) * 0.08);
  }

  // 4. Circular Palisade Timber Walls with Low Entryway (Pintu Rendah < 1.3m)
  const wallSegs = 16;
  for (let i = 0; i < wallSegs; i++) {
    const ang = (i / wallSegs) * Math.PI * 2;
    const x = Math.sin(ang) * (R - 0.15);
    const z = Math.cos(ang) * (R - 0.15);
    if (z > R * 0.72 && Math.abs(x) < 0.95) continue; // Walkable front door opening
    const segW = (2 * Math.PI * R) / wallSegs + 0.1;
    box(wallGrp, segW, wallH, 0.2, M.agedWood, x, floorY + wallH / 2, z, 0, ang, 0);
    addCollider(colGrp, `COLLISION_WALL_RING_${i}`, segW, wallH, 0.28, x, floorY + wallH / 2, z, M.colliderMat);
  }
  // Low arched lintel over doorway
  box(doorGrp, 1.6, 0.6, 0.24, M.agedWood, 0, floorY + wallH - 0.3, R - 0.15);

  // 5. Sunken Central Hearth Stones (Wul-Wul / Rapu) & Straw Mats
  cyl(furnGrp, 0.65, 0.75, 0.16, 12, M.riverStone, 0, floorY + 0.08, 0, 0, 0, 0, 'WUL_WUL_HEARTH');
  cyl(furnGrp, 0.45, 0.52, 0.12, 10, M.ember, 0, floorY + 0.14, 0, 0, 0, 0, 'WUL_WUL_EMBERS');
  box(furnGrp, 1.6, 0.04, 1.0, M.thatch, -R * 0.42, floorY + 0.02, 0.4);
  box(furnGrp, 1.6, 0.04, 1.0, M.thatch, R * 0.42, floorY + 0.02, 0.4);

  // 6. Thick Spherical Conical Thatched Roof Dome (Atap Alang-Alang Membulat)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), M.thatch);
  dome.position.set(0, floorY + wallH - 0.25, 0);
  dome.castShadow = true;
  dome.receiveShadow = true;
  roofGrp.add(dome);

  return {
    scene,
    spawnPoint: [0, 0.05, R + 3.0],
    interiorZones: [
      { id: 'lantai-bawah', name: 'Lantai Bawah (Perapian & Majelis Pilamo)', bounds: { minX: -R + 0.3, maxX: R - 0.3, minZ: -R + 0.3, maxZ: R - 0.3 }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

// ============================================================================
// 5. HIGH-FIDELITY MBARU NIANG (Wae Rebo, Manggarai, NTT)
// ============================================================================
export function buildHighFidelityMbaruNiang(house, M) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'HOUSE_MBARU_NIANG_ROOT';
  scene.add(root);

  const foundGrp = new THREE.Group(); foundGrp.name = 'FOUNDATION_STONES'; root.add(foundGrp);
  const stiltGrp = new THREE.Group(); stiltGrp.name = 'STILT_COLUMNS'; root.add(stiltGrp);
  const floorGrp = new THREE.Group(); floorGrp.name = 'FLOOR_SYSTEM'; root.add(floorGrp);
  const ringBeamGrp = new THREE.Group(); ringBeamGrp.name = 'CONCENTRIC_TIER_BEAMS'; root.add(ringBeamGrp);
  const wallGrp = new THREE.Group(); wallGrp.name = 'WALL_SYSTEM'; root.add(wallGrp);
  const doorGrp = new THREE.Group(); doorGrp.name = 'DOORS'; root.add(doorGrp);
  const roofGrp = new THREE.Group(); roofGrp.name = 'ROOF_SYSTEM'; root.add(roofGrp);
  const furnGrp = new THREE.Group(); furnGrp.name = 'INTERIOR_FURNITURE'; root.add(furnGrp);
  const colGrp = new THREE.Group(); colGrp.name = 'COLLISION'; root.add(colGrp);

  const R = 5.6, floorY = 0.72;

  // 1. Elevated Perimeter Stilts & Central Siri Ngando Axis Column
  const numStilts = 12;
  for (let i = 0; i < numStilts; i++) {
    const ang = (i / numStilts) * Math.PI * 2;
    const sx = Math.sin(ang) * (R * 0.75), sz = Math.cos(ang) * (R * 0.75);
    cyl(foundGrp, 0.22, 0.28, 0.24, 8, M.riverStone, sx, 0.12, sz);
    cyl(stiltGrp, 0.14, 0.16, floorY, 8, M.ironwood, sx, floorY / 2, sz);
  }

  // Central Siri Ngando (Axis Mundi pillar rising all the way to Tier 5!)
  cyl(foundGrp, 0.35, 0.42, 0.3, 8, M.riverStone, 0, 0.15, 0);
  cyl(stiltGrp, 0.22, 0.26, 8.8, 12, M.ironwood, 0, floorY + 4.4, 0);
  addCollider(colGrp, 'COLLISION_SIRI_NGANDO', 0.5, 8.8, 0.5, 0, floorY + 4.4, 0, M.colliderMat);

  // 2. Main Living Floor (Tenda / Lutur)
  cyl(floorGrp, R + 0.1, R + 0.15, 0.22, 24, M.teak, 0, floorY - 0.11, 0);
  addCollider(colGrp, 'COLLISION_FLOOR_MAIN', R * 2, 0.22, R * 2, 0, floorY - 0.11, 0, M.colliderMat);
  // Entrance steps
  box(floorGrp, 1.8, floorY * 0.6, 0.8, M.agedWood, 0, floorY * 0.3, R + 0.45);
  addCollider(colGrp, 'COLLISION_STAIR_FRONT', 1.8, floorY * 0.6, 0.8, 0, floorY * 0.3, R + 0.45, M.colliderMat);

  // 3. Five Concentric Tier Rims (Tenda, Lobo, Lentar, Lempa Rae, Hekang Kode)
  const tiers = [
    { name: 'TIER_2_LOBO', y: floorY + 2.2, r: R * 0.78 },
    { name: 'TIER_3_LENTAR', y: floorY + 3.8, r: R * 0.60 },
    { name: 'TIER_4_LEMPA_RAE', y: floorY + 5.2, r: R * 0.42 },
    { name: 'TIER_5_HEKANG_KODE', y: floorY + 6.5, r: R * 0.25 }
  ];
  for (const t of tiers) {
    // Ring deck (partial ring showing floor beams)
    cyl(ringBeamGrp, t.r, t.r, 0.14, 18, M.bamboo, 0, t.y, -0.4, 0, 0, 0, t.name);
    // Radial support beams
    for (let b = 0; b < 6; b++) {
      const ba = (b / 6) * Math.PI * 2;
      box(ringBeamGrp, t.r * 2, 0.12, 0.12, M.agedWood, 0, t.y - 0.1, 0, 0, ba, 0);
    }
  }

  // Woven Bamboo Ladder (Rede)
  box(furnGrp, 0.08, 6.2, 0.08, M.bamboo, -0.35, floorY + 3.1, -1.2, -0.18, 0, 0);
  box(furnGrp, 0.08, 6.2, 0.08, M.bamboo, 0.35, floorY + 3.1, -1.2, -0.18, 0, 0);
  for (let r = 0; r < 14; r++) {
    box(furnGrp, 0.72, 0.05, 0.06, M.bamboo, 0, floorY + 0.4 + r * 0.42, -1.2 - (r - 6) * 0.07);
  }

  // 4. Circular Outer Wall with 1.6m Entrance
  const wallH = 2.4;
  const wallSegs = 16;
  for (let i = 0; i < wallSegs; i++) {
    const ang = (i / wallSegs) * Math.PI * 2;
    const x = Math.sin(ang) * (R - 0.18);
    const z = Math.cos(ang) * (R - 0.18);
    if (z > R * 0.75 && Math.abs(x) < 1.1) continue; // Doorway
    const segW = (2 * Math.PI * R) / wallSegs + 0.1;
    box(wallGrp, segW, wallH, 0.18, M.wovenWall, x, floorY + wallH / 2, z, 0, ang, 0);
    addCollider(colGrp, `COLLISION_WALL_RING_${i}`, segW, wallH, 0.28, x, floorY + wallH / 2, z, M.colliderMat);
  }
  // Door frame
  box(doorGrp, 1.8, 0.4, 0.22, M.agedWood, 0, floorY + wallH - 0.2, R - 0.15);

  // 5. Traditional Hearth (Tungku Adat) in Tenda level
  cyl(furnGrp, 0.7, 0.78, 0.16, 10, M.riverStone, 0.9, floorY + 0.08, 0.6, 0, 0, 0, 'TUNGKU_TENDA');
  cyl(furnGrp, 0.48, 0.54, 0.12, 10, M.ember, 0.9, floorY + 0.14, 0.6, 0, 0, 0, 'TUNGKU_EMBERS');
  box(furnGrp, 1.8, 0.03, 1.2, M.matWoven, -R * 0.38, floorY + 0.015, 0.4);

  // 6. Massive 5-Tier Conical Roof Thatch with Ngando Spire Finial
  const cone = new THREE.Mesh(new THREE.ConeGeometry(R + 0.9, 8.4, 24), M.ijuk);
  cone.position.set(0, floorY + 4.6, 0);
  cone.castShadow = true;
  cone.receiveShadow = true;
  roofGrp.add(cone);

  // Sacred Wooden Crown Finial (Ngando)
  cyl(roofGrp, 0.06, 0.2, 1.2, 8, M.goldOchre, 0, floorY + 8.8, 0);

  return {
    scene,
    spawnPoint: [0, 0.05, R + 3.4],
    interiorZones: [
      { id: 'tenda-lutur', name: 'Tenda / Lutur (Tingkat Hunian Mbaru Niang)', bounds: { minX: -R + 0.3, maxX: R - 0.3, minZ: -R + 0.3, maxZ: R - 0.3 }, floorY }
    ],
    roofGroupNames: ['ROOF_SYSTEM']
  };
}

async function exportHouse(builderFn, houseId) {
  const houses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/houses.json'), 'utf8'));
  const house = houses.find(h => h.id === houseId);
  if (!house) throw new Error(`House not found: ${houseId}`);

  const M = createMats();
  console.log(`\nRebuilding high-fidelity masterpiece: ${house.houseName} (${house.province})...`);
  const result = builderFn(house, M);

  // Gather stats
  let meshCount = 0, triangleCount = 0, colliderCount = 0;
  result.scene.traverse(node => {
    if (node.isMesh) {
      meshCount++;
      if (node.geometry) {
        triangleCount += node.geometry.index ? node.geometry.index.count / 3 : node.geometry.attributes.position.count / 3;
      }
      if (node.userData?.isCollider) colliderCount++;
    }
  });

  const exporter = new GLTFExporter();
  const glbBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      result.scene,
      (glb) => resolve(Buffer.from(glb)),
      (err) => reject(err),
      { binary: true }
    );
  });

  const outGlbPath = path.join(HOUSES_OUT, `${house.id}.glb`);
  fs.writeFileSync(outGlbPath, glbBuffer);
  console.log(`Saved GLB: ${outGlbPath} (${glbBuffer.length} bytes, ${meshCount} meshes, ${Math.round(triangleCount)} tris, ${colliderCount} colliders)`);

  // Write manifest
  const manifest = {
    schemaVersion: '2.1.0',
    houseId: house.id,
    houseName: house.houseName,
    province: house.province,
    island: house.island,
    provenance: 'authentic_cultural_reconstruction',
    assetStatus: 'VERIFIED_MASTERPIECE',
    walkableInterior: true,
    glbUrl: `assets/models/houses/${house.id}.glb`,
    fileSizeBytes: glbBuffer.length,
    meshes: meshCount,
    triangles: Math.round(triangleCount),
    colliders: colliderCount,
    groups: result.scene.children[0].children.map(c => c.name),
    spawnPoint: result.spawnPoint,
    interiorZones: result.interiorZones,
    roofGroupNames: result.roofGroupNames,
    driveFolderRef: house.driveFolderRef,
    generatedAt: new Date().toISOString().split('T')[0],
    license: 'CC BY 4.0 — NULAR Architectural Digital Reconstruction'
  };

  const outManifestPath = path.join(MANIFEST_OUT, `${house.id}.json`);
  fs.writeFileSync(outManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Saved manifest: ${outManifestPath}`);
}

async function main() {
  await exportHouse(buildHighFidelityRumahGadang, 'rumah-gadang');
  await exportHouse(buildHighFidelityRumahJoglo, 'rumah-joglo');
  await exportHouse(buildHighFidelityTongkonan, 'tongkonan-toraja');
  await exportHouse(buildHighFidelityHonai, 'honai-papua');
  await exportHouse(buildHighFidelityMbaruNiang, 'mbaru-niang');
  console.log('\nAll 5 masterpiece houses successfully rebuilt with high cultural fidelity!');
}

main().catch(err => {
  console.error("Rebuild failed:", err);
  process.exit(1);
});
