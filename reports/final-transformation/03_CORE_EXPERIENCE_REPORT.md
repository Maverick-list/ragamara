# RAGAMARA — PHASE 2: CORE EXPERIENCE TRANSFORMATION REPORT
**Document ID:** `03_CORE_EXPERIENCE_REPORT.md`  
**Phase:** Phase 2 — Homepage, World Map, Regional Dossier, Learning Journey & Mascot Ecosystem  
**Date:** 14 November 2026  
**Branch:** `feat/ragamara-final-experience`  

---

## 1. Executive Summary

Phase 2 transformed RAGAMARA's core user-facing experiences from a static purple-gradient prototype into **The Living Atlas of Nusantara**—an interconnected cultural exploration ecosystem across `index.html`, `landing.html`, `app.html`, `js/mascot.js`, and `js/ecosystem.js`.

Key accomplishments in Phase 2:
1. **Homepage Portal (`index.html` & `landing.html`):** Rebuilt around the Deep Archipelago Forest (`#102B25`, `#173F32`), Terracotta (`#B65F45`), Golden Ochre (`#F2C45A`), and Ocean Teal (`#34A59F`) palette; added complete navigation links (`Beranda`, `Jelajahi Budaya`, `Cara Main`, `Koleksi Maskot`, `Culturepedia`, `Profil Penjelajah`, `Design System`, `Mulai Petualangan`); replaced unverified marketing inflation (`"500+ Artefak Budaya 3D"`) with verified canonical database metrics (`45 Entitas Budaya Kanonis`, `50 Rekaman Resmi DAPOBUD RI`, `7 Wilayah Kepulauan`); and showcased all **7 Indonesian cultural realms**.
2. **Interactive SVG World Map (`#view-petualangan` in `app.html`):** Built an interactive, keyboard-accessible (`tabindex="0"`, `Enter`/`Space` support) SVG Archipelago Exploration Map (`#interactive-archipelago-atlas`) paired with 7 realm cards covering **Sumatra**, **Jawa**, **Bali & Nusa Tenggara**, **Kalimantan**, **Sulawesi**, **Kepulauan Maluku**, and **Tanah Papua**.
3. **10-Part Regional Cultural Dossiers (`RagamaraEcosystem.RegionalDossier` in `js/ecosystem.js`):** Repaired the fatal syntax error in `js/ecosystem.js` and authored rich, culturally grounded 10-part regional dossiers for all 7 regions on a warm parchment/lontar surface (`#F4EBDD`).
4. **RPG Learning Journey (`#view-belajar` in `app.html`):** Connected all 5 RPG level nodes, milestone treasure chest (`#treasure-chest-btn`), and inline cultural challenge modal (`#quest-modal`) to persistent state and the 6-mode Mini-Game Arena.
5. **Mascot Ecosystem (`js/mascot.js` & `#koleksi-subview-maskot`):** Unified `window.RagaMascot` with 10 vector emotional expressions, costume toggling (`withHeadpiece`), and connected all 5 regional endemic companion SVG avatars (`mascot_cendro_avatar.svg`, `mascot_bekti_avatar.svg`, `mascot_jalak_avatar.svg`, `mascot_komo_avatar.svg`, `mascot_maleo_avatar.svg`).

---

## 2. Homepage & Entry Portal Transformation (`index.html` & `landing.html`)

| Requirement | Implementation Detail | Verification Status |
| :--- | :--- | :--- |
| Complete navigation bar | Links to `#beranda`, `#wilayah`, `#cara-main`, `#maskot`, `#culturepedia`, `app.html#profil` (`Profil Penjelajah`), `design-system.html`, and `app.html` (`Mulai Petualangan`) | **VERIFIED** |
| Honest cultural metrics | Displays `45 Entitas Budaya Kanonis`, `50 Rekaman Resmi DAPOBUD`, `7 Wilayah Kepulauan & 6 Mini-Game` | **VERIFIED** |
| All 7 cultural realms represented | Showcases 1. Sumatra, 2. Jawa, 3. Bali & Nusa Tenggara, 4. Kalimantan, 5. Sulawesi, 6. Kepulauan Maluku, and 7. Tanah Papua | **VERIFIED** |
| Interactive Mascot Wardrobe | Live vector rendering of Raga with Minangkabau Deta headpiece toggle (`switchMascotAttire`) and 4 emotion triggers (`happy`, `excited`, `celebrating`, `thinking`) | **VERIFIED** |

---

## 3. World Map & 10-Part Regional Cultural Dossiers

### 3.1 Interactive SVG Archipelago Map (`#interactive-archipelago-atlas`)
Located at the top of `#view-petualangan` in `app.html`, the SVG map renders the Indonesian archipelago with maritime spice route lines, compass grid coordinates, and 7 interactive island groups. Each island group supports both mouse/touch click and keyboard activation (`role="button"`, `tabindex="0"`, `onkeydown` for `Enter` and `Space`), opening `RagamaraEcosystem.RegionalDossier.open(regionKey)`.

### 3.2 Complete 10-Part Regional Dossier Matrix (`js/ecosystem.js`)
Every one of the 7 regions renders all 10 required sections inside `#regional-dossier-modal`:

