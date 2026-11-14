# RAGAMARA — PHASE 2.5 CULTURAL DATA REMEDIATION PLAN
## Comprehensive Architectural Specification, Semantic Matcher Redesign & Canonical Deduplication Strategy

> **Role:** Principal Data Engineer, Cultural Heritage Data Specialist, and Senior Python Architect  
> **Status:** PLANNING & ANALYSIS ONLY — AWAITING EXPLICIT USER APPROVAL  
> **Target Release:** Phase 2.5 Remediation Milestone  
> **Scope:** Architecture, Canonical Schema, Semantic Matcher, Deduplication, Regional Classification, Image Provenance, Regression Test Suite, and Rollback Procedures.

---

## 1. CURRENT ARCHITECTURE ASSESSMENT

The RAGAMARA Cultural Data Enrichment Engine (`ragamara-data-engine/`) was developed to automate the ingestion of authentic cultural heritage records from the Ministry of Culture Republic of Indonesia (DAPOBUD) and enrich them with supplementary encyclopedic context from Indonesian Wikipedia and media from Wikimedia Commons.

### 1.1 Existing Engine Subsystems
- **DAPOBUD GraphQL Ingestion Client (`src/dapobud_client.py`):** Queries `https://dapobud.kemenbud.go.id/backend/graphql` for WBTb (`findAllWbtb`) and OPK (`findAllDapobud`). Uses a polite request delay (1.0s), persistent session headers, and on-disk SHA256 response caching (`data/cache/dapobud_gql_*.json`).
- **MediaWiki Enrichment Client (`src/mediawiki_client.py`):** Interacts with `https://id.wikipedia.org/w/api.php` in a 3-step pipeline (search candidate articles, extract introductory text, extract image metadata).
- **Matching Subsystem (`src/matching.py`):** Evaluates candidate Wikipedia titles against DAPOBUD names using `rapidfuzz.fuzz.token_sort_ratio` with a scalar bonus (+0.08) for keyword substring matching.
- **Normalization Engine (`src/normalization.py`):** Performs Unicode NFKC standardization, administrative prefix stripping (e.g. *tari*, *upacara*, *senjata tradisional*), and province name title-casing.
- **Validator & Storage Pipeline (`src/data_validator.py`, `src/storage.py`, `src/pipeline.py`):** Enforces URL validation, deterministic record ID generation (`id_dapobud_<uuid>`), atomic file replacement via temporary files (`.tmp`), and quality summary reporting.

### 1.2 Critical Deficiencies & Architectural Bottlenecks

```
CURRENT ARCHITECTURE (FLAT 1:1 MODEL)
[DAPOBUD 50 Records] ───► [Single Name Fuzzy Matcher] ───► [Flat JSON 50 Records] ───► [Frontend JS]
       │                                │                                │
       ▼                                ▼                                ▼
  5 Duplicate                      2 False Positives               4 Records Lack
 Administrative                   (Debus Banten &                 Province Metadata
  Registrations                   Batik Indonesia)
```

1. **Flat 1:1 Entity-to-Record Model (Lack of Canonical Entity Separation):**
   - The engine assumes every raw record returned by DAPOBUD represents a unique cultural entity.
   - In reality, Indonesian cultural governance records cultural properties across multiple administrative tiers (Provincial level vs. Kabupaten/Kota level). Ingesting raw records directly produced 5 duplicate cultural items (`Adrem`, `Acaineno`, `ADAT BUANTAK`, `ADIDANG`, `Aek Soap`), artificially inflating the dataset and triggering duplicate API queries.
2. **Single-Signal Lexical Matching Vulnerability:**
   - The current `CulturalMatcher` relies almost exclusively on `fuzz.token_sort_ratio`.
   - Token sort ratio fails catastrophically when an entity candidate is a subset or superset of another unrelated entity:
     - `Debus Banten` vs `Suku Banten`: Token overlap of `"banten"` plus substring boost yielded 77.6% (flagged for review, but auto-promoted because `Debus (seni)` scored only 45.45% due to length and parenthesis).
     - `Batik Indonesia` vs `Museum Batik Indonesia`: The inclusion of the word `"Museum"` yielded 81.08% token similarity, completely eclipsing the primary cultural article `Batik` (50.0%).
   - The matcher completely ignores cultural domains (e.g. *Seni Pertunjukan* vs *Kelompok Etnis*), institutional negative indicators (*Museum*, *Yayasan*, *Stasiun*), and parenthetical semantic classifiers (*(seni)*, *(makanan)*).
