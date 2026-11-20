/**
 * NULAR — Nusa Learn Architectural 3D Model Generator
 * Authors original, architecturally researched, multi-component binary glTF (.glb) models
 * for the NULAR 3D Nusantara Architecture Museum.
 *
 * License: CC BY 4.0 — NULAR Architectural Preservation Studio
 * Models generated:
 *   1. assets/models/rumah-gadang.glb (Minangkabau, Sumatera Barat)
 *   2. assets/models/tongkonan-toraja.glb (Toraja, Sulawesi Selatan)
 *   3. assets/models/rumah-joglo.glb (Jawa Tengah / DI Yogyakarta)
 *   4. assets/models/honai-papua.glb (Lembah Baliem, Papua Pegunungan)
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../js/vendor/three/build/three.module.js';
import { GLTFExporter } from '../js/vendor/three/exporters/GLTFExporter.js';

// Minimal FileReader polyfill for Node.js so Three.js GLTFExporter outputs clean binary GLB
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
        if (typeof this.onload === 'function') this.onload({ target: this });
      }).catch((err) => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
        if (typeof this.onload === 'function') this.onload({ target: this });
      }).catch((err) => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
    }
  };
}

// ============================================================================
// MATERIAL PALETTE (Tactile Architectural Museum PBR Materials)
// ============================================================================
function createMaterials() {
  return {
    darkIronwood: new THREE.MeshStandardMaterial({ color: 0x3b2619, roughness: 0.82, metalness: 0.04 }),
    warmTeak: new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.72, metalness: 0.05 }),
    agedTimber: new THREE.MeshStandardMaterial({ color: 0x523421, roughness: 0.78, metalness: 0.04 }),
    carvedPanelDark: new THREE.MeshStandardMaterial({ color: 0x2a1911, roughness: 0.75, metalness: 0.06 }),
    crimsonLacquer: new THREE.MeshStandardMaterial({ color: 0x7a241c, roughness: 0.65, metalness: 0.08 }),
    ochreGold: new THREE.MeshStandardMaterial({ color: 0xc59a45, roughness: 0.52, metalness: 0.25 }),
    bronzeAccent: new THREE.MeshStandardMaterial({ color: 0x9c7a4c, roughness: 0.42, metalness: 0.45 }),
    boneWhite: new THREE.MeshStandardMaterial({ color: 0xe8dfd0, roughness: 0.82, metalness: 0.02 }),
    ijukThatch: new THREE.MeshStandardMaterial({ color: 0x262321, roughness: 0.94, metalness: 0.02 }),
    bambooRoof: new THREE.MeshStandardMaterial({ color: 0x4b4439, roughness: 0.88, metalness: 0.02 }),
    grassThatch: new THREE.MeshStandardMaterial({ color: 0x9b8356, roughness: 0.95, metalness: 0.0 }),
    grassThatchDark: new THREE.MeshStandardMaterial({ color: 0x7d6741, roughness: 0.95, metalness: 0.0 }),
    terracottaTile: new THREE.MeshStandardMaterial({ color: 0x9b4d33, roughness: 0.78, metalness: 0.04 }),
    terracottaRidge: new THREE.MeshStandardMaterial({ color: 0x7c3823, roughness: 0.74, metalness: 0.05 }),
    riverStone: new THREE.MeshStandardMaterial({ color: 0x7a766e, roughness: 0.92, metalness: 0.02 }),
    andesiteStone: new THREE.MeshStandardMaterial({ color: 0x4c4a46, roughness: 0.88, metalness: 0.04 }),
    terracottaFloor: new THREE.MeshStandardMaterial({ color: 0xb88f6a, roughness: 0.84, metalness: 0.02 }),
    earthFloor: new THREE.MeshStandardMaterial({ color: 0x6e5a47, roughness: 0.96, metalness: 0.0 }),
    emberGlow: new THREE.MeshStandardMaterial({ color: 0xc85527, emissive: 0x6a2208, roughness: 0.7, metalness: 0.0 }),
    rattanRope: new THREE.MeshStandardMaterial({ color: 0xb49663, roughness: 0.88, metalness: 0.0 }),
    tinFinial: new THREE.MeshStandardMaterial({ color: 0xbfb8a8, roughness: 0.35, metalness: 0.65 })
  };
}

function addBox(parent, w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

function addCyl(parent, rt, rb, h, segs, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

/**
 * Helper: Build a smooth lofted double-sided curved roof surface (saddle/gonjong/boat)
 */
