"""
Tests for Data Validator and Storage Manager.
"""

import pytest
from src.data_validator import DataValidator
from src.storage import StorageManager


def test_record_id_deterministic():
    id1 = StorageManager.generate_record_id("123", "WBTB", "Rendang", "Sumatera Barat")
    id2 = StorageManager.generate_record_id("123", "WBTB", "Rendang", "Sumatera Barat")
    assert id1 == id2
    assert id1 == "id_dapobud_123"

    hash_id1 = StorageManager.generate_record_id(None, "OPK", "Tari Piring", "Sumatera Barat")
    hash_id2 = StorageManager.generate_record_id(None, "OPK", "Tari Piring", "Sumatera Barat")
    assert hash_id1 == hash_id2
    assert hash_id1.startswith("id_hash_")


def test_validator_detects_invalid_record():
    validator = DataValidator()
    invalid_rec = {
        "record_id": "invalid_id",
        "name": "",
        "dapobud": {"entity_type": "UNKNOWN_TYPE"},
        "wikipedia": {"status": "invalid_status"}
    }
    is_valid, issues = validator.validate_record(invalid_rec)
    assert not is_valid
    assert len(issues) >= 3


def test_validator_full_audit():
    validator = DataValidator()
    db = {
        "records": [
            {
                "record_id": "id_dapobud_1",
                "name": "Rendang",
                "normalized_name": "Rendang",
                "dapobud": {
                    "entity_type": "WBTB",
                    "region": {"province": "Sumatera Barat"}
                },
                "wikipedia": {
                    "status": "matched",
                    "page_url": "https://id.wikipedia.org/wiki/Rendang",
                    "image": {"thumbnail_url": "https://upload.wikimedia.org/test.jpg", "license": "CC-BY"}
                },
                "quality": {}
            }
        ]
    }
    audit = validator.validate_and_audit_database(db)
    assert audit["summary"]["total_records"] == 1
    assert audit["summary"]["wbtb_records"] == 1
    assert audit["summary"]["matched_wikipedia_articles"] == 1
    assert audit["summary"]["records_with_images"] == 1
