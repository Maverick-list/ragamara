# NULAR (Nusa Learn) — Master UI/UX Implementation Report

**Date:** 2026-11-15  
**Product:** NULAR — The Living Atlas of Nusantara  
**Branch:** `feat/ragamara-final-experience`  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Design Direction: "The Living Atlas of Nusantara"

The design philosophy of NULAR is inspired by antique maritime expedition journals, royal Indonesian keraton manuscripts, woven ikat/songket textures, and lush tropical archipelagic nature. Rather than feeling like a sterile dashboard or a generic gamified quiz app, NULAR immerses learners into an expedition universe.

### 1.1 Color Tokens & Material Hierarchy

- **Expedition Forest Greens:** `--atlas-forest` (`#173F32`), `--atlas-forest-deep` (`#102B25`), `--atlas-forest-surface` (`#14352B`). Used for deep structural backgrounds, cards, and natural ambiance.
- **Warm Terracotta CTA:** `--atlas-terracotta` (`#B65F45`), `--atlas-terracotta-hover` (`#C96E53`), `--atlas-terracotta-dark` (`#8A422D`). Provides high-urgency, culturally grounded action buttons.
- **Majapahit Gold Accents:** `--atlas-gold` (`#D4A447`), `--atlas-gold-bright` (`#F2C45A`), `--atlas-gold-dark` (`#9A7123`). Highlights rewards, streak flames, rankings, and currency.
- **Archipelago Teal:** `--atlas-teal` (`#287E7A`), `--atlas-teal-bright` (`#34A59F`). Symbolizes maritime straits, rivers, and verified status.

---

## 2. Key Screen Overhauls

### 2.1 View Beranda (Headquarters & Momentum)
- **Primary Chapter Hero:** Direct call-to-action to continue active story chapter with reward tags (+50 XP, +20 Gems).
- **7-Day Streak Journey Widget:** Displays 7-day Mon–Sun progression, active streak flame, and an interactive milestone claim button.
- **Toko Adat Promo Banner:** Eye-catching gateway introducing players to cosmetic cultural rewards.
- **Daily Mission Hub:** 3 active quests updating in real time with an automatic midnight reset countdown timer.

### 2.2 View Profil (RPG Explorer Identity)
- **Dynamic Explorer Header:** Customizable player name, bio, and title (`#profile-player-name`, `#profile-player-bio`, `#profile-player-title`).
- **Interactive Edit Profile Modal:** Allows players to update their display name, write a personalized expedition motto, and choose their mascot avatar among 6 regional companions:
  1. *Raga Si Kancil* (Jawa & Sumatra)
  2. *Bekti Bekantan* (Borneo)
  3. *Cendro Cenderawasih* (Papua)
  4. *Jalak Bali* (Bali & Nusa Tenggara)
  5. *Komo Komodo* (Nusa Tenggara Timur)
  6. *Maleo Sulawesi* (Sulawesi)
- **Equippable Frames:** One-click frame switcher (Emas Minang, Surya Majapahit, Ukir Asmat, Tenun Baduy) applying real-time border glows.
- **Stats Dashboard:** Live counts of Total XP, Gems, Streak Days, and Unlocked Cultural Cards.
- **Expedition History & Activity Bar:** Visual 7-day XP bar chart displaying learning rhythm.

### 2.3 Toko Adat Nusantara (`#shop-modal`)
- **Full Catalog Grid:** Categorized tabs (Semua Koleksi, Bingkai Avatar, Gelar Kehormatan, Busana & Aksesori).
- **Live Currency Bar:** Direct reflection of current player gems with instant deduction on purchase.
- **Ownership State Machine:** Distinct visual styles for *Equipped*, *Owned (Equip Now)*, *Affordable*, and *Insufficient Gems*.

---

## 3. Accessibility & Responsive Engineering

1. **High Contrast Mode:** Dedicated toggle in Settings elevating contrast ratios across text, badges, and interactive controls to meet WCAG 2.1 AA standards.
2. **Reduced Motion Mode:** Replaces spring and bouncy animations with instant transitions for users sensitive to motion.
3. **Keyboard & Focus Navigation:** Visible outline focus rings (`outline: 2px solid var(--color-warm-yellow)`) across all interactive buttons, links, inputs, and modal triggers.
4. **Mobile Responsiveness:** Tested and verified on 375px mobile viewports, tablet viewports, and ultra-wide desktops. Fixed mobile bottom navigation bar ensuring thumb-friendly access to all 5 views.

---

## 4. Verification

All updated UI components, modals, and controllers were verified in a real headless Chrome browser instance. Zero console errors and zero layout shifts occurred.
