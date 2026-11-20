/**
 * NULAR — Phase 6 Cultural Collection & 3D Artifact Builder
 * Generates:
 *  1. assets/models/artifacts/*.glb (Museum mannequin & historical artifact 3D displays)
 *  2. data/cultural-items.json (Unified CulturalItem schema across Clothing, Weapons, Music, Dance, Crafts, Food)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from '../js/vendor/three/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const ROOT = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const ARTIFACT_DIR = path.join(ROOT, 'assets/models/artifacts');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const exporter = new GLTFExporter();
const exportGLB = (scene, filename) => new Promise((resolve, reject) => {
  exporter.parse(scene, (buf) => {
    const out = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(out, Buffer.from(buf));
    resolve({ filename, bytes: buf.byteLength });
  }, reject, { binary: true });
});

function buildMannequin(primaryHex, secondaryHex, goldHex = 0xc89d54) {
  const g = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: 0x26211d, roughness: 0.55, metalness: 0.4 });
  const fabricMat = new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.72 });
  const trimMat = new THREE.MeshStandardMaterial({ color: secondaryHex, roughness: 0.65 });
  const goldMat = new THREE.MeshStandardMaterial({ color: goldHex, roughness: 0.35, metalness: 0.75 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.08, 24), standMat);
  base.position.y = 0.04;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 12), standMat);
  pole.position.y = 0.82;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.58, 16), fabricMat);
  torso.position.y = 1.28;
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.24), trimMat);
  shoulder.position.y = 1.52;
  const kain = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.3, 0.72, 16), trimMat);
  kain.position.y = 0.64;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 24), goldMat);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 1.02;

  g.add(base, pole, torso, shoulder, kain, sash);
  return g;
}

function buildMuseumArtifact(kind) {
  const g = new THREE.Group();
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1e2c25, roughness: 0.6 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc89d54, roughness: 0.32, metalness: 0.78 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4e2e1a, roughness: 0.65 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x8e99a2, roughness: 0.28, metalness: 0.82 });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.52), plinthMat);
  plinth.position.y = 0.11;
  const cradleL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 10), brassMat);
  cradleL.position.set(-0.28, 0.34, 0);
  const cradleR = cradleL.clone();
  cradleR.position.set(0.28, 0.34, 0);
  g.add(plinth, cradleL, cradleR);

  if (kind === 'rencong') {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.62, 6), steelMat);
    blade.rotation.z = -Math.PI / 2;
    blade.position.set(-0.08, 0.5, 0);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.05), woodMat);
    hilt.position.set(0.28, 0.52, 0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.05), brassMat);
    tip.position.set(0.36, 0.57, 0);
    g.add(blade, hilt, tip);
  } else if (kind === 'keris') {
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045 - i * 0.005, 0.02), steelMat);
      seg.position.set(-0.32 + i * 0.12, 0.5 + (i % 2 === 0 ? 0.015 : -0.015), 0);
      seg.rotation.z = i % 2 === 0 ? 0.22 : -0.22;
      g.add(seg);
    }
    const ganja = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), brassMat);
    ganja.position.set(0.24, 0.5, 0);
    const ukiran = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.18, 10), woodMat);
    ukiran.rotation.z = Math.PI / 2.2;
    ukiran.position.set(0.34, 0.52, 0);
    g.add(ganja, ukiran);
  } else {
    // mandau
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.02), steelMat);
    blade.position.set(-0.06, 0.5, 0);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 10), woodMat);
    hilt.rotation.z = Math.PI / 2;
    hilt.position.set(0.36, 0.5, 0);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.026), brassMat);
    inlay.position.set(0.05, 0.52, 0);
    g.add(blade, hilt, inlay);
  }
  return g;
}

async function main() {
  const exported = [];
  exported.push(await exportGLB(buildMannequin(0x3a2518, 0xd4ae7a), 'clothing-batik-parang.glb'));
  exported.push(await exportGLB(buildMannequin(0x7a1e24, 0xd4ae7a), 'clothing-songket-minangkabau.glb'));
  exported.push(await exportGLB(buildMannequin(0x1f3a52, 0xb85c38), 'clothing-tenun-sumba.glb'));
  exported.push(await exportGLB(buildMuseumArtifact('rencong'), 'weapon-rencong-aceh.glb'));
  exported.push(await exportGLB(buildMuseumArtifact('keris'), 'weapon-keris-nusantara.glb'));
  exported.push(await exportGLB(buildMuseumArtifact('mandau'), 'weapon-mandau-kalimantan.glb'));

  const textiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/textiles.json'), 'utf8'));
  const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'ragamara_culture_db.json'), 'utf8'));
  const dbMap = new Map((db.records || []).map((r) => [r.record_id, r]));

  const items = [];

  // 1. Clothing & Textiles
  const clothingModelMap = {
    'batik-parang-solo': 'assets/models/artifacts/clothing-batik-parang.glb',
    'songket-minangkabau': 'assets/models/artifacts/clothing-songket-minangkabau.glb',
    'tenun-ikat-sumba': 'assets/models/artifacts/clothing-tenun-sumba.glb'
  };
  for (const o of textiles.outfits || []) {
    items.push({
      id: `item-${o.id}`,
      slug: o.id,
      name: o.name,
      category: 'clothing',
      categoryLabel: o.isBatik ? 'Wastra · Batik' : 'Wastra · Non-Batik',
      province: o.province,
      regionId: o.province,
      culturalAssociation: o.culturalCommunity,
      description: o.culturalMeaning,
      historicalContext: o.wearerContext,
      culturalSignificance: `${o.textileClassification}. ${o.culturalMeaning}`,
      materials: [o.textileClassification],
      components: ['Motif Utama', 'Teknik Pewarnaan/Tenun', 'Tata Busana Adat'],
      model3D: clothingModelMap[o.id] || 'assets/models/artifacts/clothing-batik-parang.glb',
      sources: [o.sourceAttribution, o.unescoStatus].filter(Boolean),
      verificationStatus: 'verified',
      availableLanguages: ['id', 'en']
    });
  }

  // 2. Traditional Weapons (Historical Museum Artifacts Only)
  const rencong = dbMap.get('ragamara_cult_rencong');
  if (rencong) {
    items.push({
      id: 'item-rencong-aceh',
      slug: 'rencong-aceh',
      name: 'Rencong Aceh',
      category: 'weapon',
      categoryLabel: 'Senjata Sejarah (Artefak Museum)',
      province: 'Aceh',
      regionId: 'Sumatra',
      culturalAssociation: 'Masyarakat Aceh',
      description: 'Senjata tradisional Kesultanan Aceh sejak masa Sultan Ali Mughayat Syah yang kini berfungsi sebagai simbol keberanian dan kelengkapan busana adat upacara.',
      historicalContext: rencong.dapobud?.official_description?.slice(0, 320) + '...',
      culturalSignificance: 'Simbol identitas, kehormatan, dan ketangguhan masyarakat Aceh dalam upacara adat pernikahan.',
      materials: ['Baja / Besi Tempa', 'Tanduk / Kayu (Gagang)', 'Emas (Rencong Meupucok)'],
      components: ['Mata Bilah', 'Hulu / Gagang Cugek', 'Sarung Kayu'],
      model3D: 'assets/models/artifacts/weapon-rencong-aceh.glb',
      sources: ['DAPOBUD Kemendikbud RI (REK/WBTB/2013/01/00001)', 'Wikipedia Indonesia'],
      verificationStatus: 'verified',
      availableLanguages: ['id', 'en']
    });
  }

  items.push(
    {
      id: 'item-keris-nusantara',
      slug: 'keris-nusantara',
      name: 'Keris Nusantara',
      category: 'weapon',
      categoryLabel: 'Senjata Sejarah (Artefak Museum)',
      province: 'Jawa Tengah & DI Yogyakarta',
      regionId: 'Java',
      culturalAssociation: 'Masyarakat Jawa, Bali, & Melayu',
      description: 'Pusaka bilah berlekuk (luk) dengan teknik tempa pamor yang diakui UNESCO sebagai Masterpiece of the Oral and Intangible Heritage of Humanity (2005).',
      historicalContext: 'Berkembang sejak era kerajaan Hindu-Buddha hingga Kesultanan Nusantara sebagai simbol status sosial, spiritualitas, dan seni metalurgi empu.',
      culturalSignificance: 'Diwariskan sebagai pusaka keluarga dan pelengkap busana adat resmi.',
      materials: ['Besi', 'Baja', 'Nikel/Pamor', 'Kayu Kemuning / Cendana (Warangka)'],
      components: ['Bilah & Luk', 'Ganja', 'Ukiran (Hulu)', 'Warangka (Sarung)'],
      model3D: 'assets/models/artifacts/weapon-keris-nusantara.glb',
      sources: ['UNESCO Intangible Cultural Heritage (2005)', 'Museum Keris Nusantara Surakarta'],
      verificationStatus: 'verified',
      availableLanguages: ['id', 'en']
    },
    {
      id: 'item-mandau-kalimantan',
      slug: 'mandau-kalimantan',
      name: 'Mandau Dayak',
      category: 'weapon',
      categoryLabel: 'Senjata Sejarah (Artefak Museum)',
      province: 'Kalimantan Tengah & Kalimantan Timur',
      regionId: 'Kalimantan',
      culturalAssociation: 'Masyarakat Dayak',
      description: 'Bilah tradisional masyarakat Dayak dengan ukiran tatahan kuningan/emas pada punggung bilah serta hulu tanduk berukir motif Asou.',
      historicalContext: 'Artefak budaya dan perkakas kehormatan masyarakat Dayak yang diwariskan lintas generasi dan dikenakan dalam upacara adat Gawai.',
      culturalSignificance: 'Melambangkan tanggung jawab pelindung komunitas, keterampilan pandai besi tradisional, dan seni ukir Dayak.',
      materials: ['Batu Besi Mantikei', 'Tanduk Rusa', 'Rotan', 'Tatahan Kuningan'],
      components: ['Bilah Tatahan', 'Hulu Tanduk Berukir', 'Kumpang (Sarung Kayu)'],
      model3D: 'assets/models/artifacts/weapon-mandau-kalimantan.glb',
      sources: ['Museum Balanga Palangka Raya', 'DAPOBUD Kemendikbud RI'],
      verificationStatus: 'verified',
      availableLanguages: ['id', 'en']
    }
  );

  // 3. Verified Performing Arts, Instruments, Crafts & Food from ragamara_culture_db.json
  const extraRecords = [
    { rid: 'ragamara_cult_gordang_sambilan', cat: 'music', label: 'Alat Musik Tradisional' },
    { rid: 'ragamara_cult_dambus', cat: 'music', label: 'Alat Musik Tradisional' },
    { rid: 'ragamara_cult_tor-tor', cat: 'dance', label: 'Seni Tari Tradisional' },
    { rid: 'ragamara_cult_ondel-ondel', cat: 'dance', label: 'Seni Pertunjukan Betawi' },
    { rid: 'ragamara_cult_gerabah_kasongan', cat: 'craft', label: 'Kriya Tradisional' },
    { rid: 'ragamara_cult_tapis', cat: 'clothing', label: 'Wastra · Kain Tapis' },
    { rid: 'ragamara_cult_songket_palembang', cat: 'clothing', label: 'Wastra · Songket' },
    { rid: 'ragamara_cult_randang', cat: 'food', label: 'Kuliner Warisan' },
    { rid: 'ragamara_cult_adrem', cat: 'food', label: 'Kuliner Tradisional' },
    { rid: 'ragamara_cult_tabot_atau_tabuik', cat: 'ceremony', label: 'Upacara & Perayaan Adat' }
  ];

  for (const spec of extraRecords) {
    const rec = dbMap.get(spec.rid);
    if (!rec) continue;
    const desc = rec.dapobud?.official_description || rec.wikipedia?.extract || '';
    items.push({
      id: `item-${rec.record_id.replace('ragamara_cult_', '')}`,
      slug: rec.record_id.replace('ragamara_cult_', ''),
      name: rec.name,
      category: spec.cat,
      categoryLabel: spec.label,
      province: rec.dapobud?.region?.province || 'Nusantara',
      regionId: rec.dapobud?.region?.province || 'Nusantara',
      culturalAssociation: `Masyarakat ${rec.dapobud?.region?.province || 'Nusantara'}`,
      description: desc.slice(0, 260) + (desc.length > 260 ? '...' : ''),
      historicalContext: desc,
      culturalSignificance: rec.dapobud?.category || spec.label,
      materials: [],
      components: [],
      model3D: null,
      sources: [
        `DAPOBUD Kemendikbud RI (${rec.dapobud?.number || 'WBTB'})`,
        rec.wikipedia?.page_url ? 'Wikipedia Indonesia' : null
      ].filter(Boolean),
      verificationStatus: 'verified',
      availableLanguages: ['id']
    });
  }

  fs.writeFileSync(path.join(ROOT, 'data/cultural-items.json'), JSON.stringify({
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString().slice(0, 10),
    totalItems: items.length,
    items
  }, null, 2));

  console.log(`Generated ${exported.length} artifact GLBs and ${items.length} unified CulturalItems.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
