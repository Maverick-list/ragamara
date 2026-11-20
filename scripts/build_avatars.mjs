/**
 * NULAR — Original Playable 3D Avatar Collection Generator (scripts/build_avatars.mjs)
 *
 * Exports 6 original stylized blocky-realistic playable 3D characters as binary glTF (.glb)
 * with articulated limb hierarchies, PBR Nusantara textile materials (strictly distinguishing
 * Batik from Tenun Ikat, Songket, Ulos, and Sasirangan), and 8 embedded AnimationClips:
 *   Idle, Walk, Run, Turn, Interact, Point, Wave, Sit
 *
 * Output: assets/models/avatars/<outfit-id>.glb + data/asset-manifests/avatars-manifest.json
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
const OUT_DIR = path.join(ROOT, 'assets/models/avatars');
const MANIFEST_DIR = path.join(ROOT, 'data/asset-manifests');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(MANIFEST_DIR, { recursive: true });

const textiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/textiles.json'), 'utf8'));

function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function buildAvatarScene(outfit, idx) {
  const scene = new THREE.Scene();
  scene.name = `AVATAR_${outfit.id.toUpperCase().replace(/-/g, '_')}`;

  const pal = outfit.palette;
  const skinTones = [0xc68e66, 0xb87e57, 0xd19c75, 0xa86f49, 0xc0865d, 0xb47952];
  const skinMat = new THREE.MeshStandardMaterial({ color: skinTones[idx % skinTones.length], roughness: 0.68, metalness: 0.02 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1614, roughness: 0.85, metalness: 0.04 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141212, roughness: 0.25, metalness: 0.1 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.4, metalness: 0.0 });
  const primaryMat = new THREE.MeshStandardMaterial({ color: hexToInt(pal.primary), roughness: 0.78, metalness: 0.06 });
  const secondaryMat = new THREE.MeshStandardMaterial({ color: hexToInt(pal.secondary), roughness: 0.72, metalness: outfit.patternType === 'songket-diamond' ? 0.35 : 0.08 });
  const accentMat = new THREE.MeshStandardMaterial({ color: hexToInt(pal.accent), roughness: 0.65, metalness: 0.15 });
  const trimMat = new THREE.MeshStandardMaterial({ color: hexToInt(pal.trim), roughness: 0.55, metalness: 0.22 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2c2018, roughness: 0.82, metalness: 0.05 });

  // Root & Articulated Character Rig (Height ~ 1.72m real-world scale!)
  const root = new THREE.Group();
  root.name = 'AVATAR_ROOT';
  scene.add(root);

  const hips = new THREE.Group();
  hips.name = 'HIPS';
  hips.position.set(0, 0.86, 0);
  root.add(hips);

  // Pelvis / Waist Sash (Sabuk / Kain Wrapping)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.25), secondaryMat);
  pelvis.name = 'MESH_PELVIS';
  hips.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.27), trimMat);
  belt.position.set(0, 0.06, 0);
  belt.name = 'MESH_BELT_SASH';
  hips.add(belt);

  // Spine & Torso (Tunic / Beskap / Kebaya / Cultural Textile Jacket)
  const spine = new THREE.Group();
  spine.name = 'SPINE';
  spine.position.set(0, 0.09, 0);
  hips.add(spine);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.50, 0.26), primaryMat);
  torso.position.set(0, 0.25, 0);
  torso.name = 'MESH_TORSO_OUTFIT';
  spine.add(torso);

  // Authentic Cultural Motif Panels on Chest & Back (Geometry-modeled woven bands/parang/clouds/diamonds)
  for (let side of [-1, 1]) {
    const zPos = side * 0.134;
    if (outfit.patternType === 'diagonal-parang' || outfit.patternType === 'sasirangan-wave') {
      for (let b = -2; b <= 2; b++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.032, 0.012), b % 2 === 0 ? secondaryMat : accentMat);
        stripe.position.set(0, 0.25 + b * 0.075, zPos);
        stripe.rotation.z = outfit.patternType === 'diagonal-parang' ? 0.38 : -0.2;
        spine.add(stripe);
      }
    } else if (outfit.patternType === 'cloud-gradations') {
      for (let c = 0; c < 3; c++) {
        const cloud = new THREE.Mesh(new THREE.BoxGeometry(0.28 - c * 0.05, 0.065, 0.012), c === 1 ? accentMat : secondaryMat);
        cloud.position.set(0, 0.15 + c * 0.10, zPos);
        spine.add(cloud);
      }
    } else {
      // Woven geometric bands (Tenun Ikat, Songket, Ulos)
      for (let r = 0; r < 4; r++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.445, 0.04, 0.014), r % 2 === 0 ? secondaryMat : trimMat);
        band.position.set(0, 0.10 + r * 0.11, zPos);
        spine.add(band);
      }
    }
  }

  // Diagonal Woven Ceremonial Sash (Selempang Ulos / Songket / Ikat) for non-batik outfits
  if (!outfit.isBatik) {
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.58, 0.285), secondaryMat);
    sash.position.set(0, 0.26, 0);
    sash.rotation.z = -0.58;
    sash.name = 'MESH_CULTURAL_SELEMPANG';
    spine.add(sash);
  }

  // Collar / Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 12), skinMat);
  neck.position.set(0, 0.53, 0);
  spine.add(neck);

  // Head Group
  const head = new THREE.Group();
  head.name = 'HEAD';
  head.position.set(0, 0.57, 0);
  spine.add(head);

  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.30), skinMat);
  cranium.position.set(0, 0.15, 0);
  cranium.name = 'MESH_HEAD';
  head.add(cranium);

  // Stylized Eyes & Brows
  for (const sx of [-0.07, 0.07]) {
    const eyeW = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.042, 0.015), eyeWhiteMat);
    eyeW.position.set(sx, 0.16, 0.15);
    head.add(eyeW);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.034, 0.018), eyeMat);
    pupil.position.set(sx, 0.158, 0.154);
    head.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.016, 0.018), hairMat);
    brow.position.set(sx, 0.20, 0.153);
    head.add(brow);
  }

  // Nose & subtle ears
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.045, 0.03), skinMat);
  nose.position.set(0, 0.125, 0.158);
  head.add(nose);

  // Hair & Regional Cultural Headwear (Udeng / Blangkon / Destar / Woven Headband)
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 0.32), hairMat);
  hairCap.position.set(0, 0.27, -0.01);
  head.add(hairCap);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), hairMat);
  hairBack.position.set(0, 0.17, -0.14);
  head.add(hairBack);

  const headband = new THREE.Mesh(new THREE.BoxGeometry(0.335, 0.065, 0.335), secondaryMat);
  headband.position.set(0, 0.26, 0);
  headband.name = 'MESH_HEADWEAR_BAND';
  head.add(headband);

  // Arms (Left & Right Articulated)
  function buildArm(side) {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'ARM_L' : 'ARM_R';
    arm.position.set(side * 0.29, 0.45, 0);
    spine.add(arm);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.14), primaryMat);
    upper.position.set(0, -0.12, 0);
    arm.add(upper);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.04, 0.145), trimMat);
    cuff.position.set(0, -0.24, 0);
    arm.add(cuff);

    const forearm = new THREE.Group();
    forearm.name = side < 0 ? 'FOREARM_L' : 'FOREARM_R';
    forearm.position.set(0, -0.26, 0);
    arm.add(forearm);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.22, 0.12), skinMat);
    lower.position.set(0, -0.11, 0);
    forearm.add(lower);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.10), skinMat);
    hand.position.set(0, -0.25, 0);
    forearm.add(hand);
  }
  buildArm(-1);
  buildArm(1);

  // Legs (Left & Right Articulated with Traditional Kain/Trouser Fabric & Footwear)
  function buildLeg(side) {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'LEG_L' : 'LEG_R';
    leg.position.set(side * 0.12, -0.07, 0);
    hips.add(leg);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.40, 0.18), accentMat);
    thigh.position.set(0, -0.20, 0);
    leg.add(thigh);

    const border = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.05, 0.185), trimMat);
    border.position.set(0, -0.38, 0);
    leg.add(border);

    const shin = new THREE.Group();
    shin.name = side < 0 ? 'SHIN_L' : 'SHIN_R';
    shin.position.set(0, -0.40, 0);
    leg.add(shin);

    const calf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.30, 0.15), primaryMat);
    calf.position.set(0, -0.15, 0);
    shin.add(calf);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.24), shoeMat);
    foot.position.set(0, -0.34, 0.04);
    shin.add(foot);
  }
  buildLeg(-1);
  buildLeg(1);

  // Build 8 Embedded glTF AnimationClips
  const qRot = (axis, rad) => {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, rad);
    return [q.x, q.y, q.z, q.w];
  };
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);

  const animations = [
    // 1. Idle (gentle breathing & head glance)
    new THREE.AnimationClip('Idle', 2.4, [
      new THREE.VectorKeyframeTrack('HIPS.position', [0, 1.2, 2.4], [0, 0.86, 0, 0, 0.885, 0, 0, 0.86, 0]),
      new THREE.QuaternionKeyframeTrack('ARM_L.quaternion', [0, 1.2, 2.4], [...qRot(Z, -0.06), ...qRot(Z, -0.10), ...qRot(Z, -0.06)]),
      new THREE.QuaternionKeyframeTrack('ARM_R.quaternion', [0, 1.2, 2.4], [...qRot(Z, 0.06), ...qRot(Z, 0.10), ...qRot(Z, 0.06)]),
      new THREE.QuaternionKeyframeTrack('HEAD.quaternion', [0, 0.8, 1.6, 2.4], [...qRot(Y, 0), ...qRot(Y, 0.08), ...qRot(Y, -0.06), ...qRot(Y, 0)])
    ]),
    // 2. Walk (natural bipedal cycle)
    new THREE.AnimationClip('Walk', 0.8, [
      new THREE.VectorKeyframeTrack('HIPS.position', [0, 0.2, 0.4, 0.6, 0.8], [0, 0.86, 0, 0, 0.90, 0, 0, 0.86, 0, 0, 0.90, 0, 0, 0.86, 0]),
      new THREE.QuaternionKeyframeTrack('LEG_L.quaternion', [0, 0.2, 0.4, 0.6, 0.8], [...qRot(X, 0.55), ...qRot(X, 0), ...qRot(X, -0.55), ...qRot(X, 0), ...qRot(X, 0.55)]),
      new THREE.QuaternionKeyframeTrack('LEG_R.quaternion', [0, 0.2, 0.4, 0.6, 0.8], [...qRot(X, -0.55), ...qRot(X, 0), ...qRot(X, 0.55), ...qRot(X, 0), ...qRot(X, -0.55)]),
      new THREE.QuaternionKeyframeTrack('ARM_L.quaternion', [0, 0.2, 0.4, 0.6, 0.8], [...qRot(X, -0.45), ...qRot(X, 0), ...qRot(X, 0.45), ...qRot(X, 0), ...qRot(X, -0.45)]),
      new THREE.QuaternionKeyframeTrack('ARM_R.quaternion', [0, 0.2, 0.4, 0.6, 0.8], [...qRot(X, 0.45), ...qRot(X, 0), ...qRot(X, -0.45), ...qRot(X, 0), ...qRot(X, 0.45)])
    ]),
    // 3. Run (energetic forward lean + high knee swing)
    new THREE.AnimationClip('Run', 0.52, [
      new THREE.VectorKeyframeTrack('HIPS.position', [0, 0.13, 0.26, 0.39, 0.52], [0, 0.84, 0, 0, 0.92, 0, 0, 0.84, 0, 0, 0.92, 0, 0, 0.84, 0]),
      new THREE.QuaternionKeyframeTrack('SPINE.quaternion', [0, 0.52], [...qRot(X, 0.18), ...qRot(X, 0.18)]),
      new THREE.QuaternionKeyframeTrack('LEG_L.quaternion', [0, 0.13, 0.26, 0.39, 0.52], [...qRot(X, 0.85), ...qRot(X, 0), ...qRot(X, -0.85), ...qRot(X, 0), ...qRot(X, 0.85)]),
      new THREE.QuaternionKeyframeTrack('LEG_R.quaternion', [0, 0.13, 0.26, 0.39, 0.52], [...qRot(X, -0.85), ...qRot(X, 0), ...qRot(X, 0.85), ...qRot(X, 0), ...qRot(X, -0.85)]),
      new THREE.QuaternionKeyframeTrack('ARM_L.quaternion', [0, 0.13, 0.26, 0.39, 0.52], [...qRot(X, -0.85), ...qRot(X, 0), ...qRot(X, 0.85), ...qRot(X, 0), ...qRot(X, -0.85)]),
      new THREE.QuaternionKeyframeTrack('ARM_R.quaternion', [0, 0.13, 0.26, 0.39, 0.52], [...qRot(X, 0.85), ...qRot(X, 0), ...qRot(X, -0.85), ...qRot(X, 0), ...qRot(X, 0.85)])
    ]),
    // 4. Turn
    new THREE.AnimationClip('Turn', 0.5, [
      new THREE.QuaternionKeyframeTrack('SPINE.quaternion', [0, 0.25, 0.5], [...qRot(Y, 0), ...qRot(Y, 0.25), ...qRot(Y, 0)]),
      new THREE.QuaternionKeyframeTrack('LEG_L.quaternion', [0, 0.25, 0.5], [...qRot(X, 0), ...qRot(X, 0.22), ...qRot(X, 0)])
    ]),
    // 5. Interact (reach forward inspecting architectural component)
    new THREE.AnimationClip('Interact', 0.9, [
      new THREE.QuaternionKeyframeTrack('ARM_R.quaternion', [0, 0.4, 0.9], [...qRot(X, 0), ...qRot(X, -1.15), ...qRot(X, 0)]),
      new THREE.QuaternionKeyframeTrack('FOREARM_R.quaternion', [0, 0.4, 0.9], [...qRot(X, 0), ...qRot(X, -0.35), ...qRot(X, 0)]),
      new THREE.QuaternionKeyframeTrack('SPINE.quaternion', [0, 0.4, 0.9], [...qRot(X, 0), ...qRot(X, 0.12), ...qRot(X, 0)])
    ]),
    // 6. Point (raise arm toward roof/structure)
    new THREE.AnimationClip('Point', 1.2, [
      new THREE.QuaternionKeyframeTrack('ARM_R.quaternion', [0, 0.35, 0.9, 1.2], [...qRot(X, 0), ...qRot(X, -2.1), ...qRot(X, -2.1), ...qRot(X, 0)]),
      new THREE.QuaternionKeyframeTrack('HEAD.quaternion', [0, 0.35, 0.9, 1.2], [...qRot(X, 0), ...qRot(X, -0.32), ...qRot(X, -0.32), ...qRot(X, 0)])
    ]),
    // 7. Wave (friendly Nusantara greeting)
    new THREE.AnimationClip('Wave', 1.4, [
      new THREE.QuaternionKeyframeTrack('ARM_R.quaternion', [0, 0.3, 0.55, 0.85, 1.1, 1.4], [...qRot(Z, 0.08), ...qRot(Z, 2.55), ...qRot(Z, 2.15), ...qRot(Z, 2.6), ...qRot(Z, 2.2), ...qRot(Z, 0.08)])
    ]),
    // 8. Sit (seated posture on Bale/Pendopo floor)
    new THREE.AnimationClip('Sit', 1.0, [
      new THREE.VectorKeyframeTrack('HIPS.position', [0, 1.0], [0, 0.52, 0, 0, 0.52, 0]),
      new THREE.QuaternionKeyframeTrack('LEG_L.quaternion', [0, 1.0], [...qRot(X, -1.45), ...qRot(X, -1.45)]),
      new THREE.QuaternionKeyframeTrack('LEG_R.quaternion', [0, 1.0], [...qRot(X, -1.45), ...qRot(X, -1.45)]),
      new THREE.QuaternionKeyframeTrack('SHIN_L.quaternion', [0, 1.0], [...qRot(X, 1.35), ...qRot(X, 1.35)]),
      new THREE.QuaternionKeyframeTrack('SHIN_R.quaternion', [0, 1.0], [...qRot(X, 1.35), ...qRot(X, 1.35)])
    ])
  ];

  return { scene, animations };
}

async function exportGlb(scene, animations, outPath) {
  const exporter = new GLTFExporter();
  const buf = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (res) => resolve(Buffer.from(res)),
      (err) => reject(err),
      { binary: true, animations }
    );
  });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

async function main() {
  const manifest = {
    schemaVersion: '1.0.0',
    collection: 'NULAR Avatar Collection',
    generatedAt: '2026-11-21',
    generator: 'scripts/build_avatars.mjs (Three.js GLTFExporter)',
    license: 'CC BY 4.0 — NULAR Original Character Design',
    avatars: []
  };

  for (let i = 0; i < textiles.outfits.length; i++) {
    const outfit = textiles.outfits[i];
    const { scene, animations } = buildAvatarScene(outfit, i);
    const outFile = path.join(OUT_DIR, `${outfit.id}.glb`);
    const bytes = await exportGlb(scene, animations, outFile);
    let meshCount = 0, triCount = 0;
    scene.traverse((o) => {
      if (o.isMesh) {
        meshCount++;
        const g = o.geometry;
        triCount += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      }
    });
    manifest.avatars.push({
      id: outfit.id,
      name: outfit.name,
      textileClassification: outfit.textileClassification,
      isBatik: outfit.isBatik,
      originRegion: outfit.originRegion,
      province: outfit.province,
      culturalCommunity: outfit.culturalCommunity,
      glbUrl: `assets/models/avatars/${outfit.id}.glb`,
      fileSizeBytes: bytes,
      meshes: meshCount,
      triangles: Math.round(triCount),
      animations: animations.map((a) => a.name),
      heightMeters: 1.72
    });
    console.log(`[AVATAR GLB] ${outfit.id}.glb (${(bytes / 1024).toFixed(1)} KB, ${Math.round(triCount)} tris, ${animations.length} animations)`);
  }

  fs.writeFileSync(path.join(MANIFEST_DIR, 'avatars-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated ${manifest.avatars.length} animated avatar GLBs and avatars-manifest.json!`);
}

main().catch((e) => { console.error(e); process.exit(1); });
