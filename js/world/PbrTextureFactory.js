/**
 * NULAR — Procedural PBR Material & Regional Batik Texture Factory (js/world/PbrTextureFactory.js)
 * Generates crisp, cached, tileable CanvasTexture diffuse + bump maps for:
 *  - Authentic Indonesian architectural materials (teak, ironwood, carved relief, bamboo, ijuk, alang-alang, terracotta, stone)
 *  - 6 regionally distinct, culturally researched Indonesian textiles (Batik Parang Solo, Batik Megamendung Cirebon,
 *    Songket Minangkabau, Ulos Ragidup Batak, Tenun Ikat Sumba, Sasirangan Banjar)
 * Never uses one generic batik texture for all regions.
 */
import * as THREE from 'three';

const cache = new Map();

function makeCanvas(w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, repeatX = 2, repeatY = 2, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData = { ...(tex.userData || {}), nularSharedPbrTexture: true };
  tex.needsUpdate = true;
  return tex;
}

export function isSharedPbrTexture(tex) {
  return Boolean(tex && tex.userData && tex.userData.nularSharedPbrTexture === true);
}

function getOrCreate(key, factory) {
  if (cache.has(key)) return cache.get(key);
  const val = factory();
  cache.set(key, val);
  return val;
}

// ============================================================================
// ARCHITECTURAL PBR TEXTURES
// ============================================================================
export function getArchTextureSet(kind) {
  return getOrCreate(`arch_${kind}`, () => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');

    if (kind === 'wood_teak' || kind === 'wood_ironwood') {
      const dark = kind === 'wood_ironwood';
      ctx.fillStyle = dark ? '#5c3c28' : '#8d5b36';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 2) {
        const wave = Math.sin(y * 0.14) * 10 + Math.cos(y * 0.05) * 6;
        ctx.fillStyle = (y % 6 === 0)
          ? (dark ? 'rgba(38,22,12,0.42)' : 'rgba(64,36,18,0.32)')
          : (dark ? 'rgba(132,88,58,0.28)' : 'rgba(186,132,84,0.28)');
        ctx.fillRect(0, y, 256, 2);
        if (y % 32 === 0) {
          ctx.fillStyle = 'rgba(28,16,9,0.38)';
          ctx.fillRect(0, y, 256, 1.5);
        }
        if (Math.abs(wave) > 13 && y % 12 === 0) {
          ctx.fillStyle = dark ? 'rgba(30,16,8,0.26)' : 'rgba(98,58,28,0.22)';
          ctx.beginPath();
          ctx.ellipse(128 + wave * 3, y, 26, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return { map: finalizeTexture(c, 2, 2, true), bumpScale: 0.035 };
    }

    if (kind === 'bamboo_woven') {
      ctx.fillStyle = '#b99a62';
      ctx.fillRect(0, 0, 256, 256);
      const step = 32;
      for (let y = 0; y < 256; y += step) {
        for (let x = 0; x < 256; x += step) {
          const alt = ((x / step) + (y / step)) % 2 === 0;
          ctx.fillStyle = alt ? '#d0b277' : '#9e7e49';
          ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
          ctx.strokeStyle = 'rgba(54,36,16,0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, step - 2, step - 2);
        }
      }
      return { map: finalizeTexture(c, 3, 3, true), bumpScale: 0.045 };
    }

    if (kind === 'thatch_ijuk' || kind === 'thatch_grass') {
      const isIjuk = kind === 'thatch_ijuk';
      ctx.fillStyle = isIjuk ? '#3b3733' : '#a88652';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 650; i++) {
        const x = (i * 37) % 256;
        const y = (i * 53) % 256;
        ctx.strokeStyle = isIjuk
          ? (i % 3 === 0 ? 'rgba(110,104,96,0.55)' : 'rgba(26,24,22,0.58)')
          : (i % 3 === 0 ? 'rgba(214,182,122,0.58)' : 'rgba(116,86,44,0.48)');
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ((i % 5) - 2) * 2, y + 24);
        ctx.stroke();
      }
      for (let row = 0; row < 256; row += 32) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, row, 256, 3);
      }
      return { map: finalizeTexture(c, 4, 4, true), bumpScale: 0.06 };
    }

    if (kind === 'terracotta_tiles') {
      ctx.fillStyle = '#9a432b';
      ctx.fillRect(0, 0, 256, 256);
      const tw = 32, th = 24;
      for (let r = 0; r < 256 / th + 1; r++) {
        for (let col = 0; col < 256 / tw + 1; col++) {
          const ox = (r % 2) * (tw / 2);
          const x = col * tw - ox;
          const y = r * th;
          ctx.fillStyle = (col + r) % 2 === 0 ? '#a84b31' : '#8d3a24';
          ctx.fillRect(x + 1, y + 1, tw - 2, th - 3);
          ctx.fillStyle = 'rgba(28,10,6,0.35)';
          ctx.fillRect(x, y + th - 3, tw, 3);
        }
      }
      return { map: finalizeTexture(c, 5, 5, true), bumpScale: 0.05 };
    }

    if (kind === 'wood_carved') {
      ctx.fillStyle = '#3b1e14';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#d4a447';
      ctx.lineWidth = 4;
      for (let y = 16; y < 256; y += 64) {
        ctx.strokeRect(8, y, 240, 48);
        for (let x = 28; x < 240; x += 40) {
          ctx.beginPath();
          ctx.arc(x, y + 24, 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#8b241c';
          ctx.beginPath();
          ctx.arc(x, y + 24, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return { map: finalizeTexture(c, 2, 1, true), bumpScale: 0.05 };
    }

    // Default: stone_andesite
    ctx.fillStyle = '#5a5c62';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = (i * 71) % 256;
      const y = (i * 97) % 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(220,222,226,0.14)' : 'rgba(22,24,28,0.22)';
      ctx.fillRect(x, y, 3, 3);
    }
    return { map: finalizeTexture(c, 2, 2, true), bumpScale: 0.04 };
  });
}

