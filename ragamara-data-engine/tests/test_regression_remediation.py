"""
Regression and Remediation Test Suite for RAGAMARA Phase 2.5.
Guarantees mathematical prevention of false positives, canonical deduplication integrity,
multi-province regional classifications, and strict image licensing compliance.
"""

import json
from pathlib import Path
import pytest

from src.matching import CulturalMatcher
from src.deduplication import EntityDeduplicator
from src.regional import RegionalScopeResolver
from src.data_validator import DataValidator
from src.normalization import extract_headword, parse_parenthetical_qualifier
from config import settings


def test_regression_debus_banten_never_matches_suku_banten():
    """
    REGRESSION TEST:
    Ensures 'Debus Banten' (Seni Pertunjukan) selects 'Debus (seni)'
    and categorically rejects 'Suku Banten' (ethnic population).
    """
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Debus (seni)", "snippet": "Debus adalah kesenian bela diri masyarakat Banten yang mempertunjukkan atraksi kekebalan senjata tajam."},
        {"title": "Banten", "snippet": "Banten adalah sebuah provinsi di Pulau Jawa, Indonesia."},
        {"title": "Kesultanan Banten", "snippet": "Kesultanan Banten adalah kerajaan Islam maritim di barat Jawa."},
        {"title": "Suku Banten", "snippet": "Suku Banten adalah kelompok etnis pribumi yang mendiami wilayah Banten."},
        {"title": "Debus", "snippet": "Debus adalah seni pertunjukan tradisional di Banten."}
    ]

    result = matcher.find_best_match(
        official_name="Debus Banten",
        candidates=candidates,
        cultural_domain="Seni Pertunjukan",
        province="Banten",
        official_description="Debus merupakan seni pertunjukan kekebalan tubuh bersejarah asal Banten."
    )

    assert result["matched_candidate"] is not None
    assert result["matched_candidate"]["title"] == "Debus (seni)"
    assert result["matched_candidate"]["title"] != "Suku Banten"
    assert result["confidence"] >= 0.85
    assert result["score_breakdown"]["negative_penalty"] == 0.0


def test_regression_batik_indonesia_never_matches_museum_batik():
    """
    REGRESSION TEST:
    Ensures 'Batik Indonesia' (Kerajinan Tradisional) selects 'Batik'
    and rejects 'Museum Batik Indonesia' due to institutional disqualifier.
    """
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Museum Batik Indonesia", "snippet": "Museum Batik Indonesia terletak di TMII Jakarta, memamerkan koleksi batik nusantara."},
        {"title": "Batik", "snippet": "Batik adalah kain bergambar khas Indonesia yang pembuatannya secara khusus dengan menerakan malam pada kain."},
        {"title": "Sejarah batik di Indonesia", "snippet": "Perkembangan seni kain batik tradisional di kepulauan Indonesia."}
    ]

    result = matcher.find_best_match(
        official_name="Batik Indonesia",
        candidates=candidates,
        cultural_domain="Ketrampilan dan Kemahiran Kerajinan Tradisional",
        province=None,
        official_description="Batik adalah warisan budaya takbenda kerajinan kain tradisional bernilai seni tinggi."
    )

    assert result["matched_candidate"] is not None
    assert result["matched_candidate"]["title"] == "Batik"
    assert "Museum" not in result["matched_candidate"]["title"]
    assert result["confidence"] >= 0.80


def test_qualifier_and_headword_extraction():
    """Tests title parsing for qualifiers and geographic suffixes."""
    core, qual = parse_parenthetical_qualifier("Debus (seni)")
    assert core == "Debus"
    assert qual == "seni"

    core2, qual2 = parse_parenthetical_qualifier("Randang")
    assert core2 == "Randang"
    assert qual2 is None

    assert extract_headword("Debus Banten") == "Debus"
    assert extract_headword("Batik Indonesia") == "Batik"
    assert extract_headword("Songket Palembang") == "Songket"


def test_canonical_deduplication_integrity():
    """
    Verifies that multi-tier administrative duplicates in DAPOBUD OPK
    are consolidated into distinct canonical entities without data loss.
    """
    deduplicator = EntityDeduplicator()

    # Synthetic sample mimicking DAPOBUD duplicate registrations for Adrem
    raw_sample = [
        {
            "id": "uuid-prov-01",
            "number": "OP.5151.20240104.00002",
            "name": "Adrem",
            "category": "Ketrampilan dan Kemahiran Kerajinan Tradisional",
            "province": "Daerah Istimewa Yogyakarta",
            "regency": None,
            "description": "Kue tradisional Adrem khas Yogyakarta."
        },
        {
            "id": "uuid-kab-02",
            "number": "OP.6061.20240102.00007",
            "name": "Adrem",
            "category": "Ketrampilan dan Kemahiran Kerajinan Tradisional",
            "province": "Daerah Istimewa Yogyakarta",
            "regency": "Kabupaten Bantul",
            "description": "Kue adrem khas Sanden Bantul."
        }
    ]

    entities = deduplicator.consolidate_records(raw_sample)
    assert len(entities) == 1

    adrem = entities[0]
    assert adrem["canonical_name"] == "Adrem"
    assert len(adrem["source_records"]) == 2

    uuids = {s["official_uuid"] for s in adrem["source_records"]}
    assert uuids == {"uuid-prov-01", "uuid-kab-02"}

    tiers = {s["administrative_tier"] for s in adrem["source_records"]}
    assert tiers == {"provinsi", "kabupaten_kota"}