3. **Monolithic Scalar Regional Modeling:**
   - The existing schema represents location as a single scalar `region.province` string.
   - For nationwide cultural icons (`Batik Indonesia`) or shared multi-provincial traditions (`Tabot atau Tabuik`, `Aksara Ka Ga Nga`, `Rumah Panjang Dayak`), DAPOBUD returns `null`. The engine preserves `null`, leaving these items without a geographic region, causing UI grouping bugs in Culturepedia and the Adventure Map.
4. **Tight Ingestion-Storage Coupling:**
   - Ingestion, deduplication, enrichment, and output formatting are currently bundled into a single pass. A failure or change in enrichment logic requires re-running upstream ingestion or manually editing cache files.

---

## 2. PROPOSED CANONICAL DATA MODEL

To resolve these architectural issues without destroying upstream government provenance, we propose a **Two-Tier Decoupled Data Model**:
1. **Canonical Cultural Entity (`ragamara_entity_id`):** The authoritative, deduplicated cultural concept displayed to players in RAGAMARA.
2. **Source Registrations (`source_records[]`):** An array of one or more authentic DAPOBUD government records linked to this canonical entity.

```
PROPOSED TWO-TIER CANONICAL MODEL
┌────────────────────────────────────────────────────────────────────────┐
│ Canonical Cultural Entity (e.g. "Adrem")                                │
│ entity_id: "ragamara_cult_adrem"                                       │
│ cultural_domain: "Ketrampilan dan Kemahiran Kerajinan Tradisional"    │
│ regional_scope: { scope_type: "single_province", provinces: ["DIY"] }  │
├──────────────────────────────────┬─────────────────────────────────────┤
│ Source Record #1 (Provincial)    │ Source Record #2 (Kabupaten)        │
│ official_id: "46382fda..."       │ official_id: "bc6686e7..."          │
│ reg_no: "OP.5151.20240104.00002" │ reg_no: "OP.6061.20240102.00007"    │
│ tier: "provinsi"                 │ tier: "kabupaten" (Bantul)          │
│ raw_payload: { ... }             │ raw_payload: { ... }                │
├──────────────────────────────────┴─────────────────────────────────────┤
│ Encyclopedic Enrichment (Wikipedia Layer)                              │
│ status: "matched" | page_title: "Adrem" | score: 1.0 (exact)           │
├────────────────────────────────────────────────────────────────────────┤
│ Media Assets (Wikimedia Commons Layer)                                 │
│ [ { url: "...", license: "CC BY-SA 4.0", creator: "Danangtrihartanto"} ]│
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Complete JSON Schema Specification (`v2.0.0`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RagamaraCulturalDatabase",
  "type": "object",
  "required": ["metadata", "entities"],
  "properties": {
    "metadata": {
      "type": "object",
      "required": ["schema_version", "generated_at", "total_canonical_entities", "total_source_records"],
      "properties": {
        "database_name": { "type": "string" },
        "schema_version": { "type": "string", "const": "2.0.0" },
        "generated_at": { "type": "string", "format": "date-time" },
        "total_canonical_entities": { "type": "integer" },
        "total_source_records": { "type": "integer" },
        "enrichment_summary": {
          "type": "object",
          "properties": {
            "matched_entities": { "type": "integer" },
            "unmatched_entities": { "type": "integer" },
            "entities_with_media": { "type": "integer" },
            "manual_review_pending": { "type": "integer" }
          }
        }
      }
    },
    "entities": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/CanonicalEntity"
      }
    }
  },
  "$defs": {
    "CanonicalEntity": {
      "type": "object",
      "required": [
        "entity_id",
        "canonical_name",
        "slug",
        "cultural_domain",
        "regional_scope",
        "source_records",
        "enrichment",
        "media",
        "provenance"
      ],
      "properties": {
        "entity_id": { "type": "string", "pattern": "^ragamara_cult_[a-z0-9_]+$" },
        "canonical_name": { "type": "string" },
        "slug": { "type": "string" },
        "alternate_names": { "type": "array", "items": { "type": "string" } },
        "cultural_domain": {
          "type": "string",
          "enum": [
            "Tradisi Lisan",
            "Manuskrip",
            "Adat Istiadat",
            "Ritus",
            "Pengetahuan Tradisional",
            "Teknologi Tradisional",
            "Seni",
            "Bahasa",
            "Permainan Rakyat",
            "Olahraga Tradisional",
            "Cagar Budaya",
            "Lainnya"
          ]
        },
        "dapobud_category_raw": { "type": "string" },
        "canonical_description": { "type": "string" },
        "regional_scope": {
          "type": "object",
          "required": ["scope_type", "primary_game_region", "provinces", "is_nationwide"],
          "properties": {
            "scope_type": {
              "type": "string",
              "enum": ["single_province", "multi_province", "national", "unassigned"]
            },
            "primary_game_region": {
              "type": "string",
              "enum": ["Sumatra", "Jawa", "Bali & Nusa Tenggara", "Kalimantan", "Sulawesi", "Maluku", "Papua", "Nasional"]
            },
            "provinces": { "type": "array", "items": { "type": "string" } },
            "regencies": { "type": "array", "items": { "type": "string" } },
            "is_nationwide": { "type": "boolean" },
            "metadata_source": { "type": "string" }
          }
        },
        "source_records": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/SourceRecord" }
        },
        "enrichment": { "$ref": "#/$defs/EnrichmentLayer" },
        "media": {
          "type": "array",
          "items": { "$ref": "#/$defs/MediaAsset" }
        },
        "provenance": {
          "type": "object",
          "required": ["created_at", "last_updated_at", "quality_verified"],
          "properties": {
            "created_at": { "type": "string", "format": "date-time" },
            "last_updated_at": { "type": "string", "format": "date-time" },
            "quality_verified": { "type": "boolean" },
            "validation_flags": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "SourceRecord": {
      "type": "object",
      "required": ["source_name", "official_uuid", "registration_number", "entity_type", "source_url"],
      "properties": {
        "source_name": { "type": "string", "const": "DAPOBUD" },
        "official_uuid": { "type": "string" },
        "registration_number": { "type": "string" },
        "entity_type": { "type": "string", "enum": ["WBTB", "OPK"] },
        "administrative_tier": { "type": "string", "enum": ["nasional", "provinsi", "kabupaten_kota", "komunitas", "unknown"] },
        "registered_province": { "type": ["string", "null"] },
        "registered_regency": { "type": ["string", "null"] },
        "assignment_date": { "type": ["string", "null"] },
        "official_description": { "type": ["string", "null"] },
        "source_url": { "type": "string", "format": "uri" },
        "raw_payload_snippet": { "type": "object" }
      }
    },
    "EnrichmentLayer": {
      "type": "object",
      "required": ["status", "source"],
      "properties": {
        "status": { "type": "string", "enum": ["matched", "no_match", "manual_override"] },
        "source": { "type": "string", "const": "Wikipedia Indonesia" },
        "page_title": { "type": ["string", "null"] },
        "page_id": { "type": ["integer", "null"] },
        "page_url": { "type": ["string", "null"], "format": "uri" },
        "revision_id": { "type": ["integer", "null"] },
        "summary_extract": { "type": ["string", "null"] },
        "matching_metadata": {
          "type": "object",
          "properties": {
            "confidence_score": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
            "method": {
              "type": "string",
              "enum": ["exact", "normalized_exact", "semantic_composite", "manual_curated", "no_match"]
            },
            "score_breakdown": {
              "type": "object",
              "properties": {
                "name_score": { "type": "number" },
                "domain_score": { "type": "number" },
                "geographic_score": { "type": "number" },
                "description_score": { "type": "number" },
                "negative_penalty": { "type": "number" }
              }
            },
            "review_status": { "type": "string", "enum": ["not_required", "requires_review", "approved", "rejected"] },
            "candidate_titles": { "type": "array", "items": { "type": "string" } },
            "review_notes": { "type": "string" }
          }
        }
      }
    },
    "MediaAsset": {
      "type": "object",
      "required": ["asset_id", "asset_type", "thumbnail_url", "original_url", "file_page_url", "license", "creator", "attribution_text", "commercial_use_permitted"],
      "properties": {
        "asset_id": { "type": "string" },
        "asset_type": { "type": "string", "enum": ["image", "audio", "video"] },
        "role": { "type": "string", "enum": ["hero", "gallery", "thumbnail"] },
        "file_title": { "type": "string" },
        "thumbnail_url": { "type": "string", "format": "uri" },
        "original_url": { "type": "string", "format": "uri" },
        "file_page_url": { "type": "string", "format": "uri" },
        "creator": { "type": "string" },
        "license": { "type": "string" },
        "license_url": { "type": ["string", "null"], "format": "uri" },
        "attribution_text": { "type": "string" },
        "commercial_use_permitted": { "type": "boolean" },
        "cultural_relevance_status": { "type": "string", "enum": ["verified_authentic", "requires_replacement", "unverified"] },
        "verification_timestamp": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

---

## 3. SEMANTIC MATCHING ALGORITHM DESIGN

### 3.1 Multi-Factor Semantic Scoring Engine
To eliminate false positives caused by lexical token overlaps, the matching engine is redesigned from a scalar string comparator into a **Multi-Factor Semantic Evaluator**.

The composite confidence score $S_{composite}$ is defined as:

$$S_{composite} = \left( w_{name} \cdot S_{name} + w_{domain} \cdot S_{domain} + w_{geo} \cdot S_{geo} + w_{desc} \cdot S_{desc} ight) - P_{negative}$$

Where weights and scoring criteria are strictly budgeted:

| Factor | Weight ($w$) | Metric & Evaluation Strategy | Minimum Condition |
|:---|:---:|:---|:---|
| **$S_{name}$** (Name Match) | **0.40** | Token Sort Ratio + Levenshtein Distance of cleaned headwords after stripping parenthetical qualifiers. | $S_{name} \ge 0.60$ required to proceed |
| **$S_{domain}$** (Domain Compatibility) | **0.25** | Semantic agreement between DAPOBUD domain and Wikipedia categories/introductory sentence. | If incompatible: $S_{domain} = 0.0$ |
| **$S_{geo}$** (Geographic Corroboration) | **0.20** | Occurrence of DAPOBUD province, regency, or historical region in Wikipedia snippet or text. | Defaults to neutral 0.50 for national heritage |
| **$S_{desc}$** (Lexical Overlap) | **0.15** | Term overlap (TF-IDF cosine similarity or Jaccard token overlap) between official description and extract. | Non-zero bonus |
| **$P_{negative}$** (Negative Penalty) | **$\le 0.50$** | Applied whenever candidate exhibits categorical disqualifiers (e.g. institution, film, train, person). | Subtracted directly |

### 3.2 Categorical Disqualifiers & Anti-Pattern Rules ($P_{negative}$)

The matcher maintains a strict **Taxonomic Anti-Pattern Registry**:

```python
NEGATIVE_INDICATORS = {
    # If DAPOBUD entity is a traditional craft, martial art, dance, or ritual:
    "craft_or_performance": {
        "disqualifying_title_tokens": [
            "museum", "yayasan", "stasiun", "kri", "film", "lagu", 
            "album", "perusahaan", "toko", "bandara", "tokoh"
        ],
        "penalty": 0.45
    },
    # If DAPOBUD entity is an intangible cultural practice (not an ethnic population):
    "intangible_tradition": {
        "disqualifying_title_tokens": ["suku", "marga", "bahasa"],
        "penalty": 0.35
    }
}
```

### 3.3 Disambiguation & Parenthetical Qualifier Logic

MediaWiki titles frequently feature parenthetical disambiguators (e.g. `Debus (seni)` vs `Debus (tokoh)`). The new matcher implements **Qualifier Harmonization**:
1. Candidate `Title (Qualifier)` is split into `CoreTitle` and `Qualifier`.
2. The `Qualifier` is checked against the DAPOBUD domain:
   - For `Debus (seni)`: `Qualifier = "seni"`. DAPOBUD domain is `Seni Pertunjukan`. This matches with 100% domain affinity ($S_{domain} = 1.0$), and `CoreTitle = "Debus"` has a 100% exact match with the extracted cultural headword!
   - For `Suku Banten`: Title contains `"Suku"`. DAPOBUD domain is `Seni Pertunjukan`. An ethnic group is not a performance art. This triggers $P_{negative} = 0.35$, instantly suppressing `Suku Banten`!

### 3.4 Resolving the Two Forensic False Positives

#### A. Case Study 1: `Debus Banten`
- **DAPOBUD Source Record:** Name: `"Debus Banten"`, Domain: `"Seni Pertunjukan"`, Province: `"Banten"`.
- **Wikipedia Candidates:** `["Debus (seni)", "Banten", "Kesultanan Banten", "Suku Banten", "Debus"]`.
- **Old Matcher Behavior:**
  - `token_sort_ratio("debus banten", "suku banten")` = 69.56% + 8% context boost = 77.6% (`fuzzy_review`, promoted).
  - `token_sort_ratio("debus banten", "debus seni")` = 45.45% (rejected).
- **New Semantic Matcher Behavior:**
  1. Candidate 1: `Debus (seni)`:
     - Core Title: `"Debus"`, Qualifier: `"seni"`.
     - Headword Match: `"Debus"` matches core token of `"Debus Banten"` ($S_{name} = 0.85$).
     - Domain Match: `"seni"` matches `"Seni Pertunjukan"` ($S_{domain} = 1.0$).
     - Geo Match: Extract mentions Banten ($S_{geo} = 1.0$).
     - Penalty: 0.0.
     - **Composite Score:** $(0.40 	imes 0.85) + (0.25 	imes 1.0) + (0.20 	imes 1.0) + (0.15 	imes 0.60) = 0.880$.
  2. Candidate 4: `Suku Banten`:
     - Disqualifier `"suku"` triggered for performance art domain ($P_{negative} = 0.35$).
     - Domain Match: Incompatible ($S_{domain} = 0.0$).
     - **Composite Score:** $(0.40 	imes 0.70) + 0 + (0.20 	imes 1.0) + (0.15 	imes 0.30) - 0.35 = 0.175$.
- **Result:** `Debus (seni)` is matched with high confidence (0.880). False positive is mathematically eliminated.

#### B. Case Study 2: `Batik Indonesia`
- **DAPOBUD Source Record:** Name: `"Batik Indonesia"`, Domain: `"Ketrampilan dan Kemahiran Kerajinan Tradisional"`.
- **Wikipedia Candidates:** `["Batik", "Sejarah batik di Indonesia", "Batik Parang", "Museum Batik Indonesia", "Hari Batik Nasional"]`.
- **Old Matcher Behavior:**
  - `Museum Batik Indonesia`: Contains all words of `"Batik Indonesia"` plus `"Museum"` -> 81.08% (`fuzzy_review`, promoted).
  - `Batik`: 50% (rejected).
- **New Semantic Matcher Behavior:**
  1. Candidate 4: `Museum Batik Indonesia`:
     - Title contains `"Museum"`. DAPOBUD domain is a traditional craft/skill, not a building/institution.
     - Disqualifier triggered: $P_{negative} = 0.45$.
     - **Composite Score:** Maximum possible capped at $< 0.45$. Immediately rejected.
  2. Candidate 1: `Batik`:
     - Headword normalization: `"Batik Indonesia"` -> Core cultural noun `"Batik"` (national suffix stripped).
     - Name Score: Exact headword match ($S_{name} = 1.0$).
     - Domain Match: Extract describes textile dye craft ($S_{domain} = 1.0$).
     - Geo Match: National scope ($S_{geo} = 0.80$).
     - Penalty: 0.0.
     - **Composite Score:** $(0.40 	imes 1.0) + (0.25 	imes 1.0) + (0.20 	imes 0.80) + (0.15 	imes 0.75) = 0.922$.
- **Result:** `Batik` is selected as the primary canonical article (Score: 0.922). `Museum Batik Indonesia` is eliminated.

### 3.5 Conservative Acceptance Thresholds & Review Matrix

```
       Composite Score (S)
  1.0 ┌──────────────────────────────────────────────┐
      │ AUTOMATIC APPROVAL                           │
      │ Review Status: "not_required"                │
 0.85 ├──────────────────────────────────────────────┤
      │ CONDITIONAL ACCEPTANCE                       │
      │ Valid if S_domain >= 0.80; else Review       │
 0.75 ├──────────────────────────────────────────────┤
      │ MANDATORY HUMAN REVIEW                       │
      │ Review Status: "requires_review"             │
 0.65 ├──────────────────────────────────────────────┤
      │ AUTOMATIC REJECTION                          │
      │ Status: "no_match"                           │
  0.0 └──────────────────────────────────────────────┘