| Region Key | 1. Name & Subtitle | 2. Provinces | 4. Philosophy | 5. Architecture | 6. Attire & Textiles | 7. Performing Arts & Instruments | 8. Cuisine | 9. Rituals & Customs | 10. Linked Entities & Mini-Games |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sumatra` | Pulau Sumatra — Swarnadwipa | 10 Provinces (Aceh to Lampung) | *Adat Basandi Syarak* & *Alam Takambang Jadi Guru* | Rumah Gadang, Rumoh Aceh, Rumah Bolon | Songket Pandai Sikek, Ulos Batak, Tapis Lampung | Saluang, Talempong Pacik, Gordang Sambilan, Saman | Rendang, Gulai Itiak, Mie Aceh, Pempek | Makan Bajamba, Tabuik Pariaman, Peusijuek | Links to Sumatra DAPOBUD entities + Arena C, D, E |
| `jawa` | Pulau Jawa — Peradaban Keraton & Candi | 6 Provinces (Banten to Jatim) | *Memayu Hayuning Bawana* & *Silih Asah Silih Asih Silih Asuh* | Joglo Agung, Limasan, Julang Ngapak | Batik Tulis Pedalaman & Pesisir, Lurik, Kebaya | Gamelan Slendro-Pelog, Angklung, Wayang Kulit, Reog | Gudeg, Rawon, Pecel, Soto Kudus | Sekaten, Kasada Tengger, Seren Taun | Links to Jawa DAPOBUD entities + Arena A, D, F |
| `bali_nt` | Bali & Nusa Tenggara — Sunda Kecil | Bali, NTB, NTT | *Tri Hita Karana* | Bale Daja/Dauh, Uma Lengge, Sao Ata Mosa Lakitana | Endek, Gringsing Tenganan, Tenun Ikat Sumba | Gamelan Gong Kebyar, Sasando Rote, Tari Kecak | Ayam Betutu, Lawar, Sei Sapi, Catemak Jagung | Ngaben, Melasti, Pasola Sumba, Bau Nyale | Links to Bali/NT entities + Arena E, D, B |
| `kalimantan` | Pulau Kalimantan — Rimba Borneo | 5 Provinces (Kalbar to Kaltara) | *Huma Betang* & *Adil Ka' Talino* | Rumah Panjang Betang / Lamin, Rumah Bubungan Tinggi | King Baba & King Bibinge, Tenun Ulap Doyo, Sasirangan | Sampeq / Sape' Kayan-Kenyah, Tari Hudoq, Gamelan Banjar | Soto Banjar, Juhu Singkah, Amplang, Bubur Pedas | Tiwah Dayak Ngaju, Erau Kutai, Mallasuang Manu | Links to Kalimantan entities + Arena C, B, A |
| `sulawesi` | Pulau Sulawesi — Pelaut Pinisi & Toraja | 6 Provinces (Sulut to Sulbar) | *Siri' na Pacce* & *Sitou Timou Tumou Tou* | Tongkonan Toraja, Balla Lompoa, Banua Tada | Baju Bodo, Lipa' Sabbe, Sarung Donggala | Kolintang Minahasa, Kecapi Bugis, Gendang Pakarena | Coto Makassar, Pa'piong Toraja, Tinutuan, Kapurung | Rambu Solo', Ma'nene, pembuatan Pinisi | Links to Sulawesi entities + Arena C, A, F |
| `maluku` | Kepulauan Maluku — Jalur Rempah | Maluku & Maluku Utara | *Ale Rasa Beta Rasa* & *Ain Ni Ain* | Rumah Adat Baileo, Sasadu Halmahera | Baju Cele kotak-kotak merah, Manik-manik Halmahera | Tifa Totobuang, Tahuri kulit kerang, Tari Cakalele | Papeda Kuah Kuning, Ikan Bakar Colo-Colo, Kohu-Kohu | Sasi Laut & Sasi Darat, Pela Gandong, Cuci Negeri | Links to Maluku entities + Arena E, D, B |
| `papua` | Tanah Papua — Puncak Jaya & Asmat | 6 Provinces (Papua to Papua Barat Daya) | *Satu Tungku Tiga Batu* & *Ewew Osak* | Honai & Ebei Lembah Baliem, Kariwari, Jew Asmat | Noken serat kayu (UNESCO WBTb), Koteka, Sali | Tifa Papua ukir, Triton/Fuu, Tari Yospan | Papeda Kuah Kuning, Udang Selingkuh, Keladi Tumbuk | Bakar Batu (Barapen), Pesta Ulat Sagu, Ukiran Mbitoro | Links to Papua entities + Arena B, F, A |

---

## 4. Mascot Ecosystem (`js/mascot.js` & `#koleksi-subview-maskot`)

1. **Unified API (`window.RagaMascot`):**
   - Fixed the signature mismatch where `ecosystem.js` passed a CSS class string as the second parameter while `index.html` passed an options object `{ size, withHeadpiece }`. `RagaMascot.render(expression, optionsOrClass)` now seamlessly supports both calling conventions.
   - Supports 10 distinct vector expressions (`idle`/`happy`/`neutral`, `greeting`, `curious`/`learning`, `excited`, `thinking`, `encouraging`, `celebrating`, `surprised`/`achievement`, `confused`, `sleepy`).
2. **6 Endemic Mascot Companions:**
   - **Raga si Badak Penjelajah** (Ujung Kulon & Ranah Minang — `mascot_raga_avatar.png` & vector engine)
   - **Cendro si Cenderawasih** (Papua Pegunungan — `assets/images/mascot_cendro_avatar.svg`)
   - **Bekti si Bekantan** (Kalimantan Timur — `assets/images/mascot_bekti_avatar.svg`)
   - **Jalak Curik Bali** (Bali Barat — `assets/images/mascot_jalak_avatar.svg`)
   - **Komo si Naga Purba** (Pulau Komodo, NTT — `assets/images/mascot_komo_avatar.svg`)
   - **Maleo si Burung Pasir** (Sulawesi Tengah — `assets/images/mascot_maleo_avatar.svg`)
