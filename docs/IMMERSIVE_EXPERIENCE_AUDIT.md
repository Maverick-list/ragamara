# IMMERSIVE EXPERIENCE AUDIT: 3D INTERACTION, CAMERA & NAVIGATION
**Phase 12 Immersive Quality & Player Experience Review**  
**Engine:** Three.js r160 WebGL2  
**Target Viewports:** Desktop (1440x900) & Mobile (390x844 iPhone 14)

---

## 1. Triad Camera System Verification

The 3-mode camera architecture was audited across all regional houses and the Nusantara Hub Plaza:

| Camera Mode | Intended Use Case | Field of View & Angles | Collision & Occlusion Handling | Player Rating |
| :--- | :--- | :--- | :--- | :---: |
| **First-Person (`first-person`)** | Architectural immersion & walking through doorways | Eye level ($y = \text{playerY} + 1.58\text{m}$), vertical pitch clamped [-70°, +70°] | Avatar mesh hidden (or optional body toggle); camera raycasted against walls to prevent wall-peeking | **Excellent** |
| **Third-Person (`third-person`)** | Natural avatar exploration & cultural outfit display | Over-the-shoulder follow ($d = 2.4\text{m} - 4.8\text{m}$), smooth exponential damping | Active raycasting detects wall colliders between avatar head and camera, smoothly stepping inward | **Excellent** |
| **Free-Explore (`free-explore`)** | Architectural roof & structural study | Orbit, pan, and zoom ($d = 2.4\text{m} - 26\text{m}$) with optional cinematic rotation | Free target decoupled from avatar; WASD pans focal point across roof ridge and timber joinery | **Excellent** |

---

## 2. Dynamic Interior Access & Roof Cutaway Engine

1. **Automatic Entrance Detection:**
   - The engine monitors player coordinates against the house's `interiorZones` bounding boxes.
   - Upon stepping through the front threshold (e.g. Minang Baanjuang entrance or Joglo Gebyok double doors), `currentZone` transitions from `exterior` to the authentic local room name (e.g. *Ruang Tangah & Bilik Minang*, *Pendopo*, or *Lantai Bawah Perapian Honai*).
2. **Smooth Roof Cutaway:**
   - Instead of abruptly hiding the roof, the engine smoothly elevates roof group nodes upward ($+5.2\text{m}$) using spring interpolation (`updateRoofCutaway`).
   - This allows the player to inspect internal structural columns, rafters, and lofts without visual obstruction while maintaining contextual shadows.
   - Manual toggle is mapped to the `[R]` keyboard shortcut and the HUD Roof Cutaway toggle button.

---

## 3. Physical Collision & Boundary Stability

- **Walkable Floors & Steps:** Capsule-to-AABB height testing guarantees smooth elevation changes over stairs (e.g. 9-step Minang and Toraja staircases) without snapping or jitter.
- **Solid Wall Bounds:** Player velocity slides tangentially along wall colliders (`COLLISION_WALL_*`), preventing clipping outside architectural boundaries.
- **Drop Safeguard:** If a player steps off an elevated stilt platform, gravity ($9.8\text{ m/s}^2$) brings them smoothly down to the courtyard stone plinth.

---

## 4. Input & Responsive Control Mapping

- **Desktop Keyboard & Mouse:**
  - `WASD / Arrow Keys`: Walk
  - `Shift`: Sprint
  - `Space`: Jump / Step
  - `Mouse Drag / Pointer Lock`: Fluid 360° camera orientation
  - `E`: Spatial inspection of architectural components and monographs
  - `R`: Toggle roof cutaway
  - `Esc`: Open navigation menu / province atlas
- **Mobile Touch Controls:**
  - Left virtual floating joystick: Responsive 360° directional motion
  - Right action cluster: Dedicated LARI (Sprint), LOMPAT (Jump), and E (Interact) touch buttons
  - Touch swipe across canvas: Natural look & pitch rotation