```

---

## 4. ENTITY DEDUPLICATION STRATEGY

### 4.1 The DAPOBUD Administrative Duplication Problem
The forensic verification discovered 5 duplicate names across the 25 OPK records. Analysis revealed that these represent **identical cultural traditions registered at differing administrative jurisdictions**:

| Cultural Item Name | Registration 1 (UUID / Number / Tier) | Registration 2 (UUID / Number / Tier) | Remediation Resolution |
|:---|:---|:---|:---|
| **Adrem** | `46382fda...` / `OP.5151.20240104.00002` (Provinsi DIY) | `bc6686e7...` / `OP.6061.20240102.00007` (Kab. Bantul, DIY) | Consolidate into 1 canonical entity; attach both provincial and kabupaten registration records. |
| **ADAT BUANTAK** | `eb3299fd...` / `OP.5151.20240228.00067` (Provinsi Lampung) | `cd24c58c...` / `OP.6161.20240221.00003` (Kab. Pesisir Barat) | Consolidate into 1 canonical entity; attach both source records. |
| **ADIDANG** | `235c4bd2...` / `OP.5151.20240229.00004` (Provinsi Lampung) | `783981a4...` / `OP.6161.20240229.00003` (Kab. Pesisir Barat) | Consolidate into 1 canonical entity; attach both source records. |
| **Acaineno** | `64373054...` / `OP.6061.20240129.00049` (Kab. Yalimo) | `c6e2e236...` / `OP.6061.20240129.00063` (Kab. Yalimo) | Consolidate duplicate community filings into 1 canonical entity with 2 source citations. |
| **Aek Soap** | `96407976...` / `OP.6161.20240128.00001` (Kab. Yalimo) | `3a46489e...` / `OP.6161.20240128.00003` (Kab. Yalimo) | Consolidate duplicate community filings into 1 canonical entity with 2 source citations. |

### 4.2 Deduplication Invariants & Rules
1. **Never Delete Source Records:** All 50 raw DAPOBUD records, their official UUIDs, and registration numbers must remain 100% intact within the `source_records` array.
2. **Canonical Entity Key:** Grouping is executed using a compound deduplication key:
   $$	ext{DedupKey} = 	ext{CleanHeadword}(	ext{Name}) + 	ext{"::"} + 	ext{NormalizedDomain} + 	ext{"::"} + 	ext{ResolvedProvince}$$
3. **Consolidation Output:**
   - 50 Source Records $\longrightarrow$ **45 Canonical Entities**.
   - No data loss. 100% auditability maintained.

---

## 5. REGIONAL CLASSIFICATION STRATEGY

### 5.1 Multi-Province and National Heritage Handling
The forensic audit confirmed that 4 records in the WBTb dataset have `province: null` in DAPOBUD because they transcend a single provincial boundary. The engine must never fabricate arbitrary province codes, but instead support a robust **Geographic Scope Hierarchy**:

```
GEOGRAPHIC SCOPE HIERARCHY
├── single_province (e.g. Rencong -> Aceh)
├── multi_province (e.g. Tabot / Tabuik -> Bengkulu & Sumatera Barat)
├── national (e.g. Batik Indonesia -> Seluruh Indonesia / Lintas Provinsi)
└── unassigned (requires human archivist input; marked explicitly)
```

### 5.2 Authoritative Resolution Matrix for the 4 Special Cases

| Cultural Heritage Name | DAPOBUD Raw Province | Proposed `scope_type` | Standardized Provinces Assigned | Primary Game Region | Authoritative Justification |
|:---|:---:|:---:|:---|:---:|:---|
| **Batik Indonesia** | `null` | `national` | `["Seluruh Indonesia"]` | `Nasional` | UNESCO Intangible Cultural Heritage of Humanity (2009); national cultural symbol across Java, Sumatra, Madura, Kalimantan, etc. |
| **Tabot atau Tabuik** | `null` | `multi_province` | `["Bengkulu", "Sumatera Barat"]` | `Sumatra` | Explicit dual ceremony: Tabot celebrated in Bengkulu City; Tabuik celebrated in Pariaman, West Sumatra. |
| **Aksara dan Naskah Ka Ga Nga** | `null` | `multi_province` | `["Bengkulu", "Sumatera Selatan", "Lampung"]` | `Sumatra` | Ancient Rencong/Ulu script family shared across South Sumatra, Rejang (Bengkulu), and Lampung highlands. |
| **Rumah Panjang Dayak** | `null` | `multi_province` | `["Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Timur"]` | `Kalimantan` | Indigenous communal architecture indigenous across Dayak tribes in West, Central, and East Kalimantan. |

---

## 6. IMAGE LICENSING & PROVENANCE REQUIREMENTS

### 6.1 Mandatory Image Provenance Contract
Every image asset linked to a canonical entity must satisfy the **RAGAMARA Media Compliance Contract**:

```json
{
  "asset_id": "sha256_hash_of_url",
  "asset_type": "image",
  "role": "hero",
  "file_title": "File:COLLECTIE_TROPENMUSEUM_Dolk_met_rechthoekig_gebogen_hoornen_greep_en_houten_schede_TMnr_151-19.jpg",
  "thumbnail_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/.../800px-....jpg",
  "original_url": "https://upload.wikimedia.org/wikipedia/commons/3/3f/....jpg",
  "file_page_url": "https://commons.wikimedia.org/wiki/File:COLLECTIE_TROPENMUSEUM_Dolk_....jpg",
  "creator": "Tropenmuseum",
  "license": "CC BY-SA 3.0",
  "license_url": "https://creativecommons.org/licenses/by-sa/3.0",
  "attribution_text": "Tropenmuseum, CC BY-SA 3.0, via Wikimedia Commons",
  "commercial_use_permitted": true,
  "cultural_relevance_status": "verified_authentic",
  "verification_timestamp": "2026-11-14T03:39:49Z"
}
```

### 6.2 Image Remediation for False Positives
Because `Debus Banten` and `Batik Indonesia` matched wrong Wikipedia articles in the previous run, their current attached images are culturally inappropriate:
1. `Debus Banten`: Currently holds `File:Bantenese_wedding.jpg` (wedding procession).
   - **Remediation Action:** Tag with `cultural_relevance_status: "requires_replacement"`. Re-query Wikimedia Commons specifically for `File:*Debus*` or unbind image until curated asset is uploaded.
2. `Batik Indonesia`: Currently holds `File:Museum_batik_indonesia.png` (museum building exterior).
   - **Remediation Action:** Tag with `cultural_relevance_status: "requires_replacement"`. Re-query for canonical Batik textile image (e.g. `File:Batik_fabric_patterns.jpg`) from the verified `Batik` article.

---

## 7. VALIDATION AND REGRESSION TESTING PLAN

To prevent future data pipeline drift or false positives, the test suite must be expanded from 14 to **22 automated tests**, including dedicated regression verification.

### 7.1 Regression Test Suite Specifications (`tests/test_regression_remediation.py`)

```python
import pytest
from src.matching import CulturalMatcher
from src.deduplication import EntityDeduplicator
from src.regional import RegionalScopeResolver

