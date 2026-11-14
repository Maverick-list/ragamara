---
name: Playful Nusantara
colors:
  surface: '#190f24'
  surface-dim: '#190f24'
  surface-bright: '#40344c'
  surface-container-lowest: '#13091e'
  surface-container-low: '#21172d'
  surface-container: '#261b31'
  surface-container-high: '#30253c'
  surface-container-highest: '#3b3047'
  on-surface: '#eedcfa'
  on-surface-variant: '#ccc3d7'
  inverse-surface: '#eedcfa'
  inverse-on-surface: '#372c43'
  outline: '#958da1'
  outline-variant: '#4a4455'
  surface-tint: '#d3bbff'
  primary: '#d3bbff'
  on-primary: '#3f008d'
  primary-container: '#6d28d9'
  on-primary-container: '#dac5ff'
  inverse-primary: '#7331df'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#7d4e00'
  on-tertiary-container: '#ffc47d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ebddff'
  primary-fixed-dim: '#d3bbff'
  on-primary-fixed: '#250059'
  on-primary-fixed-variant: '#5b00c5'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#190f24'
  on-background: '#eedcfa'
  surface-variant: '#3b3047'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '800'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-energy, gamified Indonesian cultural adventure experience. It merges Duolingo-style micro-progression dynamics with Genshin-style realm exploration, grounded in rich Indonesian archipelago folklore.

### Design Movement & Aesthetic
- **Tactile Gamification & Soft Skeuomorphism**: Components feature physical click feedback, multi-tone extrusions ("push-shadows"), and ultra-rounded organic forms.
- **Deep Midnight Mysticism**: Surfaces evoke volcanic twilight skies and deep sea horizons with deep plum-purple night surfaces, illuminated by vibrant gem accents and glowing XP counters.
- **Approachable Cultural Soul**: Microcopy is warm, encouraging, and written in lively Indonesian youth register ("Yuk, gas!", "Mantap!", "Petualangan Berlanjut!"). The visual language is led by mascot companions like Raga (the explorer Rhino) and animated wayang-inspired motion flourishes.

## Colors

The palette is engineered for vibrant contrast on dark displays, channeling royal Javanese purple dyes, mythical gold relics, and tropical Indonesian natural motifs.

### Palette Architecture
- **Primary (`#6D28D9`, `#5B21B6`, `#4C1D95`)**: Vibrant Royal Violet represents mystical knowledge, mastery, and cultural richness. Used for high-priority CTA pill buttons, active progress tracks, and primary brand accents.
- **Secondary (`#8B5CF6`, `#DDD6FE`, `#EDE9FE`)**: Lilac and soft lavender for secondary badges, glowing halos, interactive hover states, and ambient highlights.
- **Tertiary & Accents**:
  - **Surya Gold (`#F59E0B`, `#FBBF24`)**: XP meters, streak flames (Api Nyala), star achievements, and coin balances (Koin Nusantara).
  - **Api Nusantara Coral (`#F43F5E`)**: Streak multiplier triggers, mission alerts, and critical actions.
  - **Zamrud Emerald & Bahari Cyan (`#10B981`, `#06B6D4`)**: Success validation toasts, stamina bars, and island milestone nodes.
- **Surfaces & Neutrals (`#13091E`, `#1E112A`, `#2D1A3E`, `#3B2252`)**: Layered deep night plum backgrounds providing high-contrast depth behind illuminated pill tokens and light card overlays.

## Typography

The type system is powered by **Plus Jakarta Sans**, chosen for its friendly geometric balance, wide open apertures, and warm, rounded terminal rhythm.

- **Headlines**: Set in Extra Bold (`800`) with tight tracking to evoke arcade adventure titles and gamified milestones. Indonesian exclamations ("Luar Biasa!", "Misi Selesai!") command high visual weight.
- **Body**: Medium (`500`) weight is preferred on dark backgrounds to preserve readability against glowing purple container cards without halation.
- **Labels & Microcopy**: Compact Bold (`700`/`800`) uppercase tracking for badge tags, XP tallies, and tactile button instructions.

## Layout & Spacing

The layout balances mobile vertical thumb flows with expansive adventure map navigation on wider screens.

