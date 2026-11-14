"""
Tests for Cultural Matching Engine and Normalization.
"""

import pytest
from src.matching import CulturalMatcher
from src.normalization import normalize_cultural_name, clean_matching_key, normalize_province


def test_normalization():
    assert normalize_cultural_name("  \"Tari Saman\"  ") == "Tari Saman"
    assert clean_matching_key("Tari Piring") == "piring"
    assert clean_matching_key("Rumah Adat Gadang") == "gadang"
    assert normalize_province("SUMATERA BARAT") == "Sumatera Barat"
    assert normalize_province("DKI JAKARTA") == "DKI Jakarta"


def test_exact_matching():
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Rencong", "snippet": "Senjata tradisional Aceh"},
        {"title": "KRI Rencong", "snippet": "Kapal perang"}
    ]
    res = matcher.find_best_match("Rencong", candidates)
    assert res["confidence"] == 1.0
    assert res["method"] == "exact"
    assert res["review_status"] == "not_required"
    assert res["matched_candidate"]["title"] == "Rencong"


def test_normalized_prefix_matching():
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Tari Saman", "snippet": "Tarian suku Gayo di Aceh"}
    ]
    res = matcher.find_best_match("Saman", candidates)
    assert res["confidence"] >= 0.95
    assert res["matched_candidate"]["title"] == "Tari Saman"


def test_disambiguation_filtering():
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Batik (disambiguasi)", "snippet": "Halaman disambiguasi"},
        {"title": "Batik", "snippet": "Kain bergambar khas Indonesia"}
    ]
    res = matcher.find_best_match("Batik", candidates)
    assert res["matched_candidate"]["title"] == "Batik"


def test_no_match():
    matcher = CulturalMatcher()
    candidates = [
        {"title": "Pesawat Terbang", "snippet": "Kendaraan udara"}
    ]
    res = matcher.find_best_match("Gamelan Jawa", candidates)
    assert res["method"] == "no_match"
    assert res["matched_candidate"] is None