def test_regression_debus_banten_never_matches_suku_banten():
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Debus (seni)", "snippet": "Debus adalah seni bela diri asal Banten..."},
        {"title": "Suku Banten", "snippet": "Suku Banten adalah kelompok etnis..."},
        {"title": "Banten", "snippet": "Banten adalah provinsi..."}
    ]
    result = matcher.find_best_match(
        official_name="Debus Banten",
        candidates=candidates,
        cultural_domain="Seni Pertunjukan",
        province="Banten"
    )
    assert result["matched_candidate"]["title"] == "Debus (seni)"
    assert result["matched_candidate"]["title"] != "Suku Banten"
    assert result["confidence"] >= 0.85

def test_regression_batik_indonesia_never_matches_museum_batik():
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Museum Batik Indonesia", "snippet": "Museum di TMII Jakarta..."},
        {"title": "Batik", "snippet": "Batik adalah kain bergambar khas Indonesia..."},
        {"title": "Sejarah batik di Indonesia", "snippet": "Perkembangan kerajinan batik..."}
    ]
    result = matcher.find_best_match(
        official_name="Batik Indonesia",
        candidates=candidates,
        cultural_domain="Ketrampilan dan Kemahiran Kerajinan Tradisional",
        province=None
    )
    assert result["matched_candidate"]["title"] == "Batik"
    assert "Museum" not in result["matched_candidate"]["title"]
    assert result["confidence"] >= 0.88

