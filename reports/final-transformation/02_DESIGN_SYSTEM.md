# RAGAMARA — PHASE 1: "THE LIVING ATLAS OF NUSANTARA" DESIGN SYSTEM REPORT

**Project:** RAGAMARA — The Living Atlas of Nusantara  
**Files Engineered:** `css/tokens.css`, `css/components.css`, `css/landing.css`, `css/animations.css`, `design-system.html`  
**Phase Status:** COMPLETED & VERIFIED  

---

## 1. CREATIVE & ARCHITECTURAL DIRECTION

To eliminate the generic dark-purple SaaS template aesthetic, RAGAMARA's design system has been rebuilt around **"The Living Atlas of Nusantara"**—an expedition-and-heritage visual language rooted in Indonesian material culture:

1. **Manuscript & Lontar Surfaces (`#F4EBDD` Warm Parchment, `#FAF6EF` Warm Ivory):** Used for long-form cultural reading, Regional Dossier narrative cards, and museum provenance callouts.
2. **Archipelago Forest & Sea Surfaces (`#102B25` Deep Jungle, `#173F32` Deep Forest Green, `#287E7A` Ocean Teal):** Used for the Nusantara World Exploration Atlas, RPG Learning Journey progression map, and Explorer Headquarters.
3. **Carved Terracotta & Brass Accents (`#B65F45` Terracotta, `#D4A447` Golden Ochre / `#F2C45A` Surya Gold):** Used for tactile 3D push-buttons, active level stepping nodes, reward chests, and official DAPOBUD registration badges.
4. **Midnight Indigo Arena (`#202136` / `#151626`):** Used inside the interactive Mini-Game Arena (Modes A–F) to frame gameplay cards, rhythm visualizers, and tile restoration grids with maximum contrast and focus.

---

## 2. SEMANTIC COLOR TOKENS (`css/tokens.css`)

| Token Name | Hex Value | Cultural Material Inspiration | Primary Application |
| :--- | :--- | :--- | :--- |
| `--atlas-parchment` | `#F4EBDD` | Naskah lontar & kertas arsip museum | Editorial sections, Dossier cards |
| `--atlas-ivory` | `#FAF6EF` | Kain mori batik & gading ukir | Primary readable typography & light cards |
| `--atlas-forest` | `#173F32` | Hutan hujan tropis Sumatera & Kalimantan | Primary expedition card & container surface |
| `--atlas-forest-deep` | `#102B25` | Rimba raya & perairan dalam Nusantara | Application canvas background (`--bg-app`) |
| `--atlas-terracotta` | `#B65F45` | Bata terakota Majapahit & gerabah Kasongan | Primary tactile CTA buttons & active nodes |
| `--atlas-gold` / `--color-warm-yellow` | `#D4A447` / `#F2C45A` | Benang emas Songket Pandai Sikek & kuningan | Mastery stars, XP/level badges, focus rings |
| `--atlas-teal` / `--color-turquoise` | `#287E7A` / `#34A59F` | Laut kepulauan Banda & zamrud khatulistiwa | Discovery badges, Permata gems, available nodes |
| `--atlas-indigo` | `#202136` | Indigo celup tenun ikat & langit malam | Mini-game arena stage & boss challenge nodes |
| `--atlas-charcoal` | `#292820` | Tinta aksara kuno & kayu ulin | High-contrast text on parchment & gold surfaces |

---

## 3. TYPOGRAPHY & PROVENANCE HIERARCHY

- **Display & Narrative (`Plus Jakarta Sans`, 400–800):**
  - `--type-display-2xl`: `clamp(2.15rem, 4vw, 3.25rem)` — Hero headlines & Realm titles
  - `--type-display-xl`: `clamp(1.75rem, 3vw, 2.5rem)` — Section headers & Dossier titles
  - `--type-display-lg`: `clamp(1.45rem, 2.4vw, 1.95rem)` — Modal headers & Arena stage titles
  - `--type-body-lg` / `--type-body-md`: Comfortable 1.6 line-height for long-form Indonesian cultural narratives
- **Technical & Provenance (`JetBrains Mono`, 500–700):**
  - Used for official DAPOBUD registration numbers (`Reg: 2013003578`), canonical entity IDs, session timers, and accuracy metrics.

---

## 4. TACTILE GAME COMPONENTS & ACCESSIBILITY (`css/components.css`)

1. **Tactile 3D Buttons (`.btn-primary`, `.btn-gold`, `.btn-turquoise`, `.btn-coral`, `.btn-surface`, `.btn-outline`):**
   - Physical 5px bottom push-shadow that compresses (`translateY(4px)`) on `:active` / `.is-pressed`.
   - Explicit `:focus-visible` 3px golden ring for full keyboard accessibility.
   - `.is-loading` spinner state and `:disabled` state.
2. **6-State RPG Learning Journey Nodes:**
   - `.level-node-completed` (`COMPLETED` / `MASTERED`)
   - `.level-node-active` (`IN_PROGRESS` with `.active-pulse-halo`)
   - `.level-node-available` (`AVAILABLE`)
   - `.level-node-chest` (`REWARD_CLAIMED` / Milestone Chest)
   - `.level-node-locked` (`LOCKED`)
   - `.level-node-boss` (Chapter Mastery Boss Stage)
3. **Accessibility Modes:**
   - `body.high-contrast-mode`: Boosts surface contrast and text luminance for low-vision explorers.
   - `body.reduced-motion` and `@media (prefers-reduced-motion: reduce)`: Disables decorative animations while preserving instant state feedback.
