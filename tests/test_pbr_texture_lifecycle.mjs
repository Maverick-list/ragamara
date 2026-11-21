/**
 * NULAR — Focused PBR & Shared Avatar Texture Lifecycle Verification Suite
 * Validates:
 *  1. Shared regional textile texture reuse across multiple avatar materials
 *  2. Disposing one avatar while another still uses the same shared texture
 *  3. Repeated avatar textile replacement (disposes old cloned material, preserves shared textures)
 *  4. House & scene disposal via GameScene.prototype.disposeObject preserves shared cached PBR textures
 *  5. Genuinely owned non-shared textures are properly disposed exactly once
 */

import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const THREE_URL = pathToFileURL(
  path.resolve('/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/vendor/three/build/three.module.js')
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: THREE_URL, shortCircuit: true };
    return nextResolve(specifier, context);
  }
});

const THREE = await import('three');

// Lightweight 2D Canvas mock for headless Node.js execution
function createMockCanvas(w = 256, h = 256) {
  const noop = () => {};
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    closePath: noop
  };
  return { width: w, height: h, getContext: () => ctx };
}

globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? createMockCanvas() : {})
};

const {
  getArchTextureSet,
  getRegionalTextileTexture,
  enhanceArchitecturalMaterials,
  applyRegionalTextileToAvatar,
  isSharedPbrTexture
} = await import('../js/world/PbrTextureFactory.js');
const { GameScene } = await import('../js/world/GameScene.js');

const results = [];
function assertTest(name, cond, detail = '') {
  results.push({ name, pass: Boolean(cond), detail });
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

function spyDispose(obj) {
  let count = 0;
  const orig = obj.dispose.bind(obj);
  obj.dispose = () => {
    count += 1;
    orig();
  };
  return () => count;
}

function makeAvatar(namePrefix) {
  const group = new THREE.Group();
  group.name = namePrefix;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  torso.name = `${namePrefix}_torso`;
  torso.position.y = 0.9;
  group.add(torso);
  return { group, torso };
}

console.log('=== NULAR PBR & SHARED TEXTURE LIFECYCLE TEST SUITE ===\n');

// Test 1: Shared textile texture reused by multiple avatar materials
const av1 = makeAvatar('AvatarA');
const av2 = makeAvatar('AvatarB');
applyRegionalTextileToAvatar(av1.group, 'batik-parang-solo');
applyRegionalTextileToAvatar(av2.group, 'batik-parang-solo');

const sharedBatik = getRegionalTextileTexture('batik-parang-solo');
const getBatikDisposes = spyDispose(sharedBatik);

assertTest(
  '1. Shared Textile Texture Reused & Marked Across Multiple Avatars',
  av1.torso.material !== av2.torso.material &&
    av1.torso.material.map === sharedBatik &&
    av2.torso.material.map === sharedBatik &&
    isSharedPbrTexture(sharedBatik) &&
    av1.torso.material.userData?.nularPbrApplied === true &&
    av2.torso.material.userData?.nularPbrApplied === true,
  'Both avatars share cached CanvasTexture instance with nularSharedPbrTexture=true & distinct cloned materials'
);

// Test 2: Removing/disposing Avatar A while Avatar B still references shared texture
const getAv1GeoDisposes = spyDispose(av1.torso.geometry);
const getAv1MatDisposes = spyDispose(av1.torso.material);
const getAv2MatDisposes = spyDispose(av2.torso.material);

GameScene.prototype.disposeObject(av1.group);

assertTest(
  '2. Disposing Avatar A Preserves Shared Texture for Avatar B',
  getAv1GeoDisposes() === 1 &&
    getAv1MatDisposes() === 1 &&
    getBatikDisposes() === 0 &&
    getAv2MatDisposes() === 0 &&
    av2.torso.material.map === sharedBatik,
  `av1Geo=${getAv1GeoDisposes()}, av1Mat=${getAv1MatDisposes()}, sharedTexDisposes=${getBatikDisposes()}`
);

// Test 3: Repeated avatar textile replacement disposes previous cloned material without disposing shared textures
const prevMat = av2.torso.material;
const getPrevMatDisposes = spyDispose(prevMat);
applyRegionalTextileToAvatar(av2.group, 'songket-minangkabau');
const songketTex = getRegionalTextileTexture('songket-minangkabau');
const getSongketDisposes = spyDispose(songketTex);
const secondMat = av2.torso.material;
const getSecondMatDisposes = spyDispose(secondMat);
applyRegionalTextileToAvatar(av2.group, 'ulos-ragidup-batak');

assertTest(
  '3. Repeated Avatar Textile Changes Dispose Old Cloned Materials Without Disposing Cached Textures',
  getPrevMatDisposes() === 1 &&
    getSecondMatDisposes() === 1 &&
    getBatikDisposes() === 0 &&
    getSongketDisposes() === 0 &&
    av2.torso.material.userData?.pbrOutfitId === 'ulos-ragidup-batak',
  `prevMatDisposes=${getPrevMatDisposes()}, secondMatDisposes=${getSecondMatDisposes()}, cachedTexDisposes=0`
);

// Test 4: Disposing a house scene preserves shared cached architectural textures
const houseGroup = new THREE.Group();
const roofMesh = new THREE.Mesh(
  new THREE.BoxGeometry(4, 1, 4),
  new THREE.MeshStandardMaterial({ color: 0x242424 })
);
roofMesh.name = 'ROOF_GONJONG';
houseGroup.add(roofMesh);
enhanceArchitecturalMaterials(houseGroup);

const ijukTex = getArchTextureSet('thatch_ijuk').map;
const getIjukDisposes = spyDispose(ijukTex);
const getHouseMatDisposes = spyDispose(roofMesh.material);
const getHouseGeoDisposes = spyDispose(roofMesh.geometry);

GameScene.prototype.disposeObject(houseGroup);

assertTest(
  '4. House Scene Disposal Cleans Geometry & Material While Preserving Shared Architectural Texture',
  getHouseGeoDisposes() === 1 &&
    getHouseMatDisposes() === 1 &&
    getIjukDisposes() === 0 &&
    isSharedPbrTexture(ijukTex),
  `houseGeo=${getHouseGeoDisposes()}, houseMat=${getHouseMatDisposes()}, sharedIjukDisposes=${getIjukDisposes()}`
);

// Test 5: Genuinely owned non-shared textures ARE disposed exactly once
const ownedGroup = new THREE.Group();
const ownedTex = new THREE.Texture();
const ownedNormal = new THREE.Texture();
const getOwnedTexDisposes = spyDispose(ownedTex);
const getOwnedNormalDisposes = spyDispose(ownedNormal);

const ownedMat = new THREE.MeshStandardMaterial({
  map: ownedTex,
  bumpMap: ownedTex, // same owned texture referenced in two slots -> should only dispose once
  normalMap: ownedNormal
});
const ownedMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ownedMat);
ownedGroup.add(ownedMesh);

GameScene.prototype.disposeObject(ownedGroup);

assertTest(
  '5. Genuinely Owned Non-Shared Textures Are Disposed Exactly Once',
  !isSharedPbrTexture(ownedTex) &&
    getOwnedTexDisposes() === 1 &&
    getOwnedNormalDisposes() === 1,
  `ownedMapDisposes=${getOwnedTexDisposes()}, ownedNormalDisposes=${getOwnedNormalDisposes()}`
);

const passed = results.filter((r) => r.pass).length;
console.log(`\n=== PBR LIFECYCLE SUITE RESULT: ${passed}/${results.length} PASSED ===`);
if (passed !== results.length) process.exit(1);