// ============================================================================
// REGIONALLY DISTINCT INDONESIAN BATIK & WASTRA TEXTURES
// ============================================================================
export function getRegionalTextileTexture(outfitId = 'batik-parang-solo') {
  return getOrCreate(`textile_${outfitId}`, () => {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');

    if (outfitId.includes('megamendung')) {
      // Batik Megamendung (Cirebon, Jawa Barat) — layered cobalt/indigo clouds
      ctx.fillStyle = '#152d59';
      ctx.fillRect(0, 0, 512, 512);
      const shades = ['#1f4685', '#2f65b3', '#5690d6', '#9bc4f0', '#e3effc'];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const cx = col * 190 + (row % 2) * 95;
          const cy = row * 128 + 64;
          shades.forEach((hex, idx) => {
            ctx.fillStyle = hex;
            const r = 64 - idx * 10;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r * 1.45, r * 0.62, 0, 0, Math.PI * 2);
            ctx.ellipse(cx - r * 0.7, cy + 8, r * 0.85, r * 0.48, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + r * 0.7, cy + 8, r * 0.85, r * 0.48, 0, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
      return finalizeTexture(c, 2, 2, true);
    }

    if (outfitId.includes('songket')) {
      // Songket Minangkabau (Sumatera Barat) — crimson silk + gold Pucuak Rabuang triangles
      ctx.fillStyle = '#7c1824';
      ctx.fillRect(0, 0, 512, 512);
      // Gold horizontal brocade bands
      for (let y = 0; y < 512; y += 128) {
        ctx.fillStyle = '#d4a447';
        ctx.fillRect(0, y, 512, 10);
        ctx.fillRect(0, y + 114, 512, 10);
        // Pucuak Rabuang (bamboo shoot triangles)
        for (let x = 0; x < 512; x += 64) {
          ctx.fillStyle = '#e8c166';
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 108);
          ctx.lineTo(x + 32, y + 20);
          ctx.lineTo(x + 60, y + 108);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#5e111a';
          ctx.beginPath();
          ctx.moveTo(x + 18, y + 98);
          ctx.lineTo(x + 32, y + 48);
          ctx.lineTo(x + 46, y + 98);
          ctx.closePath();
          ctx.fill();
        }
      }
      return finalizeTexture(c, 2, 2, true);
    }

    if (outfitId.includes('ulos')) {
      // Ulos Ragidup (Batak Toba, Sumatera Utara) — maroon, obsidian, ivory warp stripes
      ctx.fillStyle = '#4e1518';
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 64) {
        ctx.fillStyle = '#1b1817';
        ctx.fillRect(0, y, 512, 18);
        ctx.fillStyle = '#f0e4ce';
        ctx.fillRect(0, y + 20, 512, 6);
        ctx.fillStyle = '#c89a45';
        for (let x = 0; x < 512; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 32);
          ctx.lineTo(x + 28, y + 46);
          ctx.lineTo(x + 16, y + 60);
          ctx.lineTo(x + 4, y + 46);
          ctx.closePath();
          ctx.fill();
        }
      }
      return finalizeTexture(c, 2, 2, true);
    }

    if (outfitId.includes('tenun') || outfitId.includes('sumba')) {
      // Tenun Ikat Sumba (NTT) — indigo & kombu red horizontal bands with geometric ikat
      ctx.fillStyle = '#1d2d44';
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 128) {
        ctx.fillStyle = '#8b2f24';
        ctx.fillRect(0, y + 18, 512, 42);
        ctx.fillStyle = '#e9dcc5';
        for (let x = 16; x < 512; x += 64) {
          ctx.fillRect(x, y + 28, 32, 6);
          ctx.fillRect(x + 12, y + 22, 8, 30);
          ctx.fillRect(x + 4, y + 76, 24, 24);
          ctx.fillStyle = '#1d2d44';
          ctx.fillRect(x + 10, y + 82, 12, 12);
          ctx.fillStyle = '#e9dcc5';
        }
      }
      return finalizeTexture(c, 2, 2, true);
    }

    if (outfitId.includes('sasirangan')) {
      // Sasirangan Banjar (Kalimantan Selatan) — emerald, gold, and maroon wave bands
      ctx.fillStyle = '#164a38';
      ctx.fillRect(0, 0, 512, 512);
      const colors = ['#d4a447', '#8f242c', '#e8d7a6', '#1e6b4f'];
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 18;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 16) {
          const y = i * 44 + Math.sin(x * 0.04 + i) * 14;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return finalizeTexture(c, 2, 2, true);
    }

    // Default: Batik Parang Rusak (Surakarta & Yogyakarta) — iconic diagonal soga wave blades
    ctx.fillStyle = '#1e1c1a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(-Math.PI / 4);
    ctx.translate(-380, -380);
    for (let row = 0; row < 14; row++) {
      const y = row * 56;
      // Warm ivory cream diagonal band
      ctx.fillStyle = '#f1e2c2';
      ctx.fillRect(0, y, 760, 26);
      // Soga brown Parang S-curves
      ctx.strokeStyle = '#73421c';
      ctx.lineWidth = 8;
      for (let x = 0; x < 760; x += 52) {
        ctx.beginPath();
        ctx.arc(x + 14, y + 13, 10, Math.PI * 0.15, Math.PI * 1.15);
        ctx.stroke();
        ctx.fillStyle = '#c89545';
        ctx.beginPath();
        ctx.arc(x + 36, y + 40, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return finalizeTexture(c, 2, 2, true);
  });
}

// ============================================================================
// MATERIAL ENHANCERS FOR HOUSES & CHARACTERS
// ============================================================================
export function enhanceArchitecturalMaterials(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const upName = `${obj.name || ''} ${obj.parent?.name || ''}`.toUpperCase();
    if (upName.includes('COLLISION')) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat.isMeshStandardMaterial || mat.userData?.nularPbrApplied) return;
      const hex = mat.color ? mat.color.getHex() : 0x6b4428;
      let kind = 'wood_teak';

      if (upName.includes('ROOF') || hex === 0x9a442d || hex === 0x242424 || hex === 0x927042) {
        if (hex === 0x9a442d || hex === 0xb45309) kind = 'terracotta_tiles';
        else if (hex === 0x242424) kind = 'thatch_ijuk';
        else kind = 'thatch_grass';
      } else if (upName.includes('UMPAK') || upName.includes('FOUNDATION') || hex === 0x52525b || hex === 0x64748b) {
        kind = 'stone_andesite';
      } else if (upName.includes('TUMPANG') || upName.includes('GEBYOK') || upName.includes('DOOR') || hex === 0x7c251d || hex === 0xc99c44) {
        kind = 'wood_carved';
      } else if (hex === 0x9c7d4d || hex === 0xb79964 || hex === 0xb59a68) {
        kind = 'bamboo_woven';
      } else if (hex === 0x3b2619 || hex === 0x2d1b12) {
        kind = 'wood_ironwood';
      }

      const set = getArchTextureSet(kind);
      mat.map = set.map;
      mat.bumpMap = set.map;
      mat.bumpScale = set.bumpScale;
      // Prevent dark baseColor * dark diffuse texture double-darkening into black silhouettes.
      // Preserve a subtle hue hint from the original GLB color while lifting luminance toward warm white.
      if (mat.color) {
        const liftTarget = new THREE.Color(kind === 'thatch_ijuk' ? 0xe6e0d8 : 0xfffaf2);
        mat.color.lerp(liftTarget, 0.82);
      }
      if (typeof mat.roughness === 'number') {
        mat.roughness = Math.min(0.86, Math.max(0.55, mat.roughness));
      }
      if (typeof mat.metalness === 'number') {
        mat.metalness = Math.min(0.12, mat.metalness);
      }
      mat.userData = { ...(mat.userData || {}), nularPbrApplied: true, pbrKind: kind };
      mat.needsUpdate = true;
    });
  });
}