def test_regression_entity_deduplication_yields_45_entities():
    deduplicator = EntityDeduplicator()
    # Ingesting the 50 raw DAPOBUD records
    entities = deduplicator.consolidate_records(raw_50_records)
    assert len(entities) == 45
    # Verify Adrem contains exactly 2 source records
    adrem = next(e for e in entities if e["canonical_name"] == "Adrem")
    assert len(adrem["source_records"]) == 2
    assert {s["registration_number"] for s in adrem["source_records"]} == {
        "OP.5151.20240104.00002", "OP.6061.20240102.00007"
    }

def test_regression_multi_province_assignments():
    resolver = RegionalScopeResolver()
    scope = resolver.resolve("Tabot atau Tabuik", None)
    assert scope["scope_type"] == "multi_province"
    assert set(scope["provinces"]) == {"Bengkulu", "Sumatera Barat"}
    assert scope["primary_game_region"] == "Sumatra"
```

### 7.2 Data Integrity Invariants Checked in CI
1. `assert len(unique_entity_ids) == len(entities)`
2. `assert len(unique_dapobud_uuids) == 50`
3. `assert all(img["commercial_use_permitted"] for e in entities for img in e["media"])`
4. `assert byte_content(ragamara_culture_db.json) == byte_content(js/culture_db_data.js)`

---

## 8. IMPLEMENTATION SEQUENCE

Implementation must proceed strictly in an 8-stage sequence to guarantee zero regression:

```
STAGE 1: Models & Schemas (src/models.py, config/settings.py)
   │
   ▼
