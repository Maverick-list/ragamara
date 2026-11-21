/**
 * NULAR GRAPHIC & ILLUSTRATION PRIMITIVES
 * Consistent visual language: 2.5D dimensional, deep emerald/golden lighting,
 * scalloped cloud contours, and authentic Nusantara cultural motifs.
 */

const NularGraphics = {
  // Scalloped Cosmic Cloud Divider (Reference B)
  renderCloudDivider(color = '#211B35', height = 48) {
    return `
      <svg viewBox="0 0 1440 ${height}" preserveAspectRatio="none" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0,${height} 
                 L 0,24 
                 Q 60,0 120,24 
                 Q 180,48 240,24 
                 Q 300,0 360,24 
                 Q 420,48 480,24 
                 Q 540,0 600,24 
                 Q 660,48 720,24 
                 Q 780,0 840,24 
                 Q 900,48 960,24 
                 Q 1020,0 1080,24 
                 Q 1140,48 1200,24 
                 Q 1260,0 1320,24 
                 Q 1380,48 1440,24 
                 L 1440,${height} Z" 
              fill="${color}"/>
      </svg>
    `;
  },

  // Cultural Motif: Saik Kalamai (Geometric Diamond Songket Pattern)
  renderSongketPattern(fillColor = '#FFCA55', opacity = 0.15) {
    return `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" stroke="${fillColor}" stroke-width="1.5" opacity="${opacity}">
          <polygon points="20,2 38,20 20,38 2,20"/>
          <polygon points="20,8 32,20 20,32 8,20"/>
          <circle cx="20" cy="20" r="3" fill="${fillColor}"/>
          <circle cx="2" cy="2" r="1.5" fill="${fillColor}"/>
          <circle cx="38" cy="2" r="1.5" fill="${fillColor}"/>
          <circle cx="2" cy="38" r="1.5" fill="${fillColor}"/>
          <circle cx="38" cy="38" r="1.5" fill="${fillColor}"/>
        </g>
      </svg>
    `;
  },

  // Cultural Collectible: Rumah Gadang Icon
  renderRumahGadang(size = 48) {
    return `
      <svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFCA55"/>
            <stop offset="100%" stop-color="#D49B28"/>
          </linearGradient>
        </defs>
        <!-- Curved Gonjong Roof Horns -->
        <path d="M 6 30 Q 18 10 32 20 Q 46 10 58 30 Q 46 24 32 26 Q 18 24 6 30 Z" fill="url(#roofGrad)"/>
        <!-- Main Structure -->
        <polygon points="12,28 52,28 48,46 16,46" fill="#8D1B2D"/>
        <!-- Stilts -->
        <rect x="18" y="46" width="3" height="12" fill="#D4C09B"/>
        <rect x="26" y="46" width="3" height="12" fill="#D4C09B"/>
        <rect x="35" y="46" width="3" height="12" fill="#D4C09B"/>
        <rect x="43" y="46" width="3" height="12" fill="#D4C09B"/>
        <!-- Intricate Carvings -->
        <circle cx="32" cy="36" r="3" fill="#FFCA55"/>
        <line x1="16" y1="40" x2="48" y2="40" stroke="#FFCA55" stroke-width="1.5"/>
      </svg>
    `;
  },

  // Cultural Collectible: Saluang (Bamboo Flute)
  renderSaluang(size = 48) {
    return `
      <svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <!-- Bamboo Tube -->
        <rect x="10" y="28" width="44" height="8" rx="4" transform="rotate(-30 32 32)" fill="#FFCA55" stroke="#B5841D" stroke-width="1.5"/>
        <!-- Finger Holes -->
        <circle cx="26" cy="35" r="1.5" fill="#392071"/>
        <circle cx="32" cy="32" r="1.5" fill="#392071"/>
        <circle cx="38" cy="28" r="1.5" fill="#392071"/>
        <circle cx="44" cy="25" r="1.5" fill="#392071"/>
      </svg>
    `;
  },

  // Cultural Collectible: Talempong Bronze Gong
  renderTalempong(size = 48) {
    return `
      <svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <!-- Bronze Gong Body -->
        <ellipse cx="32" cy="34" rx="22" ry="16" fill="#D49B28" stroke="#8D6210" stroke-width="2"/>
        <ellipse cx="32" cy="32" rx="18" ry="12" fill="#FFCA55"/>
        <!-- Central Boss Knob -->
        <circle cx="32" cy="31" r="5" fill="#B5841D"/>
        <circle cx="31" cy="30" r="2" fill="#FFF8EB"/>
      </svg>
    `;
  },

  // Floating Celestial Planet (Reference B)
  renderPlanet(size = 64, color = '#6338D4', ringColor = '#FFCA55') {
    return `
      <svg viewBox="0 0 80 80" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="planetGlow" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#FF8F83"/>
            <stop offset="45%" stop-color="${color}"/>
            <stop offset="100%" stop-color="#150E24"/>
          </radialGradient>
        </defs>
        <!-- Orbit Ring Behind -->
        <ellipse cx="40" cy="40" rx="36" ry="12" fill="none" stroke="${ringColor}" stroke-width="3" opacity="0.6" transform="rotate(-20 40 40)"/>
        <!-- Planet Sphere -->
        <circle cx="40" cy="40" r="22" fill="url(#planetGlow)"/>
        <!-- Orbit Ring In Front -->
        <path d="M 6 30 A 36 12 0 0 0 74 50" fill="none" stroke="${ringColor}" stroke-width="3" transform="rotate(-20 40 40)"/>
      </svg>
    `;
  }
};

const RagamaraGraphics = NularGraphics;

if (typeof window !== 'undefined') {
  window.NularGraphics = NularGraphics;
  window.RagamaraGraphics = RagamaraGraphics;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NularGraphics;
  module.exports.RagamaraGraphics = RagamaraGraphics;
}
