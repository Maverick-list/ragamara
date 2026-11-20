# LIVING ARCHIPELAGO ENVIRONMENTAL AUDIT
**Phase 12 Environmental Identity, Regional Biomes & Atmospheric Landscaping**  
**Engine:** `js/world/EnvironmentManager.js`  
**Audio Architecture:** Web Audio API Procedural Tropical Ambient Soundscape

---

## 1. Regional Biome Specification

Each traditional house environment is procedurally constructed according to its authentic geographic and ecological character:

| Region | Biome Name | Terrain & Ground Palette | Sky & Horizon Fog | Flora & Landscape | Water Feature |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Sumatra** | Dataran Tinggi Minangkabau & Bukit Barisan | Volcanic loam ground (`#475f3e`), warm stone plinth | Soft mist green (`#d6e5d8`), fog 0.012 | Clustered highland bamboo groves (*Bambu Betung*) | None |
| **Java** | Pelataran Asri Kraton Jawa | Terracotta courtyards (`#a48560`), mossy soil (`#647045`) | Warm ivory twilight (`#e8e8d8`), fog 0.009 | Banyan & teak canopies (*Ficus benjamina*), frangipani | None |
| **Kalimantan** | Tepian Sungai Kapuas & Barito | Dark peat soil (`#3d573a`), ironwood boardwalks | Equatorial humid teal (`#d3e3dd`), fog 0.014 | Dense ironwood rainforest canopy, river shorelines | **Dynamic River Waterway** |
| **Sulawesi** | Lembah Pegunungan Sa'dan Toraja | Terraced upland soil (`#516644`), grey mountain stone | Mountain atmosphere (`#d9e3ea`), fog 0.011 | Bamboo stakes, highland mountain trees | None |
| **Bali & Nusra** | Lembah Hijau Wae Rebo & Sasak | Volcanic savanna soil (`#737046`), gravel courtyard | Golden savanna warmth (`#eae2cd`), fog 0.010 | Giant bamboo stalks, savanna grasses | None |
| **Maluku** | Pesisir Maritim & Pulau Rempah | Coastal sandy soil (`#4f6c4a`), coral stone | Azure maritime sky (`#d2e7ed`), fog 0.010 | Clove, nutmeg & coastal coconut palm groves | **Azure Shoreline Ring** |
| **Papua** | Lembah Baliem & Dataran Tinggi | Alpine peat loam (`#486040`), river stone pavers | Misty highland valley (`#d7e4df`), fog 0.015 | Multi-tier alpine conifers (*Casuarina / Pinus*) | None |
| **Hub Plaza** | Alun-Alun Utama Nusantara | Monumental paved stone ring, bronze relief table | Ceremonial morning sky (`#e0e8e0`), fog 0.010 | 7 Regional Island Portals, botanical perimeter | **Monumental Moat** |

---

## 2. Dynamic Environmental Animations

1. **Procedural Wind Sway:**
   - Native trees and bamboo stalks oscillate subtly using sinusoidal phase offsets ($f = 1.25\text{ Hz}, \Delta\theta = \pm 0.025\text{ rad}$), simulating gentle tropical breezes.
2. **Water Surface Undulation:**
   - Kalimantan river channels and Maluku coastal shorelines undulate smoothly on the Y-axis ($A = 0.015\text{m}, f = 1.5\text{ Hz}$) with ACES Filmic specular highlights.
3. **Horizon Cloud Drift:**
   - 6 low-lying atmospheric cloud planes rotate slowly along the horizon, enhancing depth perspective without increasing GPU draw calls.

---

## 3. Procedural Web Audio Ambient Soundscape

- **Engine:** Zero-asset procedural synthesis via Web Audio API.
- **Components:**
  - Low-pass filtered pink noise ($f_c = 340\text{ Hz}$) recreating gentle highland winds through thatch eaves.
  - Soft pentatonic drone frequencies tuned to traditional *Pelog* and *Slendro* harmonic scales.
  - User-controlled ambient audio toggle with smooth gain ramping ($0.0001 \leftrightarrow 0.06$) to prevent audio clipping.
