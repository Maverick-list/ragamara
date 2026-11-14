"""
Data Validator Module for RAGAMARA Cultural Knowledge Database.
Validates Schema Version 2.0.0 invariants, multi-tier provenance, and legal media rights.
"""

import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings

logger = logging.getLogger("ragamara.validator")

VALID_DOMAINS = [
    "Tradisi Lisan", "Manuskrip", "Adat Istiadat", "Ritus",
    "Pengetahuan Tradisional", "Teknologi Tradisional", "Seni",
    "Bahasa", "Permainan Rakyat", "Olahraga Tradisional", "Cagar Budaya", "Lainnya"
]

VALID_GAME_REGIONS = [
    "Sumatra", "Jawa", "Bali & Nusa Tenggara", "Kalimantan",
    "Sulawesi", "Maluku", "Papua", "Nasional"
]


class DataValidator:
    """Validates cultural entities and overall database against Schema v2.0.0 guidelines."""

    def __init__(self):
        self.url_pattern = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)

    def validate_entity(self, entity: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validates an individual canonical cultural entity.
        Returns: (is_valid: bool, issues: List[str])
        """
        issues = []

        # 1. Entity ID & Name
        eid = entity.get("entity_id", "")
        if not eid.startswith("ragamara_cult_"):
            issues.append(f"Invalid entity_id format: {eid}")

        name = entity.get("canonical_name", "")
        if not name or len(name.strip()) == 0:
            issues.append("Missing or empty canonical_name")

        # 2. Domain & Category
        domain = entity.get("cultural_domain")
        if domain not in VALID_DOMAINS:
            issues.append(f"Invalid cultural_domain: {domain}")

        # 3. Regional Scope
        scope = entity.get("regional_scope", {})
        scope_type = scope.get("scope_type")
        if scope_type not in ["single_province", "multi_province", "national", "unassigned"]:
            issues.append(f"Invalid regional scope_type: {scope_type}")

        game_reg = scope.get("primary_game_region")
        if game_reg not in VALID_GAME_REGIONS:
            issues.append(f"Invalid primary_game_region: {game_reg}")

        provinces = scope.get("provinces", [])
        if scope_type in ["single_province", "multi_province", "national"] and not provinces:
            issues.append(f"Empty provinces list for scope_type: {scope_type}")

        # 4. Source Records
        source_records = entity.get("source_records", [])
        if not source_records:
            issues.append("Entity has 0 attached source records (broken provenance)")

        for idx, src in enumerate(source_records):
            uuid_val = src.get("official_uuid")
            if not uuid_val or len(uuid_val) < 8:
                issues.append(f"Source record [{idx}] missing valid official_uuid")

            reg_no = src.get("registration_number")
            if not reg_no:
                issues.append(f"Source record [{idx}] missing registration_number")

            etype = src.get("entity_type")
            if etype not in ["WBTB", "OPK"]:
                issues.append(f"Source record [{idx}] unrecognized entity_type: {etype}")

            url = src.get("source_url")
            if url and not self.url_pattern.match(url):
                issues.append(f"Source record [{idx}] malformed source_url: {url}")

        # 5. Enrichment Layer
        enrichment = entity.get("enrichment", {})
        status = enrichment.get("status")
        if status not in ["matched", "no_match", "manual_override"]:
            issues.append(f"Invalid enrichment status: {status}")

        if status == "matched":
            page_url = enrichment.get("page_url")
            if not page_url or not self.url_pattern.match(page_url):
                issues.append(f"Missing or malformed Wikipedia page_url: {page_url}")

        # 6. Media Assets
        for m_idx, media in enumerate(entity.get("media", [])):
            thumb = media.get("thumbnail_url")
            if thumb and not self.url_pattern.match(thumb):
                issues.append(f"Media [{m_idx}] malformed thumbnail_url: {thumb}")

            if not media.get("license"):
                issues.append(f"Media [{m_idx}] missing license identifier")

            if not media.get("commercial_use_permitted"):
                issues.append(f"Media [{m_idx}] not certified for commercial distribution")

        is_valid = len(issues) == 0
        return is_valid, issues

    def validate_record(self, record: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validates an individual cultural record (legacy schema or source record).
        Maintains backward compatibility with test_validation.py.
        """
        issues = []
        name = record.get("name") or record.get("canonical_name")
        if not name or len(str(name).strip()) == 0 or name == "Tanpa Nama":
            issues.append("Missing or invalid cultural name")

        rid = record.get("record_id") or record.get("entity_id")
        if not rid or not (rid.startswith("id_dapobud_") or rid.startswith("id_hash_") or rid.startswith("ragamara_cult_")):
            issues.append(f"Invalid record_id format: {rid}")

        dapobud = record.get("dapobud", {})
        etype = dapobud.get("entity_type")
        if etype and etype not in ["WBTB", "OPK"]:
            issues.append(f"Unrecognized entity type: {etype}")

        wiki = record.get("wikipedia", {})
        status = wiki.get("status")
        if status and status not in ["matched", "no_match"]:
            issues.append(f"Invalid Wikipedia enrichment status: {status}")

        return len(issues) == 0, issues

    def validate_and_audit_database(self, database: Dict[str, Any]) -> Dict[str, Any]:
        """
        Performs comprehensive quality audit across Schema v2.0.0 canonical database or v1 database.
        Returns quality report dictionary.
        """
        entities = database.get("entities", [])
        legacy_records = database.get("records", [])

        # If entities present, audit entities
        if entities:
            total_entities = len(entities)
        else:
            total_entities = len(legacy_records)

        wbtb_count = 0
        opk_count = 0
        total_source_records = 0
        matched_wiki = 0
        unmatched_wiki = 0
        manual_review_needed = 0
        with_images = 0
        with_verified_licenses = 0
        multi_prov_count = 0
        national_count = 0

        seen_entity_ids = set()
        seen_source_uuids = set()
        seen_reg_numbers = set()
        duplicate_entity_ids = []
        duplicate_uuids = []
        all_validation_issues = []

        if entities:
            for entity in entities:
                eid = entity.get("entity_id")
                if eid in seen_entity_ids:
                    duplicate_entity_ids.append(eid)
                seen_entity_ids.add(eid)

                scope = entity.get("regional_scope", {})
                stype = scope.get("scope_type")
                if stype == "multi_province":
                    multi_prov_count += 1
                elif stype == "national":
                    national_count += 1

                src_records = entity.get("source_records", [])
                total_source_records += len(src_records)

                for src in src_records:
                    uuid_val = src.get("official_uuid")
                    if uuid_val:
                        if uuid_val in seen_source_uuids:
                            duplicate_uuids.append(uuid_val)
                        seen_source_uuids.add(uuid_val)

                    reg_no = src.get("registration_number")
                    if reg_no:
                        seen_reg_numbers.add(reg_no)

                    etype = src.get("entity_type")
                    if etype == "WBTB":
                        wbtb_count += 1
                    elif etype == "OPK":
                        opk_count += 1

                enrichment = entity.get("enrichment", {})
                if enrichment.get("status") == "matched":
                    matched_wiki += 1
                else:
                    unmatched_wiki += 1

                meta = enrichment.get("matching_metadata", {})
                if meta.get("review_status") == "requires_review":
                    manual_review_needed += 1

                media_list = entity.get("media", [])
                if media_list:
                    with_images += 1
                    if all(m.get("commercial_use_permitted") for m in media_list):
                        with_verified_licenses += 1

                is_valid, issues = self.validate_entity(entity)
                entity["provenance"]["quality_verified"] = is_valid
                entity["provenance"]["validation_flags"] = issues
                if issues:
                    all_validation_issues.append({"entity_id": eid, "name": entity.get("canonical_name"), "issues": issues})
        else:
            # Fallback for legacy v1 database
            for r in legacy_records:
                rid = r.get("record_id")
                etype = r.get("dapobud", {}).get("entity_type")
                if etype == "WBTB": wbtb_count += 1
                elif etype == "OPK": opk_count += 1

                wiki = r.get("wikipedia", {})
                if wiki.get("status") == "matched":
                    matched_wiki += 1
                    if wiki.get("image", {}).get("thumbnail_url"): with_images += 1
                    if wiki.get("image", {}).get("license"): with_verified_licenses += 1
                else:
                    unmatched_wiki += 1

                is_valid, issues = self.validate_record(r)
                if issues:
                    all_validation_issues.append({"record_id": rid, "name": r.get("name"), "issues": issues})

        quality_report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "schema_version": settings.SCHEMA_VERSION,
            "summary": {
                "total_records": total_entities,
                "total_canonical_entities": total_entities,
                "total_preserved_source_records": total_source_records or total_entities,
                "wbtb_records": wbtb_count,
                "opk_records": opk_count,
                "wbtb_source_records": wbtb_count,
                "opk_source_records": opk_count,
                "unique_entity_ids": len(seen_entity_ids) or total_entities,
                "unique_official_uuids": len(seen_source_uuids) or total_entities,
                "unique_registration_numbers": len(seen_reg_numbers) or total_entities,
                "matched_wikipedia_articles": matched_wiki,
                "matched_wikipedia_entities": matched_wiki,
                "unmatched_wikipedia_searches": unmatched_wiki,
                "unmatched_wikipedia_entities": unmatched_wiki,
                "entities_requiring_manual_review": manual_review_needed,
                "records_requiring_manual_review": manual_review_needed,
                "entities_with_media": with_images,
                "records_with_images": with_images,
                "entities_with_verified_licenses": with_verified_licenses,
                "records_with_verified_licenses": with_verified_licenses,
                "multi_province_entities": multi_prov_count,
                "national_heritage_entities": national_count,
                "duplicate_entity_ids_detected": len(duplicate_entity_ids),
                "duplicate_source_uuids_detected": len(duplicate_uuids),
                "total_validation_issues": len(all_validation_issues)
            },
            "validation_issues_sample": all_validation_issues[:15]
        }

        return quality_report

    def save_quality_report(self, report_data: Dict[str, Any], output_path: Optional[Path] = None) -> Path:
        """Saves data quality report to JSON."""
        dest = output_path or settings.QUALITY_REPORT_FILE
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved data quality report to {dest}")
        return dest