- **Mobile First Focus**: Standard screens align on a unified vertical track with 16px screen margins (`margin`) and 16px grid gutters (`gutter`), optimized for single-hand button taps.
- **Progress Map & Exploration Paths**: The central learning path ("Peta Jelajah") uses curved dynamic SVG node paths with consistent 24px–32px vertical step gaps, maintaining rhythm between level islands.
- **Component Padding**: Spaced in 8pt rhythmic units. Standard interactive cards leverage `space-lg` (24px) for roomy hit-targets, while micro badges and gem counters leverage `space-xs` and `space-sm`.

## Elevation & Depth

This system avoids sterile flat surfaces in favor of tactile gamified physical depth and glowing energy fields.

### Physical Tactile Push Shadows
- Primary interactive elements (buttons, lesson steps, challenge cards) use solid offset bottom borders (`3D lip`) rather than fuzzy drop shadows:
  - Base state: `box-shadow: 0 4px 0 #4C1D95;` (or matching darker shade of the surface color).
  - Active / Pressed state: `transform: translateY(4px); box-shadow: 0 0 0 transparent;`.

### Floating Tiers
- **Tier 0 (Canvas)**: Deepest night plum (`#13091E`).
- **Tier 1 (Surface Containers)**: Raised plum indigo (`#1E112A`) with subtle 1px border stroke `rgba(139, 92, 246, 0.15)`.
- **Tier 2 (Interactive Floating Cards)**: Lifted plum surface (`#2D1A3E`) elevated by subtle ambient glow: `box-shadow: 0 8px 24px rgba(109, 40, 217, 0.25)`.
- **Tier 3 (Modals & Victory Sheets)**: High-glow overlay backed with heavy frosted backdrop-filter (`blur(12px)`) and radiant amber or purple rim lights.

## Shapes

The interface embraces a full Pill-Shaped (`roundedness: 3`) design language.

- **Full Pill Components**: Primary action buttons, challenge status chips, streak counters, and input text fields feature maximum pill radiuses (`rounded-full` / `9999px`).
- **Cards & Progress Banners**: Structured panels use large softened corners (`rounded-2xl` / 32px), creating a friendly, touch-friendly toybox look.
- **Interactive Map Nodes**: Circular nodes with raised extruded rings evoke physical game board pieces.

## Components

### 1. Tactile Action Buttons ("Tombol Utama")
- **Visuals**: Full pill border-radius with solid fill (`#6D28D9`) and a 4px thick bottom depth extrusion (`#4C1D95`).
- **Typography**: `label-lg`, white text, centered, uppercase or title case.
- **States**: Hover subtly lifts the surface; active press translates the button down 4px, giving tactile mechanical satisfaction.

### 2. Gamified Resource Chips ("Batu Permata & XP")
- **Visuals**: Pill capsule pill-containers featuring deep purple translucent fill, 1px glowing purple border, accompanied by 3D asset icons (Flame, Diamond, Star).
- **Layout**: Left-aligned icon with numeric value in bold typography (`label-md`).

### 3. Quest & Daily Mission Cards
- **Visuals**: `#1E112A` rounded containers featuring a multi-segment horizontal progress bar.
- **Progress Track**: Track background `#2D1A3E`, filled with vibrant gradient (`#06B6D4` to `#10B981` or `#F59E0B`), complete with a glowing pill cap.

### 4. Island Node Paths ("Peta Jalur Budaya")
- **Visuals**: Stepped circular lesson nodes (64px diameter) floating along an archipelago exploration trail.
- **States**: Completed nodes shine in Surya Gold with checkmarks; active nodes bounce with pulsing radial halos (`#8B5CF6`); locked nodes remain muted dark slate with padlock glyphs.

### 5. Leaderboard Lists
- **Visuals**: Stacked rounded cards with top 3 podium highlights. The #1 rank card features a gold border glow (`#F59E0B`), celebratory badge, and an avatar frame adorned with traditional Nusantara headdress motifs.

### 6. Inputs & Selectors
- **Visuals**: Deep surface pill-shaped inputs with 2px borders that transition from subtle purple to intense neon lilac (`#8B5CF6`) upon focus, accompanied by friendly Indonesian placeholder prompts.