STAGE 2: Semantic Matcher Refactor (src/matching.py, src/normalization.py)
   │
   ▼
STAGE 3: Entity Deduplication Engine (src/deduplication.py)
   │
   ▼
STAGE 4: Regional Scope Resolver (src/regional.py)
   │
   ▼
STAGE 5: Media Provenance Hardener (src/enrichment.py, src/mediawiki_client.py)
   │
   ▼
STAGE 6: Pipeline & Storage Orchestration (src/pipeline.py, src/storage.py, src/data_validator.py)
   │
   ▼
STAGE 7: Automated Test Suite Expansion (tests/test_regression_remediation.py)
   │
   ▼
STAGE 8: Pipeline Execution & Frontend JS Synchronization (main.py, js/culture_db_data.js)
```

---

## 9. RISKS AND ROLLBACK STRATEGY

### 9.1 Risk Assessment & Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
|:---|:---:|:---:|:---|
| **Breaking Frontend Bindings:** `js/ecosystem.js` expects the legacy flat `records` schema. | High | High | Implement a **Backward Compatibility Adapter** inside `js/ecosystem.js` that checks for schema version `2.0.0` and extracts canonical properties smoothly without breaking Culturepedia UI. |
| **MediaWiki Rate Limiting or 429:** Repeated Wikipedia queries during re-enrichment. | Medium | Low | Reuse existing 87 `data/cache/wiki_get_*.json` files. The new matcher operates locally on cached responses without hitting external networks. |
| **Unintended Loss of Raw DAPOBUD Attributes:** Dropping fields during canonical normalization. | Critical | Low | Retain raw JSON payloads inside `source_records[i].raw_payload_snippet`. |

### 9.2 Rollback Procedure
Before making any changes, an automated backup will be generated:
```bash
cp /home/firza-ilmi/.gemini/antigravity/scratch/ragamara/ragamara_culture_db.json    /home/firza-ilmi/.gemini/antigravity/scratch/ragamara/data/backups/ragamara_culture_db_v1_backup.json
cp /home/firza-ilmi/.gemini/antigravity/scratch/ragamara/js/culture_db_data.js    /home/firza-ilmi/.gemini/antigravity/scratch/ragamara/data/backups/culture_db_data_v1_backup.js
```
If validation tests fail or frontend rendering breaks during QA, the backup files can be restored atomically in under 5 seconds.

---

## 10. EXACT FILES EXPECTED TO CHANGE DURING IMPLEMENTATION

### Files to Modify:
1. `ragamara-data-engine/config/settings.py` — Add schema version `2.0.0`, matching weights, and category mappings.
2. `ragamara-data-engine/src/matching.py` — Replace single token sort ratio with the multi-factor semantic scorer.
3. `ragamara-data-engine/src/normalization.py` — Add headword extractor, qualifier parser, and domain normalizer.
4. `ragamara-data-engine/src/enrichment.py` — Integrate new semantic matching and media provenance flags.
5. `ragamara-data-engine/src/data_validator.py` — Update schema validators to enforce `v2.0.0` canonical invariants.
6. `ragamara-data-engine/src/storage.py` — Add automated generation of `js/culture_db_data.js` during atomic writes.
7. `ragamara-data-engine/src/pipeline.py` — Orchestrate deduplication, regional resolution, and schema v2 output.
8. `ragamara-data-engine/tests/test_matching.py` — Update unit tests for multi-factor scoring.
9. `ragamara-data-engine/tests/test_validation.py` — Validate v2 canonical schema.
10. `js/ecosystem.js` — Update data ingestion adapter to support `v2.0.0` while maintaining legacy fallback.

### New Files to Create:
1. `ragamara-data-engine/src/models.py` — Strongly typed Python dataclasses / TypedDicts for canonical entities.
2. `ragamara-data-engine/src/deduplication.py` — Ingestion aggregator merging multi-tier registrations.
3. `ragamara-data-engine/src/regional.py` — Multi-province and nationwide heritage scope resolver.
4. `ragamara-data-engine/tests/test_regression_remediation.py` — Regression tests for Debus Banten and Batik Indonesia.
5. `ragamara-data-engine/tests/test_deduplication.py` — Tests for canonical consolidation.
6. `ragamara-data-engine/tests/test_regional.py` — Tests for regional scope resolution.

---

## 11. PRIORITIZED IMPLEMENTATION ROADMAP

```
[P0: CRITICAL (Safety & Regressions)]
  ├── Task P0.1: Create non-destructive backups of existing JSON and JS datasets.
  ├── Task P0.2: Implement Multi-Factor Semantic Matcher in src/matching.py.
  └── Task P0.3: Author tests/test_regression_remediation.py asserting Debus Banten & Batik Indonesia fixes.