function buildCurvedRoofGeometry(uSegs, vSegs, evalPoint) {
  const positions = [];
  const indices = [];

  // Top & underside with real thickness so roof looks solid from any orbit angle
  const thickness = 0.09;

  for (let layer = 0; layer < 2; layer++) {
    const yOffset = layer === 0 ? 0 : -thickness;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs; // 0..1 along length (X)
      for (let iv = 0; iv <= vSegs; iv++) {
        const v = iv / vSegs; // 0..1 across width (Z, from -1 to +1)
        const p = evalPoint(u, v);
        positions.push(p.x, p.y + yOffset, p.z);
      }
    }
  }

  const stride = vSegs + 1;
  const layerSize = (uSegs + 1) * stride;

  // Top surface
  for (let iu = 0; iu < uSegs; iu++) {
    for (let iv = 0; iv < vSegs; iv++) {
      const a = iu * stride + iv;
      const b = (iu + 1) * stride + iv;
      const c = (iu + 1) * stride + (iv + 1);
      const d = iu * stride + (iv + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  // Bottom surface (reversed winding)
  for (let iu = 0; iu < uSegs; iu++) {
    for (let iv = 0; iv < vSegs; iv++) {
      const a = layerSize + iu * stride + iv;
      const b = layerSize + (iu + 1) * stride + iv;
      const c = layerSize + (iu + 1) * stride + (iv + 1);
      const d = layerSize + iu * stride + (iv + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  // Stitch perimeter edges
  for (let iu = 0; iu < uSegs; iu++) {
    // iv = 0 edge
    const t0 = iu * stride;
    const t1 = (iu + 1) * stride;
    const b0 = layerSize + t0;
    const b1 = layerSize + t1;
    indices.push(t0, t1, b0, b0, t1, b1);

    // iv = vSegs edge
    const te0 = iu * stride + vSegs;
    const te1 = (iu + 1) * stride + vSegs;
    const be0 = layerSize + te0;
    const be1 = layerSize + te1;
    indices.push(te0, be0, te1, te1, be0, be1);
  }
  for (let iv = 0; iv < vSegs; iv++) {
    // iu = 0 edge
    const t0 = iv;
    const t1 = iv + 1;
    const b0 = layerSize + t0;
    const b1 = layerSize + t1;
    indices.push(t0, b0, t1, t1, b0, b1);

    // iu = uSegs edge
    const te0 = uSegs * stride + iv;
    const te1 = uSegs * stride + iv + 1;
    const be0 = layerSize + te0;
    const be1 = layerSize + te1;
    indices.push(te0, te1, be0, be0, te1, be1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// 1. RUMAH GADANG (Minangkabau, Sumatera Barat)
// ============================================================================
function buildRumahGadang() {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'RumahGadang_Root';

  const gSandi = new THREE.Group(); gSandi.name = 'batu_sandi';
  const gTiang = new THREE.Group(); gTiang.name = 'tiang_tonggak';
  const gLantai = new THREE.Group(); gLantai.name = 'lantai_panggung';
  const gDinding = new THREE.Group(); gDinding.name = 'dinding_ukir';
  const gPintu = new THREE.Group(); gPintu.name = 'pintu_jendela';
  const gTangga = new THREE.Group(); gTangga.name = 'tangga_janjang';
  const gSingok = new THREE.Group(); gSingok.name = 'perabung_singok';
  const gAtap = new THREE.Group(); gAtap.name = 'atap_gonjong';

  // Column grid: 7 bays across X (-3.6..3.6), 4 rows across Z (-1.5..1.5)
  const xs = [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6];
  const zs = [-1.4, -0.45, 0.45, 1.4];

  // 1. Batu Sandi (river stone pads) + 2. Tiang Tonggak (slanted stilt pillars)
  for (const x of xs) {
    for (const z of zs) {
      // River stone base pad
      addCyl(gSandi, 0.16, 0.21, 0.16, 8, M.riverStone, x, 0.08, z);

      // Slight outward slant characteristic of Minangkabau seismic stilts
      const tiltX = x === 0 ? 0 : Math.sign(x) * 0.04;
      const tiltZ = Math.sign(z) * 0.04;
      addCyl(gTiang, 0.085, 0.10, 1.48, 8, M.darkIronwood, x, 0.88, z, tiltZ, 0, -tiltX);
    }
  }
  // Horizontal kolong tie beams (rasuak & palanca)
  for (const z of zs) {
    addBox(gTiang, 7.5, 0.11, 0.11, M.agedTimber, 0, 1.46, z);
    addBox(gTiang, 7.3, 0.08, 0.08, M.darkIronwood, 0, 0.72, z);
  }
  for (const x of xs) {
    addBox(gTiang, 0.11, 0.11, 3.05, M.agedTimber, x, 1.54, 0);
  }

  // 3. Lantai Panggung (elevated floor deck + raised flanking anjung platforms)
  addBox(gLantai, 7.7, 0.14, 3.25, M.warmTeak, 0, 1.66, 0);
  // Decorative perimeter floor fascia beam
  addBox(gLantai, 7.82, 0.16, 0.08, M.crimsonLacquer, 0, 1.66, 1.63);
  addBox(gLantai, 7.82, 0.16, 0.08, M.crimsonLacquer, 0, 1.66, -1.63);
  // Flanking raised Anjung step platforms
  addBox(gLantai, 1.35, 0.18, 3.35, M.agedTimber, -3.35, 1.78, 0);
  addBox(gLantai, 1.35, 0.18, 3.35, M.agedTimber, 3.35, 1.78, 0);

  // 4. Dinding Ukir (characteristic outward-canted trapezoidal walls!)
  const wallH = 1.65;
  const wallY = 1.73 + wallH / 2;
  // Front & back canted walls
  addBox(gDinding, 7.75, wallH, 0.12, M.carvedPanelDark, 0, wallY, 1.62, 0.11, 0, 0);
  addBox(gDinding, 7.75, wallH, 0.12, M.carvedPanelDark, 0, wallY, -1.62, -0.11, 0, 0);
  // Left & right end walls (canted outward like a ship hull)
  addBox(gDinding, 0.14, wallH + 0.15, 3.45, M.carvedPanelDark, -3.92, wallY + 0.05, 0, 0, 0, 0.13);
  addBox(gDinding, 0.14, wallH + 0.15, 3.45, M.carvedPanelDark, 3.92, wallY + 0.05, 0, 0, 0, -0.13);

  // Carved horizontal Minangkabau ornamental bands (crimson, ochre-gold, dark timber)
  addBox(gDinding, 7.9, 0.18, 0.16, M.crimsonLacquer, 0, 2.02, 1.65, 0.11, 0, 0);
  addBox(gDinding, 7.98, 0.12, 0.17, M.ochreGold, 0, 2.20, 1.67, 0.11, 0, 0);
  addBox(gDinding, 8.12, 0.22, 0.16, M.crimsonLacquer, 0, 3.22, 1.77, 0.11, 0, 0);
  addBox(gDinding, 8.16, 0.09, 0.17, M.ochreGold, 0, 3.35, 1.79, 0.11, 0, 0);

  // Vertical carved pilasters on front facade
  for (const x of [-3.6, -2.4, -1.2, 1.2, 2.4, 3.6]) {
    addBox(gDinding, 0.13, wallH + 0.04, 0.16, M.ochreGold, x, wallY, 1.68, 0.11, 0, 0);
  }

  // 5. Pintu & Jendela (Carved entrance door + 6 shuttered wooden windows)
  // Central ceremonial doorway frame
  addBox(gPintu, 0.96, 1.32, 0.18, M.warmTeak, 0, 2.42, 1.70, 0.11, 0, 0);
  addBox(gPintu, 0.72, 1.15, 0.20, M.darkIronwood, 0, 2.38, 1.73, 0.11, 0, 0);
  addBox(gPintu, 0.86, 0.12, 0.22, M.ochreGold, 0, 3.06, 1.78, 0.11, 0, 0);

  // 6 Shuttered traditional windows with balusters
  for (const wx of [-3.0, -1.8, -0.65, 0.65, 1.8, 3.0]) {
    if (Math.abs(wx) < 0.8) continue;
    addBox(gPintu, 0.66, 0.82, 0.18, M.ochreGold, wx, 2.66, 1.72, 0.11, 0, 0);
    addBox(gPintu, 0.52, 0.68, 0.20, M.darkIronwood, wx, 2.66, 1.74, 0.11, 0, 0);
    // Open twin wooden shutters
    addBox(gPintu, 0.24, 0.68, 0.05, M.crimsonLacquer, wx - 0.36, 2.66, 1.82, 0.11, 0.35, 0);
    addBox(gPintu, 0.24, 0.68, 0.05, M.crimsonLacquer, wx + 0.36, 2.66, 1.82, 0.11, -0.35, 0);
  }

  // 6. Tangga Janjang (Front ceremonial porch & stepped stairs)
  // Porch deck + support stilts + stone pads
  addCyl(gTangga, 0.12, 0.15, 0.14, 8, M.riverStone, -0.78, 0.07, 2.55);
  addCyl(gTangga, 0.12, 0.15, 0.14, 8, M.riverStone, 0.78, 0.07, 2.55);
  addCyl(gTangga, 0.075, 0.085, 3.05, 8, M.darkIronwood, -0.78, 1.62, 2.55);
  addCyl(gTangga, 0.075, 0.085, 3.05, 8, M.darkIronwood, 0.78, 1.62, 2.55);
  addBox(gTangga, 1.82, 0.14, 1.05, M.warmTeak, 0, 1.66, 2.15);
  // Porch railing
  addBox(gTangga, 0.08, 0.58, 0.92, M.crimsonLacquer, -0.82, 2.02, 2.15);
  addBox(gTangga, 0.08, 0.58, 0.92, M.crimsonLacquer, 0.82, 2.02, 2.15);
  // 7 Stair treads stepping down forward
  for (let i = 0; i < 7; i++) {
    const sy = 0.20 + i * 0.21;
    const sz = 3.55 - i * 0.16;
    addBox(gTangga, 1.12, 0.07, 0.20, M.warmTeak, 0, sy, sz);
  }
  // Stair stringers & handrails
  addBox(gTangga, 0.09, 0.14, 1.95, M.darkIronwood, -0.58, 0.86, 3.08, 0.86, 0, 0);
  addBox(gTangga, 0.09, 0.14, 1.95, M.darkIronwood, 0.58, 0.86, 3.08, 0.86, 0, 0);
  addBox(gTangga, 0.06, 0.08, 1.95, M.ochreGold, -0.58, 1.38, 3.08, 0.86, 0, 0);
  addBox(gTangga, 0.06, 0.08, 1.95, M.ochreGold, 0.58, 1.38, 3.08, 0.86, 0, 0);

  // 7. Perabung & Singok (Triangular decorative gable infill + main ridge spine)
  // Left & right Singok triangles
  const singokShape = new THREE.Shape();
  singokShape.moveTo(-1.85, 0);
  singokShape.lineTo(1.85, 0);
  singokShape.lineTo(0, 2.45);
  singokShape.closePath();
  const singokGeo = new THREE.ExtrudeGeometry(singokShape, { depth: 0.12, bevelEnabled: false });
  const leftSingok = new THREE.Mesh(singokGeo, M.crimsonLacquer);
  leftSingok.rotation.y = Math.PI / 2;
  leftSingok.position.set(-4.15, 3.38, 0);
  gSingok.add(leftSingok);
  const rightSingok = new THREE.Mesh(singokGeo, M.crimsonLacquer);
  rightSingok.rotation.y = -Math.PI / 2;
  rightSingok.position.set(4.15, 3.38, 0);
  gSingok.add(rightSingok);

  // Decorative gold singok trim triangles
  addBox(gSingok, 0.18, 0.14, 3.65, M.ochreGold, -4.16, 3.40, 0);
  addBox(gSingok, 0.18, 0.14, 3.65, M.ochreGold, 4.16, 3.40, 0);

  // 8. Atap Gonjong (Iconic swooping multi-spired buffalo-horn saddle roof!)
  // Main 4-gonjong stepped saddle roof (outer main sweep + inner nested sweep + front porch gonjong!)
  const mainRoofGeo = buildCurvedRoofGeometry(44, 18, (u, v) => {
    const s = u * 2 - 1; // -1..1 along X
    const t = v * 2 - 1; // -1..1 across Z
    const absS = Math.abs(s);
    const absT = Math.abs(t);

    // Sweeping dramatic horn curve along X, curving sharply upward at the tips!
    const ridgeHeight = 4.95 + Math.pow(absS, 2.35) * 2.55;
    const eaveHeight = 3.22 + Math.pow(absS, 2.1) * 0.85;
    // Concave downward swoop from ridge (t=0) to eaves (|t|=1)
    const y = eaveHeight + (ridgeHeight - eaveHeight) * Math.pow(1 - absT, 1.48);

    // Roof flares wider in X toward the upper horns (classic buffalo-horn overhang)
    const halfLen = 4.35 + (1 - absT) * 1.15;
    const halfWid = 2.42 * (1 - 0.12 * (1 - absT));

    return { x: s * halfLen, y, z: t * halfWid };
  });
  const mainRoofMesh = new THREE.Mesh(mainRoofGeo, M.ijukThatch);
  gAtap.add(mainRoofMesh);

  // Secondary inner stepped Gonjong tier (gives authentic multi-spire Minangkabau silhouette: 4 main spires!)
  const innerRoofGeo = buildCurvedRoofGeometry(32, 14, (u, v) => {
    const s = u * 2 - 1;
    const t = v * 2 - 1;
    const absS = Math.abs(s);
    const absT = Math.abs(t);
    const ridgeHeight = 5.35 + Math.pow(absS, 2.2) * 1.95;
    const eaveHeight = 3.75 + Math.pow(absS, 1.9) * 0.55;
    const y = eaveHeight + (ridgeHeight - eaveHeight) * Math.pow(1 - absT, 1.45);
    const halfLen = 2.35 + (1 - absT) * 0.72;
    const halfWid = 1.95 * (1 - 0.1 * (1 - absT));
    return { x: s * halfLen, y, z: t * halfWid };
  });
  gAtap.add(new THREE.Mesh(innerRoofGeo, M.ijukThatch));

  // Front Porch Gonjong (Bagonjong entrance canopy jutting forward over stairs!)
  const porchRoofGeo = buildCurvedRoofGeometry(20, 12, (u, v) => {
    const s = u; // 0 (attached to wall) -> 1 (front tip)
    const t = v * 2 - 1; // -1..1 across X
    const absT = Math.abs(t);
    const ridgeHeight = 4.25 + Math.pow(s, 2.1) * 1.35;
    const eaveHeight = 3.15 + Math.pow(s, 1.8) * 0.25;
    const y = eaveHeight + (ridgeHeight - eaveHeight) * Math.pow(1 - absT, 1.4);
    const z = 1.45 + s * (1.55 + (1 - absT) * 0.45);
    const x = t * 1.25;
    return { x, y, z };
  });
  gAtap.add(new THREE.Mesh(porchRoofGeo, M.ijukThatch));

  // Pointed metallic/tin Gonjong spire finials (5 iconic tips)
  const spirePoints = [
    [-5.48, 7.62, 0, 0, 0, 0.28],
    [5.48, 7.62, 0, 0, 0, -0.28],
    [-3.05, 7.42, 0, 0, 0, 0.22],
    [3.05, 7.42, 0, 0, 0, -0.22],
    [0, 5.72, 3.45, 0.26, 0, 0]
  ];
  for (const [sx, sy, sz, rx, ry, rz] of spirePoints) {
    addCyl(gAtap, 0.012, 0.08, 0.65, 6, M.tinFinial, sx, sy, sz, rx, ry, rz);
  }

  root.add(gSandi, gTiang, gLantai, gDinding, gPintu, gTangga, gSingok, gAtap);
  return root;
}

// ============================================================================
// 2. TONGKONAN (Toraja, Sulawesi Selatan)
// ============================================================================
function buildTongkonan() {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'Tongkonan_Root';

  const gUmpak = new THREE.Group(); gUmpak.name = 'batu_umpak';
  const gLentong = new THREE.Group(); gLentong.name = 'tiang_lentong';
  const gLantai = new THREE.Group(); gLantai.name = 'lantai_kale_banua';
  const gDinding = new THREE.Group(); gDinding.name = 'dinding_passura';
  const gTulak = new THREE.Group(); gTulak.name = 'tiang_tulak_sombong';
  const gTanduk = new THREE.Group(); gTanduk.name = 'tanduk_kabongo';
  const gAtap = new THREE.Group(); gAtap.name = 'atap_perahu';

  // 1. Batu Umpak + 2. Tiang Lentong (Dense Toraja Sulluk Banua pile forest)
  const xs = [-1.15, -0.38, 0.38, 1.15];
  const zs = [-2.5, -1.65, -0.82, 0, 0.82, 1.65, 2.5];
  for (const x of xs) {
    for (const z of zs) {
      addCyl(gUmpak, 0.12, 0.16, 0.14, 7, M.riverStone, x, 0.07, z);
      addBox(gLentong, 0.11, 1.72, 0.11, M.darkIronwood, x, 0.96, z);
    }
  }
  // Horizontal interconnecting mortise-and-tenon cross beams (Roroan)
  for (const h of [0.55, 1.15, 1.74]) {
    for (const z of zs) addBox(gLentong, 2.55, 0.08, 0.09, M.agedTimber, 0, h, z);
    for (const x of xs) addBox(gLentong, 0.09, 0.08, 5.25, M.agedTimber, x, h + 0.04, 0);
  }

  // 3. Lantai Kale Banua (Main elevated deck + projecting front/rear terraces)
  addBox(gLantai, 2.65, 0.16, 5.55, M.warmTeak, 0, 1.88, 0);
  // Stepped rear & front cantilevered floor sills
  addBox(gLantai, 2.82, 0.14, 0.14, M.crimsonLacquer, 0, 1.92, 2.75);
  addBox(gLantai, 2.82, 0.14, 0.14, M.crimsonLacquer, 0, 1.92, -2.75);

  // 4. Dinding Pa'ssura' (Elevated wooden hull with 4-color Toraja carved bands)
  const bodyH = 1.52;
  const bodyY = 1.96 + bodyH / 2;
  // Core timber hull
  addBox(gDinding, 2.52, bodyH, 5.32, M.carvedPanelDark, 0, bodyY, 0);
  // Iconic four-color Pa'ssura' horizontal relief strips (red, ochre, white, dark) on all 4 facades
  const bandSpecs = [
    { y: 2.15, h: 0.14, mat: M.crimsonLacquer },
    { y: 2.34, h: 0.10, mat: M.ochreGold },
    { y: 2.50, h: 0.08, mat: M.boneWhite },
    { y: 2.95, h: 0.18, mat: M.crimsonLacquer },
    { y: 3.16, h: 0.10, mat: M.ochreGold },
    { y: 3.34, h: 0.09, mat: M.boneWhite }
  ];
  for (const b of bandSpecs) {
    addBox(gDinding, 2.58, b.h, 5.38, b.mat, 0, b.y, 0);
  }
  // Vertical carved panel mullions along sides
  for (const z of [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4]) {
    addBox(gDinding, 2.62, bodyH, 0.09, M.darkIronwood, 0, bodyY, z);
  }
  // Slanted gable upper fascia front & rear (characteristic stepped Toraja triangular front)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-1.32, 0);
  gableShape.lineTo(1.32, 0);
  gableShape.lineTo(0, 2.15);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.14, bevelEnabled: false });
  const frontGable = new THREE.Mesh(gableGeo, M.crimsonLacquer);
  frontGable.position.set(0, 3.45, 2.60);
  gDinding.add(frontGable);
  const backGable = new THREE.Mesh(gableGeo, M.crimsonLacquer);
  backGable.position.set(0, 3.45, -2.74);
  gDinding.add(backGable);

  // Small rectangular windows & recessed front door panel
  addBox(gDinding, 0.56, 0.78, 0.12, M.ochreGold, 0, 2.58, 2.68);
  addBox(gDinding, 0.44, 0.66, 0.14, M.darkIronwood, 0, 2.58, 2.70);
  // Access wooden ladder on side-front
  addBox(gDinding, 0.06, 2.1, 0.06, M.warmTeak, 0.92, 0.95, 3.10, -0.35, 0, 0);
  addBox(gDinding, 0.06, 2.1, 0.06, M.warmTeak, 1.32, 0.95, 3.10, -0.35, 0, 0);
  for (let i = 0; i < 6; i++) {
    addBox(gDinding, 0.44, 0.05, 0.06, M.warmTeak, 1.12, 0.28 + i * 0.28, 3.36 - i * 0.11);
  }

  // 5. Tiang Tulak Sombong (Iconic tall central free-standing front & rear posts!)
  addCyl(gTulak, 0.18, 0.22, 0.18, 8, M.riverStone, 0, 0.09, 4.15);
  addCyl(gTulak, 0.18, 0.22, 0.18, 8, M.riverStone, 0, 0.09, -4.15);
  addBox(gTulak, 0.22, 6.25, 0.22, M.darkIronwood, 0, 3.22, 4.15);
  addBox(gTulak, 0.22, 6.25, 0.22, M.darkIronwood, 0, 3.22, -4.15);
  // Tie strut connecting tulak sombong back to main hull
  addBox(gTulak, 0.16, 0.18, 1.65, M.agedTimber, 0, 1.92, 3.42);
  addBox(gTulak, 0.16, 0.18, 1.65, M.agedTimber, 0, 1.92, -3.42);
  addBox(gTulak, 0.16, 0.18, 1.65, M.agedTimber, 0, 3.48, 3.42);
  addBox(gTulak, 0.16, 0.18, 1.65, M.agedTimber, 0, 3.48, -3.42);

  // 6. Tanduk & Kabongo' (Ceremonial carved buffalo head + stacked water buffalo horns on front Tulak Sombong)
  // Stylized architectural Kabongo' sculptural mount
  addBox(gTanduk, 0.34, 0.44, 0.36, M.carvedPanelDark, 0, 4.48, 4.38, 0.15, 0, 0);
  addBox(gTanduk, 0.22, 0.18, 0.22, M.boneWhite, 0, 4.32, 4.56);
  // Curved horns on Kabongo'
  const hornCurveL = new THREE.TorusGeometry(0.32, 0.045, 8, 14, Math.PI * 0.72);
  const hornL = new THREE.Mesh(hornCurveL, M.boneWhite);
  hornL.position.set(-0.28, 4.65, 4.42);
  hornL.rotation.set(0.2, 0.25, Math.PI * 0.4);
  gTanduk.add(hornL);
  const hornR = new THREE.Mesh(hornCurveL, M.boneWhite);
  hornR.position.set(0.28, 4.65, 4.42);
  hornR.rotation.set(0.2, -0.25, Math.PI * 0.6);
  hornR.scale.x = -1;
  gTanduk.add(hornR);

  // Vertically stacked ceremonial buffalo horns down the front Tulak Sombong
  for (let i = 0; i < 6; i++) {
    const hy = 1.65 + i * 0.40;
    const span = 0.24 + (i % 2) * 0.05;
    const hMeshL = new THREE.Mesh(new THREE.TorusGeometry(span, 0.032, 6, 12, Math.PI * 0.65), M.boneWhite);
    hMeshL.position.set(-span * 0.72, hy, 4.30);
    hMeshL.rotation.set(0.1, 0.3, Math.PI * 0.45);
    gTanduk.add(hMeshL);

    const hMeshR = new THREE.Mesh(new THREE.TorusGeometry(span, 0.032, 6, 12, Math.PI * 0.65), M.boneWhite);
    hMeshR.position.set(span * 0.72, hy, 4.30);
    hMeshR.rotation.set(0.1, -0.3, Math.PI * 0.55);
    hMeshR.scale.x = -1;
    gTanduk.add(hMeshR);
  }

  // 7. Atap Perahu (Soaring sweeping boat-shaped split-bamboo roof!)
  const boatRoofGeo = buildCurvedRoofGeometry(46, 20, (u, v) => {
    const s = u * 2 - 1; // -1..1 along Z (length of Tongkonan!)
    const t = v * 2 - 1; // -1..1 across X (width)
    const absS = Math.abs(s);
    const absT = Math.abs(t);

    // Sweeping parabolic boat-prow curve along Z: low in center, soaring high at both prows!
    const ridgeHeight = 4.65 + Math.pow(absS, 2.05) * 3.15;
    const eaveHeight = 3.02 + Math.pow(absS, 1.9) * 1.12;
    // Steep convex-to-concave Toraja roof pitch
    const y = eaveHeight + (ridgeHeight - eaveHeight) * Math.pow(1 - absT, 1.25);

    // Prows project far beyond the eaves (dramatic boat silhouette)
    const halfLen = 3.45 + (1 - absT) * 2.55;
    const halfWid = 2.05 * (1 - 0.16 * (1 - absT));

    return { x: t * halfWid, y, z: s * halfLen };
  });
  gAtap.add(new THREE.Mesh(boatRoofGeo, M.bambooRoof));

  // Bamboo ridge-cap ribs along the soaring central spine
  for (let i = -16; i <= 16; i++) {
    const s = i / 16;
    const absS = Math.abs(s);
    const rz = s * 5.95;
    const ry = 4.72 + Math.pow(absS, 2.05) * 3.15;
    addBox(gAtap, 0.24, 0.12, 0.28, M.darkIronwood, 0, ry, rz);
  }

  root.add(gUmpak, gLentong, gLantai, gDinding, gTulak, gTanduk, gAtap);
  return root;
}

// ============================================================================
// 3. RUMAH JOGLO (Jawa Tengah & DI Yogyakarta) — Supports True Interior View!
// ============================================================================
function buildRumahJoglo() {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'RumahJoglo_Root';

  const gLantai = new THREE.Group(); gLantai.name = 'pendopo_lantai';
  const gUmpak = new THREE.Group(); gUmpak.name = 'umpak_batu';
  const gSokoGuru = new THREE.Group(); gSokoGuru.name = 'soko_guru';
  const gPenanggap = new THREE.Group(); gPenanggap.name = 'tiang_penanggap';
  const gGebyok = new THREE.Group(); gGebyok.name = 'gebyok_dalem';
  const gTumpang = new THREE.Group(); gTumpang.name = 'tumpang_sari';
  const gAtap = new THREE.Group(); gAtap.name = 'atap_brunjung';

  // 1. Pendopo Lantai (Stepped stone & terracotta batur plinth)
  addBox(gLantai, 8.6, 0.20, 8.6, M.andesiteStone, 0, 0.10, 0);
  addBox(gLantai, 7.9, 0.18, 7.9, M.terracottaFloor, 0, 0.29, 0);
  addBox(gLantai, 3.5, 0.06, 3.5, M.agedTimber, 0, 0.41, 0); // subtle central sacred floor border
  // Front entry stairs onto pendopo
  addBox(gLantai, 2.1, 0.14, 0.45, M.andesiteStone, 0, 0.07, 4.48);
  addBox(gLantai, 1.8, 0.14, 0.35, M.terracottaFloor, 0, 0.21, 4.18);

  // 2. Umpak Batu + 3. Soko Guru (4 Primary Central Teak Pillars)
  const sgCoord = 1.25;
  const sgPts = [[-sgCoord, -sgCoord], [sgCoord, -sgCoord], [-sgCoord, sgCoord], [sgCoord, sgCoord]];
  for (const [x, z] of sgPts) {
    // Tapered carved andesite umpak stone base
    addCyl(gUmpak, 0.19, 0.27, 0.36, 4, M.andesiteStone, x, 0.56, z, 0, Math.PI / 4, 0);
    // Tall square teak Soko Guru column
    addBox(gSokoGuru, 0.24, 3.35, 0.24, M.warmTeak, x, 2.41, z);
    // Decorative bronze/gold base & capital collars
    addBox(gSokoGuru, 0.28, 0.12, 0.28, M.ochreGold, x, 0.80, z);
    addBox(gSokoGuru, 0.30, 0.14, 0.30, M.ochreGold, x, 3.98, z);
  }
  // Primary overhead Blandar & Pengeret tie beams linking the 4 Soko Guru
  addBox(gSokoGuru, 2.85, 0.20, 0.22, M.darkIronwood, 0, 4.08, -sgCoord);
  addBox(gSokoGuru, 2.85, 0.20, 0.22, M.darkIronwood, 0, 4.08, sgCoord);
  addBox(gSokoGuru, 0.22, 0.20, 2.85, M.darkIronwood, -sgCoord, 4.08, 0);
  addBox(gSokoGuru, 0.22, 0.20, 2.85, M.darkIronwood, sgCoord, 4.08, 0);

  // 4. Tiang Penanggap (12 Outer Perimeter Colonnade Pillars)
  const outer = 3.25;
  const outerPts = [
    [-outer, -outer], [-1.1, -outer], [1.1, -outer], [outer, -outer],
    [-outer, outer], [-1.1, outer], [1.1, outer], [outer, outer],
    [-outer, -1.1], [-outer, 1.1], [outer, -1.1], [outer, 1.1]
  ];
  for (const [x, z] of outerPts) {
    addCyl(gUmpak, 0.13, 0.19, 0.28, 4, M.andesiteStone, x, 0.52, z, 0, Math.PI / 4, 0);
    addBox(gPenanggap, 0.16, 2.38, 0.16, M.agedTimber, x, 1.85, z);
    addBox(gPenanggap, 0.20, 0.10, 0.20, M.bronzeAccent, x, 2.98, z);
  }
  // Outer perimeter ring beams (blandar penanggap)
  addBox(gPenanggap, 6.75, 0.16, 0.16, M.darkIronwood, 0, 3.06, -outer);
  addBox(gPenanggap, 6.75, 0.16, 0.16, M.darkIronwood, 0, 3.06, outer);
  addBox(gPenanggap, 0.16, 0.16, 6.75, M.darkIronwood, -outer, 3.06, 0);
  addBox(gPenanggap, 0.16, 0.16, 6.75, M.darkIronwood, outer, 3.06, 0);
  // Radial rafters linking outer ring up to central Soko Guru
  for (const [x, z] of sgPts) {
    const sx = Math.sign(x);
    const sz = Math.sign(z);
    addBox(gPenanggap, 2.25, 0.11, 0.11, M.agedTimber, sx * 2.25, 3.55, z, 0, 0, -sx * 0.44);
    addBox(gPenanggap, 0.11, 0.11, 2.25, M.agedTimber, x, 3.55, sz * 2.25, sz * 0.44, 0, 0);
  }

  // 5. Gebyok Dalem (Carved Teak Screen Partition at Rear separating Pendopo & Dalem)
  addBox(gGebyok, 6.32, 2.55, 0.14, M.carvedPanelDark, 0, 1.66, -outer + 0.08);
  // Carved relief lattice framing + central sacred doorway (Kori)
  for (const gx of [-2.4, -1.2, 1.2, 2.4]) {
    addBox(gGebyok, 0.14, 2.55, 0.18, M.warmTeak, gx, 1.66, -outer + 0.08);
    addBox(gGebyok, 0.72, 1.45, 0.16, M.ochreGold, gx > 0 ? gx - 0.6 : gx + 0.6, 1.80, -outer + 0.09);
    addBox(gGebyok, 0.60, 1.32, 0.17, M.carvedPanelDark, gx > 0 ? gx - 0.6 : gx + 0.6, 1.80, -outer + 0.09);
  }
  // Central carved Kori doorway frame
  addBox(gGebyok, 1.45, 2.15, 0.22, M.ochreGold, 0, 1.48, -outer + 0.12);
  addBox(gGebyok, 1.12, 1.92, 0.24, M.warmTeak, 0, 1.38, -outer + 0.13);

  // 6. Tumpang Sari (Stepped Corbelled Inverted-Pyramid Teak Ceiling — True Interior Highlight!)
  // 5 inward-stepping nested timber frames rising above Soko Guru + 3 outward-stepping lower eaves
  for (let tier = 0; tier < 5; tier++) {
    const span = 2.55 - tier * 0.36;
    const ty = 4.24 + tier * 0.19;
    const mat = tier % 2 === 0 ? M.warmTeak : M.ochreGold;
    const thick = 0.14;
    addBox(gTumpang, span, 0.15, thick, mat, 0, ty, -span / 2);
    addBox(gTumpang, span, 0.15, thick, mat, 0, ty, span / 2);
    addBox(gTumpang, thick, 0.15, span, mat, -span / 2, ty, 0);
    addBox(gTumpang, thick, 0.15, span, mat, span / 2, ty, 0);
  }
  // Central carved ceiling medallion (Uleng / Puncak Tumpang Sari)
  addBox(gTumpang, 0.85, 0.12, 0.85, M.crimsonLacquer, 0, 5.16, 0);
  addBox(gTumpang, 0.45, 0.14, 0.45, M.ochreGold, 0, 5.14, 0);

  // 7. Atap Brunjung & Penanggap (Iconic 3-slope Joglo Terracotta Roof!)
  // Tier 1: Wide low-slope outer Penitih eaves
  const tier1Geo = new THREE.CylinderGeometry(3.45, 5.85, 1.05, 4, 1, true);
  tier1Geo.rotateY(Math.PI / 4);
  const tier1 = new THREE.Mesh(tier1Geo, M.terracottaTile);
  tier1.position.y = 3.28;
  // Add underside soffit so looking up from inside Pendopo looks authentically architectural!
  const tier1Under = new THREE.Mesh(tier1Geo.clone(), M.agedTimber);
  tier1Under.position.y = 3.20;
  tier1Under.scale.set(0.99, 1, 0.99);
  tier1Under.material = M.agedTimber.clone();
  tier1Under.material.side = THREE.BackSide;
  gAtap.add(tier1, tier1Under);

  // Tier 2: Mid-slope Penanggap transition roof
  const tier2Geo = new THREE.CylinderGeometry(2.05, 3.65, 1.15, 4, 1, true);
  tier2Geo.rotateY(Math.PI / 4);
  const tier2 = new THREE.Mesh(tier2Geo, M.terracottaTile);
  tier2.position.y = 4.35;
  gAtap.add(tier2);

  // Tier 3: Iconic steep pyramidal Brunjung crown!
  const brunjungGeo = new THREE.CylinderGeometry(0.18, 2.25, 2.45, 4, 1, false);
  brunjungGeo.rotateY(Math.PI / 4);
  const brunjung = new THREE.Mesh(brunjungGeo, M.terracottaTile);
  brunjung.position.y = 6.10;
  gAtap.add(brunjung);

  // Terracotta ridge spine (Wuwungan) & sculpted crown ornaments (Makutha)
  addBox(gAtap, 1.12, 0.24, 0.22, M.terracottaRidge, 0, 7.36, 0);
  addCyl(gAtap, 0.04, 0.14, 0.42, 6, M.ochreGold, -0.52, 7.56, 0);
  addCyl(gAtap, 0.04, 0.14, 0.42, 6, M.ochreGold, 0.52, 7.56, 0);
  addCyl(gAtap, 0.05, 0.16, 0.52, 6, M.ochreGold, 0, 7.62, 0);

  // Corner ridge hip tiles emphasizing the Joglo silhouette
  for (let a = 0; a < 4; a++) {
    const ang = a * (Math.PI / 2) + Math.PI / 4;
    const rx = Math.cos(ang);
    const rz = Math.sin(ang);
    const hip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.85), M.terracottaRidge);
    hip.position.set(rx * 1.18, 6.08, rz * 1.18);
    hip.lookAt(0, 7.35, 0);
    gAtap.add(hip);
  }

  root.add(gLantai, gUmpak, gSokoGuru, gPenanggap, gGebyok, gTumpang, gAtap);
  return root;
}

// ============================================================================
// 4. HONAI (Lembah Baliem, Papua Pegunungan) — Supports Two-Level Interior View!
// ============================================================================
function buildHonai() {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'Honai_Root';

  const gDasar = new THREE.Group(); gDasar.name = 'lantai_dasar_tungku';
  const gHeke = new THREE.Group(); gHeke.name = 'tiang_heke';
  const gLoteng = new THREE.Group(); gLoteng.name = 'lantai_loteng';
  const gDinding = new THREE.Group(); gDinding.name = 'dinding_papan';
  const gPintu = new THREE.Group(); gPintu.name = 'pintu_rendah';
  const gAtap = new THREE.Group(); gAtap.name = 'atap_kubah_jerami';

  const radius = 2.05;
  const wallH = 1.62;

  // 1. Lantai Dasar & Tungku Api (Earth mound base + central stone-ringed hearth)
  addCyl(gDasar, radius + 0.35, radius + 0.52, 0.18, 28, M.earthFloor, 0, 0.09, 0);
  // Central hearth pit + 10 river stones around glowing embers
  addCyl(gDasar, 0.42, 0.46, 0.08, 14, M.emberGlow, 0, 0.21, 0);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    addCyl(gDasar, 0.09, 0.11, 0.14, 6, M.riverStone, Math.cos(ang) * 0.48, 0.24, Math.sin(ang) * 0.48);
  }

  // 2. Tiang Heke (4 Central Hardwood Support Posts framing the hearth & loft)
  const hp = 0.58;
  for (const [hx, hz] of [[-hp, -hp], [hp, -hp], [-hp, hp], [hp, hp]]) {
    addCyl(gHeke, 0.065, 0.08, 3.05, 8, M.darkIronwood, hx, 1.68, hz);
  }
  // Cross tie beams at loft level
  addBox(gHeke, 1.35, 0.09, 0.09, M.agedTimber, 0, 1.68, -hp);
  addBox(gHeke, 1.35, 0.09, 0.09, M.agedTimber, 0, 1.68, hp);
  addBox(gHeke, 0.09, 0.09, 1.35, M.agedTimber, -hp, 1.68, 0);
  addBox(gHeke, 0.09, 0.09, 1.35, M.agedTimber, hp, 1.68, 0);
  // Notched wooden ladder rising to upper sleeping loft
  addBox(gHeke, 0.055, 1.72, 0.055, M.warmTeak, 0.52, 1.02, 0.92, -0.22, 0, 0);
  addBox(gHeke, 0.055, 1.72, 0.055, M.warmTeak, 0.88, 1.02, 0.92, -0.22, 0, 0);
  for (let i = 0; i < 5; i++) {
    addBox(gHeke, 0.38, 0.045, 0.05, M.warmTeak, 0.70, 0.38 + i * 0.30, 1.05 - i * 0.065);
  }

  // 3. Lantai Loteng (Elevated second-story sleeping loft with central smoke/access hatch)
  const loftRing = new THREE.RingGeometry(0.62, radius - 0.14, 24);
  const loftMat = M.warmTeak.clone();
  loftMat.side = THREE.DoubleSide;
  const loftMesh = new THREE.Mesh(loftRing, loftMat);
  loftMesh.rotation.x = -Math.PI / 2;
  loftMesh.position.y = 1.74;
  gLoteng.add(loftMesh);
  // Radial floor joists under loft
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const joist = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, radius - 0.65), M.agedTimber);
    joist.position.set(Math.sin(ang) * 1.25, 1.68, Math.cos(ang) * 1.25);
    joist.rotation.y = ang;
    gLoteng.add(joist);
  }

  // 4. Dinding Papan Ganda (Circular double-layered vertical timber planks with doorway gap!)
  const numPlanks = 38;
  for (let i = 0; i < numPlanks; i++) {
    const ang = (i / numPlanks) * Math.PI * 2;
    // Leave clean doorway opening facing +Z (around ang = 0)
    const normAng = Math.atan2(Math.sin(ang), Math.cos(ang));
    if (Math.abs(normAng) < 0.24) continue;

    // Outer split-timber plank
    const px = Math.sin(ang) * radius;
    const pz = Math.cos(ang) * radius;
    addBox(gDinding, 0.28, wallH, 0.08, i % 2 === 0 ? M.agedTimber : M.warmTeak, px, 0.18 + wallH / 2, pz, 0, ang, 0);

    // Inner insulating plank ring
    const ipx = Math.sin(ang) * (radius - 0.18);
    const ipz = Math.cos(ang) * (radius - 0.18);
    addBox(gDinding, 0.25, wallH, 0.06, M.darkIronwood, ipx, 0.18 + wallH / 2, ipz, 0, ang, 0);
  }
  // Horizontal woven rattan binding hoops (Rotan Pengikat)
  for (const ry of [0.52, 1.04, 1.56]) {
    const hoopGeo = new THREE.TorusGeometry(radius + 0.055, 0.036, 8, 36, Math.PI * 1.84);
    const hoop = new THREE.Mesh(hoopGeo, M.rattanRope);
    hoop.rotation.x = Math.PI / 2;
    hoop.rotation.z = Math.PI * 0.58;
    hoop.position.y = ry;
    gDinding.add(hoop);
  }

  // 5. Pintu Rendah (Low narrow heat-preserving timber doorway)
  addBox(gPintu, 0.12, 1.18, 0.28, M.darkIronwood, -0.46, 0.77, radius - 0.06);
  addBox(gPintu, 0.12, 1.18, 0.28, M.darkIronwood, 0.46, 0.77, radius - 0.06);
  addBox(gPintu, 1.06, 0.14, 0.30, M.darkIronwood, 0, 1.38, radius - 0.06);
  // Low threshold sill to keep ground drafts & rain out
  addBox(gPintu, 0.92, 0.20, 0.28, M.warmTeak, 0, 0.28, radius - 0.06);
  // Partially ajar wooden plank door panel
  addBox(gPintu, 0.78, 1.02, 0.06, M.agedTimber, -0.14, 0.85, radius - 0.28, 0, 0.65, 0);

  // 6. Atap Kubah Jerami (Thick hemispherical multi-layered alang-alang grass dome!)
  // Built as concentric layered thatch tiers for rich museum tactile silhouette
  const domeLayers = [
    { y: 1.52, rBot: 2.52, rTop: 2.38, h: 0.48, mat: M.grassThatchDark },
    { y: 1.94, rBot: 2.42, rTop: 2.16, h: 0.52, mat: M.grassThatch },
    { y: 2.40, rBot: 2.20, rTop: 1.82, h: 0.52, mat: M.grassThatchDark },
    { y: 2.84, rBot: 1.86, rTop: 1.38, h: 0.48, mat: M.grassThatch },
    { y: 3.24, rBot: 1.42, rTop: 0.84, h: 0.44, mat: M.grassThatchDark },
    { y: 3.58, rBot: 0.88, rTop: 0.24, h: 0.38, mat: M.grassThatch }
  ];
  for (const l of domeLayers) {
    addCyl(gAtap, l.rTop, l.rBot, l.h, 28, l.mat, 0, l.y + l.h / 2, 0);
  }
  // Top bound grass crown knot (Puncak Kubah)
  addCyl(gAtap, 0.08, 0.26, 0.34, 14, M.rattanRope, 0, 4.06, 0);
  addCyl(gAtap, 0.16, 0.16, 0.10, 12, M.darkIronwood, 0, 4.24, 0);

  // Internal conical radial bamboo rafters visible underneath when lifted/cutaway
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const rafter = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.75, 6), M.agedTimber);
    rafter.position.set(Math.sin(ang) * 1.15, 2.68, Math.cos(ang) * 1.15);
    rafter.rotation.set(Math.cos(ang) * 0.72, 0, -Math.sin(ang) * 0.72);
    gAtap.add(rafter);
  }

  root.add(gDasar, gHeke, gLoteng, gDinding, gPintu, gAtap);
  return root;
}

// ============================================================================
// EXPORT ALL MODELS TO BINARY .GLB
// ============================================================================
async function exportGLB(sceneRoot, outPath) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      sceneRoot,
      (result) => resolve(result),
      (err) => reject(err),
      { binary: true }
    );
  });
  const buf = Buffer.from(arrayBuffer);
  fs.writeFileSync(outPath, buf);
  console.log(`Exported ${outPath} -> ${(buf.length / 1024).toFixed(1)} KB (${sceneRoot.children.length} structural component groups)`);
}

async function main() {
  const outDir = path.resolve('assets/models');
  fs.mkdirSync(outDir, { recursive: true });

  await exportGLB(buildRumahGadang(), path.join(outDir, 'rumah-gadang.glb'));
  await exportGLB(buildTongkonan(), path.join(outDir, 'tongkonan-toraja.glb'));
  await exportGLB(buildRumahJoglo(), path.join(outDir, 'rumah-joglo.glb'));
  await exportGLB(buildHonai(), path.join(outDir, 'honai-papua.glb'));
  console.log('All 4 NULAR architectural GLB models generated successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