export function applyRegionalTextileToAvatar(avatarRoot, outfitId = 'batik-parang-solo') {
  if (!avatarRoot) return;
  const tex = getRegionalTextileTexture(outfitId);
  avatarRoot.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const n = (obj.name || '').toLowerCase();
    // Apply crisp regional batik/wastra texture to torso, tunic, sarong, skirt, sash, or sleeves
    const isGarment = /torso|body|tunic|shirt|kain|sarong|skirt|sash|selendang|sleeve|coat|vest|cloth/i.test(n)
      || (obj.position.y > 0.35 && obj.position.y < 1.38 && !/head|face|hair|eye|hand|foot|shoe/i.test(n));
    if (isGarment && obj.material.isMeshStandardMaterial) {
      const prevMat = obj.material;
      const nextMat = prevMat.clone();
      nextMat.map = tex;
      nextMat.bumpMap = tex;
      nextMat.bumpScale = 0.015;
      nextMat.color.setHex(0xffffff);
      nextMat.roughness = 0.78;
      nextMat.userData = {
        ...(nextMat.userData || {}),
        nularPbrApplied: true,
        nularClonedAvatarMat: true,
        pbrOutfitId: outfitId
      };
      nextMat.needsUpdate = true;
      obj.material = nextMat;
      // Dispose previously cloned avatar material on repeated outfit switches without disposing shared cached textures
      if (prevMat.userData?.nularClonedAvatarMat) {
        prevMat.dispose();
      }
    }
  });
}