[P1: ARCHITECTURE (Canonical Model & Deduplication)]
  ├── Task P1.1: Create src/models.py defining CanonicalEntity & SourceRecord schemas.
  ├── Task P1.2: Implement src/deduplication.py consolidating 50 source records into 45 canonical entities.
  └── Task P1.3: Author tests/test_deduplication.py verifying zero UUID loss.

[P2: REGIONAL & PROVENANCE HARDENING]
  ├── Task P2.1: Implement src/regional.py with authoritative multi-province & national matrices.
  ├── Task P2.2: Hardening media provenance in src/enrichment.py with relevance status flags.
  └── Task P2.3: Update src/data_validator.py with v2.0.0 schema checks.

[P3: DEPLOYMENT & SYNC]
  ├── Task P3.1: Execute pipeline re-build outputting schema v2.0.0 ragamara_culture_db.json.
  ├── Task P3.2: Synchronize js/culture_db_data.js and adapt js/ecosystem.js.
  └── Task P3.3: Execute full 22-test Pytest suite and verify Culturepedia browser rendering.
```

---
> **AUDITOR SIGN-OFF NOTICE:**  
> This remediation specification is complete and frozen. In accordance with strict instructions, **no application files, databases, or code have been modified**. Standing by for explicit user review and directive to commence implementation.
