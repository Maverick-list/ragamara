# Phase 4 — Complete Architectural Worlds & 38-Province Coverage Report

## Regional Batch Execution Summary (All 7 Regions — 42 Houses / 38 Provinces)

| Regional Batch | Provinces Covered | Houses Compiled (Walkable GLB + Manifest) | Provenance Labeling |
| :--- | :---: | :--- | :--- |
| **Sumatra** | 10 / 10 | Rumah Gadang, Uma Mentawai, Rumah Bolon Toba, Siwaluh Jabu Karo, Rumoh Aceh, Selaso Jatuh Kembar, Belah Bubung, Kajang Leko, Rumah Limas, Bubungan Lima, Rumah Panggung Melayu Bangka, Nuwo Sesat (**12 houses**) | Digital Architectural Reconstruction |
| **Java** | 6 / 6 | Rumah Joglo, Rumah Limasan, Rumah Ndalem Yogyakarta, Rumah Adat Osing (Tikel Balung), Julang Ngapak, Kebaya Betawi, Sulah Nyanda (**7 houses**) | Digital Architectural Reconstruction |
| **Kalimantan** | 5 / 5 | Rumah Panjang Uluk Palin, Huma Betang Tumbang Gagu, Rumah Bubungan Tinggi, Lamin Adat Pampang, Baloy Tidung (**5 houses**) | Digital Architectural Reconstruction |
| **Sulawesi** | 6 / 6 | Tongkonan Toraja, Saoraja / Bola Soba Bugis, Walewangko, Dulohupa, Tambi Lore, Boyang Beasa Mandar, Malige Istana Buton (**7 houses**) | Digital Architectural Reconstruction |
| **Bali & Nusa Tenggara** | 3 / 3 | Kompleks Bale Bali, Bale Tani Sasak, Mbaru Niang Wae Rebo (**3 houses**) | Digital Architectural Reconstruction |
| **Maluku** | 2 / 2 | Baileo Maluku (Haria/Nolloth), Sasadu Sahu (**2 houses**) | Digital Architectural Reconstruction |
| **Papua** | 6 / 6 | Honai Pilamo Hubula, Mod Aki Aksa Arfak, Kambik Moi *(explicitly labeled illustrative scheme)*, Kariwari Enggros, Karapauw Kame Kamoro, Jew Asmat (**6 houses**) | Digital Reconstruction / Illustrative Scheme (Kambik Moi) |

## Architectural Honesty & Standards
- **Zero Generic Templates:** Buildings respect regional typology — open ceremonial pavilions (*Baileo*, *Sasadu*, *Nuwo Sesat*, *Dulohupa*, *Bale Bali*) remain open without forced walls; highland conical houses (*Honai*, *Mbaru Niang*, *Kariwari*) feature circular/octagonal interiors, central hearths, and upper lofts; stilt longhouses feature elevated ironwood columns and walkable stairs.
- **On-Demand Scene Streaming:** Only one house GLB is loaded into WebGL GPU memory at any time; `SceneStreamingManager.unloadActiveScene()` strictly disposes all geometries, materials, and colliders between transitions.
- **Individual Manifests:** All 42 houses have verified manifests in `data/asset-manifests/<house-id>.json`.