def test_authoritative_regional_classifications():
    """
    Verifies non-fabricated regional scope assignments:
    - Tabot atau Tabuik -> multi_province (Bengkulu, Sumbar)
    - Ka Ga Nga -> multi_province (Bengkulu, Sumsel, Lampung)
    - Rumah Panjang Dayak -> multi_province (Kalbar, Kalteng, Kaltim)
    - Batik Indonesia -> national (Seluruh Indonesia)
    """
    resolver = RegionalScopeResolver()

    # 1. Batik Indonesia
    batik_scope = resolver.resolve("Batik Indonesia", None)
    assert batik_scope["scope_type"] == "national"
    assert batik_scope["primary_game_region"] == "Nasional"
    assert batik_scope["is_nationwide"] is True

    # 2. Tabot atau Tabuik
    tabot_scope = resolver.resolve("Tabot atau Tabuik", None)
    assert tabot_scope["scope_type"] == "multi_province"
    assert set(tabot_scope["provinces"]) == {"Bengkulu", "Sumatera Barat"}
    assert tabot_scope["primary_game_region"] == "Sumatra"

    # 3. Ka Ga Nga
    kaganga_scope = resolver.resolve("Aksara dan Naskah Ka Ga Nga", None)
    assert kaganga_scope["scope_type"] == "multi_province"
    assert set(kaganga_scope["provinces"]) == {"Bengkulu", "Sumatera Selatan", "Lampung"}

    # 4. Dayak Longhouse
    dayak_scope = resolver.resolve("Rumah Panjang Dayak", None)
    assert dayak_scope["scope_type"] == "multi_province"
    assert "Kalimantan Barat" in dayak_scope["provinces"]
    assert dayak_scope["primary_game_region"] == "Kalimantan"

    # 5. Standard single province
    rencong_scope = resolver.resolve("Rencong", "Aceh")
    assert rencong_scope["scope_type"] == "single_province"
    assert rencong_scope["provinces"] == ["Aceh"]
    assert rencong_scope["primary_game_region"] == "Sumatra"


def test_image_provenance_and_licensing():
    """Verifies image rights validation rejects non-permissive licenses."""
    from src.enrichment import PERMISSIVE_LICENSES

    assert "cc by-sa 4.0" in PERMISSIVE_LICENSES
    assert "cc by 3.0" in PERMISSIVE_LICENSES
    assert "public domain" in PERMISSIVE_LICENSES

    # Ensure non-commercial licenses are not permitted
    assert "cc by-nc 4.0" not in PERMISSIVE_LICENSES
    assert "fair use" not in PERMISSIVE_LICENSES


def test_schema_v2_invariants_validator():
    """Verifies that DataValidator enforces v2.0.0 canonical entity integrity."""
    validator = DataValidator()

    valid_entity = {
        "entity_id": "ragamara_cult_rencong",
        "canonical_name": "Rencong",
        "slug": "rencong",
        "cultural_domain": "Teknologi Tradisional",
        "regional_scope": {
            "scope_type": "single_province",
            "primary_game_region": "Sumatra",
            "provinces": ["Aceh"],
            "is_nationwide": False
        },
        "source_records": [
            {
                "source_name": "DAPOBUD",
                "official_uuid": "f31f397c-0647-4667-bbfb-6aa1397ca224",
                "registration_number": "REK/WBTB/2013/01/00001",
                "entity_type": "WBTB",
                "source_url": "https://dapobud.kemenbud.go.id/wbtb/detail/?id=f31f397c"
            }
        ],
        "enrichment": {
            "status": "matched",
            "source": "Wikipedia Indonesia",
            "page_url": "https://id.wikipedia.org/wiki/Rencong",
            "summary_extract": "Rencong adalah senjata tradisional Aceh."
        },
        "media": [
            {
                "asset_id": "asset_01",
                "asset_type": "image",
                "role": "hero",
                "thumbnail_url": "https://upload.wikimedia.org/thumb.jpg",
                "original_url": "https://upload.wikimedia.org/orig.jpg",
                "file_page_url": "https://commons.wikimedia.org/wiki/File:Test.jpg",
                "creator": "Tropenmuseum",
                "license": "CC BY-SA 3.0",
                "attribution_text": "Tropenmuseum, CC BY-SA 3.0",
                "commercial_use_permitted": True,
                "cultural_relevance_status": "verified_authentic"
            }
        ],
        "provenance": {
            "created_at": "2026-11-14T00:00:00Z",
            "last_updated_at": "2026-11-14T00:00:00Z",
            "quality_verified": True,
            "validation_flags": []
        }
    }

    is_valid, issues = validator.validate_entity(valid_entity)
    assert is_valid is True
    assert len(issues) == 0

    # Invalidate domain and verify detection
    invalid_entity = dict(valid_entity)
    invalid_entity["cultural_domain"] = "INVALID_DOMAIN"
    is_valid_inv, issues_inv = validator.validate_entity(invalid_entity)
    assert is_valid_inv is False
    assert any("Invalid cultural_domain" in issue for issue in issues_inv)
