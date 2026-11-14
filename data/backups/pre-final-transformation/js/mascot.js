/**
 * RAGAMARA MASCOT SYSTEM — RAGA THE RHINOCEROS (BADAK PENJELAJAH)
 * Generates vector SVG avatars for all 9 emotional states
 * Reference: Rhinoceros sondaicus (Badak Jawa) with Minang Batik/Songket Collar Bib
 */

const RagaMascot = {
  // Proportions and Color Tokens
  colors: {
    bodyBase: '#B8B9C1',
    bodyShade: '#9DA0AA',
    bodyHighlight: '#D2D3DC',
    horn: '#E8E8EE',
    hornShade: '#C2C4CC',
    innerEar: '#D6A6B8',
    eye: '#1C152B',
    eyeSparkle: '#FFFFFF',
    mouth: '#7D2232',
    tongue: '#E6596E',
    bibBase: '#8D1B2D',       // Crimson maroon
    bibPattern: '#FFCA55',    // Gold star motif
    bibTrim: '#D4C09B',       // Diamond fringe trim
    emblem: '#E63946',        // Surya emblem
    headpiece: '#D4AF37'      // Deta Minang gold
  },

  /**
   * Returns complete standalone SVG markup for Raga in given expression
   * @param {('happy'|'curious'|'excited'|'thinking'|'confused'|'encouraging'|'celebrating'|'surprised'|'sleepy')} expression
   * @param {Object} options { size: number, withHeadpiece: boolean, withFlag: boolean }
   */
  render(expression = 'happy', options = {}) {
    const size = options.size || 160;
    const withHeadpiece = options.withHeadpiece || false;
    const withFlag = options.withFlag || false;

    // Expression specific eye & mouth paths
    let eyesSvg = '';
    let mouthSvg = '';
    let accessoriesSvg = '';
    let eyebrowsSvg = '';

    switch (expression) {
      case 'curious':
        eyesSvg = `
          <!-- Curious Eyes (one raised) -->
          <circle cx="82" cy="88" r="8" fill="#1C152B"/>
          <circle cx="85" cy="85" r="3" fill="#FFFFFF"/>
          <circle cx="118" cy="84" r="9.5" fill="#1C152B"/>
          <circle cx="121" cy="81" r="3.5" fill="#FFFFFF"/>
        `;
        eyebrowsSvg = `
          <path d="M 76 74 Q 82 71 89 75" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M 112 68 Q 118 64 125 67" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <path d="M 92 114 Q 100 119 108 114" stroke="#1C152B" stroke-width="3" stroke-linecap="round" fill="none"/>
        `;
        accessoriesSvg = `
          <!-- Curious Question Bubble -->
          <circle cx="140" cy="50" r="4" fill="#8B5CF6"/>
          <circle cx="148" cy="40" r="6" fill="#8B5CF6"/>
          <text x="148" y="44" font-family="sans-serif" font-weight="bold" font-size="11" fill="#FFFFFF" text-anchor="middle">?</text>
        `;
        break;

      case 'excited':
        eyesSvg = `
          <!-- Excited Star Eyes -->
          <path d="M 82 82 L 84 87 L 89 89 L 84 91 L 82 96 L 80 91 L 75 89 L 80 87 Z" fill="#FFCA55"/>
          <path d="M 118 82 L 120 87 L 125 89 L 120 91 L 118 96 L 116 91 L 111 89 L 116 87 Z" fill="#FFCA55"/>
        `;
        mouthSvg = `
          <!-- Big Open Grin -->
          <path d="M 85 110 Q 100 130 115 110 Z" fill="#7D2232"/>
          <path d="M 90 120 Q 100 128 110 120 Z" fill="#E6596E"/>
        `;
        accessoriesSvg = `
          <!-- Sparkles -->
          <circle cx="60" cy="50" r="3" fill="#FFCA55" opacity="0.8"/>
          <circle cx="140" cy="65" r="4" fill="#FFCA55" opacity="0.9"/>
        `;
        break;

      case 'thinking':
        eyesSvg = `
          <!-- Looking Up-Right -->
          <circle cx="84" cy="85" r="7.5" fill="#1C152B"/>
          <circle cx="86" cy="83" r="2.5" fill="#FFFFFF"/>
          <circle cx="120" cy="85" r="7.5" fill="#1C152B"/>
          <circle cx="122" cy="83" r="2.5" fill="#FFFFFF"/>
        `;
        eyebrowsSvg = `
          <path d="M 76 72 Q 83 75 90 73" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M 112 73 Q 119 75 126 72" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <path d="M 94 116 Q 102 113 110 117" stroke="#1C152B" stroke-width="3" stroke-linecap="round" fill="none"/>
        `;
        accessoriesSvg = `
          <!-- Thought Dots -->
          <circle cx="138" cy="56" r="3" fill="#8B5CF6" opacity="0.7"/>
          <circle cx="146" cy="46" r="4.5" fill="#8B5CF6" opacity="0.85"/>
          <circle cx="156" cy="34" r="6" fill="#8B5CF6"/>
        `;
        break;

      case 'confused':
        eyesSvg = `
          <!-- Unequal Confused Eyes -->
          <circle cx="82" cy="88" r="9" fill="#1C152B"/>
          <circle cx="84" cy="86" r="3" fill="#FFFFFF"/>
          <circle cx="118" cy="90" r="6" fill="#1C152B"/>
          <circle cx="119" cy="89" r="2" fill="#FFFFFF"/>
        `;
        eyebrowsSvg = `
          <path d="M 76 73 Q 83 70 90 75" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M 112 77 Q 119 72 126 71" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <path d="M 92 116 Q 98 112 104 118 Q 110 112 114 115" stroke="#1C152B" stroke-width="3" stroke-linecap="round" fill="none"/>
        `;
        break;

      case 'encouraging':
        eyesSvg = `
          <!-- Confident Happy Eyes -->
          <circle cx="82" cy="88" r="8" fill="#1C152B"/>
          <circle cx="85" cy="85" r="3" fill="#FFFFFF"/>
          <circle cx="118" cy="88" r="8" fill="#1C152B"/>
          <circle cx="121" cy="85" r="3" fill="#FFFFFF"/>
        `;
        mouthSvg = `
          <path d="M 88 112 Q 100 126 112 112 Z" fill="#7D2232"/>
          <path d="M 93 118 Q 100 123 107 118 Z" fill="#E6596E"/>
        `;
        accessoriesSvg = `
          <!-- Thumbs Up Glow Badge -->
          <circle cx="145" cy="115" r="14" fill="#24CBA2" stroke="#FFFFFF" stroke-width="2"/>
          <path d="M 140 115 L 144 119 L 151 112" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        `;
        break;

      case 'celebrating':
        eyesSvg = `
          <!-- Joyful Closed Arc Eyes -->
          <path d="M 74 88 Q 82 80 90 88" stroke="#1C152B" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          <path d="M 110 88 Q 118 80 126 88" stroke="#1C152B" stroke-width="3.5" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <!-- Ecstatic Open Smile -->
          <path d="M 84 108 Q 100 132 116 108 Z" fill="#7D2232"/>
          <path d="M 90 120 Q 100 128 110 120 Z" fill="#E6596E"/>
        `;
        accessoriesSvg = `
          <!-- Confetti Elements -->
          <rect x="54" y="44" width="6" height="6" rx="2" fill="#FFCA55" transform="rotate(25 54 44)"/>
          <rect x="140" y="40" width="6" height="6" rx="2" fill="#FF786B" transform="rotate(45 140 40)"/>
          <rect x="150" y="70" width="7" height="5" rx="1.5" fill="#24CBA2" transform="rotate(15 150 70)"/>
          <circle cx="48" cy="78" r="3" fill="#8B5CF6"/>
        `;
        break;

      case 'surprised':
        eyesSvg = `
          <!-- Wide Round Eyes -->
          <circle cx="82" cy="86" r="9.5" fill="#1C152B"/>
          <circle cx="85" cy="83" r="3.5" fill="#FFFFFF"/>
          <circle cx="118" cy="86" r="9.5" fill="#1C152B"/>
          <circle cx="121" cy="83" r="3.5" fill="#FFFFFF"/>
        `;
        eyebrowsSvg = `
          <path d="M 75 70 Q 82 66 89 70" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M 111 70 Q 118 66 125 70" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <!-- Open "O" Mouth -->
          <ellipse cx="100" cy="118" rx="8" ry="11" fill="#7D2232"/>
          <ellipse cx="100" cy="122" rx="5" ry="6" fill="#E6596E"/>
        `;
        accessoriesSvg = `
          <!-- Exclamation -->
          <circle cx="140" cy="50" r="10" fill="#FF786B"/>
          <text x="140" y="54" font-family="sans-serif" font-weight="bold" font-size="12" fill="#FFFFFF" text-anchor="middle">!</text>
        `;
        break;

      case 'sleepy':
        eyesSvg = `
          <!-- Sleepy Drooping Crescent Eyes -->
          <path d="M 76 89 Q 83 94 90 89" stroke="#1C152B" stroke-width="3" stroke-linecap="round" fill="none"/>
          <path d="M 110 89 Q 117 94 124 89" stroke="#1C152B" stroke-width="3" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <path d="M 94 116 Q 100 120 106 116" stroke="#1C152B" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        accessoriesSvg = `
          <!-- Zzz Letters -->
          <text x="138" y="65" font-family="sans-serif" font-weight="800" font-size="12" fill="#8B5CF6">Z</text>
          <text x="148" y="52" font-family="sans-serif" font-weight="800" font-size="15" fill="#8B5CF6">z</text>
          <text x="158" y="38" font-family="sans-serif" font-weight="800" font-size="18" fill="#8B5CF6">z</text>
        `;
        break;

      case 'happy':
      default:
        eyesSvg = `
          <!-- Friendly Open Dark Eyes -->
          <circle cx="82" cy="88" r="8" fill="#1C152B"/>
          <circle cx="85" cy="85" r="3" fill="#FFFFFF"/>
          <circle cx="118" cy="88" r="8" fill="#1C152B"/>
          <circle cx="121" cy="85" r="3" fill="#FFFFFF"/>
        `;
        eyebrowsSvg = `
          <path d="M 76 75 Q 82 72 88 75" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M 112 75 Q 118 72 124 75" stroke="#7E818C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        mouthSvg = `
          <!-- Smiling Mouth with Pink Tongue -->
          <path d="M 88 112 Q 100 124 112 112 Z" fill="#7D2232"/>
          <path d="M 92 118 Q 100 123 108 118 Z" fill="#E6596E"/>
        `;
        break;
    }

    // Minang Deta Headpiece SVG if requested
    const headpieceSvg = withHeadpiece ? `
      <!-- Minangkabau Traditional Deta Headpiece -->
      <g id="deta-headpiece">
        <path d="M 65 52 L 100 24 L 135 52 Q 100 58 65 52 Z" fill="#D4AF37" stroke="#A8821B" stroke-width="2"/>
        <path d="M 68 50 Q 100 42 132 50" stroke="#FFCA55" stroke-width="2" fill="none"/>
        <circle cx="100" cy="38" r="4" fill="#E63946"/>
        <polygon points="100,20 103,26 97,26" fill="#FFCA55"/>
      </g>
    ` : '';

    return `
      <svg viewBox="0 0 200 220" width="${size}" height="${size * 1.1}" xmlns="http://www.w3.org/2000/svg" class="raga-mascot raga-${expression}">
        <defs>
          <radialGradient id="ragaShade" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#D2D3DC"/>
            <stop offset="60%" stop-color="#B8B9C1"/>
            <stop offset="100%" stop-color="#9DA0AA"/>
          </radialGradient>
          <linearGradient id="hornGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="60%" stop-color="#E8E8EE"/>
            <stop offset="100%" stop-color="#C2C4CC"/>
          </linearGradient>
          <linearGradient id="bibGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9B2335"/>
            <stop offset="100%" stop-color="#731322"/>
          </linearGradient>
        </defs>

        <!-- EARS -->
        <g id="ears">
          <!-- Left Ear -->
          <ellipse cx="64" cy="58" rx="10" ry="18" transform="rotate(-25 64 58)" fill="url(#ragaShade)"/>
          <ellipse cx="64" cy="58" rx="6" ry="12" transform="rotate(-25 64 58)" fill="#D6A6B8" opacity="0.6"/>
          
          <!-- Right Ear -->
          <ellipse cx="136" cy="58" rx="10" ry="18" transform="rotate(25 136 58)" fill="url(#ragaShade)"/>
          <ellipse cx="136" cy="58" rx="6" ry="12" transform="rotate(25 136 58)" fill="#D6A6B8" opacity="0.6"/>
        </g>

        <!-- HEADPIECE (Back layer if any) -->
        ${headpieceSvg}

        <!-- MAIN BODY & TORSO (Chunky friendly silhouette) -->
        <path d="M 52 140 C 35 170 45 210 100 210 C 155 210 165 170 148 140 C 140 125 135 110 135 90 C 135 55 120 45 100 45 C 80 45 65 55 65 90 C 65 110 60 125 52 140 Z" fill="url(#ragaShade)"/>

        <!-- TEXTURED SKIN FOLDS (Characteristic Rhino Creases) -->
        <path d="M 64 135 Q 75 140 85 136" stroke="#9DA0AA" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <path d="M 136 135 Q 125 140 115 136" stroke="#9DA0AA" stroke-width="2.5" stroke-linecap="round" fill="none"/>

        <!-- RHINO SINGLE HORN (ICONIC BADAK JAWA) -->
        <polygon points="100,42 94,84 106,84" fill="url(#hornGrad)"/>
        <!-- Horn highlight -->
        <path d="M 100 44 L 98 82" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.8"/>

        <!-- NOSTRILS -->
        <ellipse cx="94" cy="98" rx="3.5" ry="2" fill="#7E818C"/>
        <ellipse cx="106" cy="98" rx="3.5" ry="2" fill="#7E818C"/>

        <!-- EYEBROWS -->
        ${eyebrowsSvg}

        <!-- EYES -->
        ${eyesSvg}

        <!-- MOUTH -->
        ${mouthSvg}

        <!-- WAVING RIGHT ARM -->
        <path d="M 145 145 C 165 135 175 110 170 95 C 165 85 155 90 150 105 C 146 115 142 130 142 145 Z" fill="url(#ragaShade)"/>

        <!-- INDONESIAN PATTERNED COLLAR BIB (Batik / Songket Minang) -->
        <g id="bib">
          <!-- Bib Base Contour -->
          <path d="M 60 125 Q 100 160 140 125 Q 148 145 135 160 Q 100 178 65 160 Q 52 145 60 125 Z" fill="url(#bibGrad)"/>
          
          <!-- Diamond Fringe Trim -->
          <path d="M 65 160 L 72 168 L 79 160 L 86 168 L 93 160 L 100 168 L 107 160 L 114 168 L 121 160 L 128 168 L 135 160" stroke="#D4C09B" stroke-width="2" fill="none"/>
          
          <!-- Golden Star-Flower Motifs -->
          <circle cx="82" cy="144" r="3" fill="#FFCA55"/>
          <circle cx="100" cy="152" r="3.5" fill="#FFCA55"/>
          <circle cx="118" cy="144" r="3" fill="#FFCA55"/>
          <circle cx="100" cy="152" r="1.5" fill="#E63946"/>
        </g>

        <!-- SURYA STAR NAVEL EMBLEM -->
        <g id="navel-emblem">
          <circle cx="100" cy="190" r="4.5" fill="#E63946"/>
          <circle cx="100" cy="190" r="2" fill="#FFCA55"/>
          <!-- Rays -->
          <path d="M 100 182 L 100 198 M 92 190 L 108 190 M 94 184 L 106 196 M 94 196 L 106 184" stroke="#E63946" stroke-width="1.2" stroke-linecap="round"/>
        </g>

        <!-- EXPRESSION ACCESSORIES & EFFECTS -->
        ${accessoriesSvg}
      </svg>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RagaMascot;
}
