"""
Data Validator Module.
Performs integrity validation, schema verification, duplicate detection, and quality metrics generation.
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


class DataValidator:
    """Validates cultural records against production quality guidelines."""

    def __init__(self):
        self.url_pattern = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)

    def validate_record(self, record: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validates an individual cultural record.
        Returns: (is_valid: bool, issues: List[str])
        """
        issues = []

        # 1. Essential Name Check
        name = record.get("name")
        if not name or len(str(name).strip()) == 0 or name == "Tanpa Nama":
            issues.append("Missing or invalid cultural name")

        # 2. Record ID Check
        record_id = record.get("record_id")
        if not record_id or not (record_id.startswith("id_dapobud_") or record_id.startswith("id_hash_")):
            issues.append(f"Invalid record_id format: {record_id}")

        # 3. DAPOBUD Source Check
        dapobud = record.get("dapobud", {})
        entity_type = dapobud.get("entity_type")
        if entity_type not in ["WBTB", "OPK"]:
            issues.append(f"Unrecognized entity type: {entity_type}")

        source_url = dapobud.get("source_url")
        if source_url and not self.url_pattern.match(source_url):
            issues.append(f"Malformed DAPOBUD source_url: {source_url}")

        # 4. Wikipedia Enrichment Checks
        wiki = record.get("wikipedia", {})
        status = wiki.get("status")
        if status not in ["matched", "no_match"]:
            issues.append(f"Invalid Wikipedia enrichment status: {status}")

        if status == "matched":
            wiki_url = wiki.get("page_url")
            if not wiki_url or not self.url_pattern.match(wiki_url):
                issues.append(f"Missing or malformed Wikipedia page_url: {wiki_url}")

            # Image Checks
            img = wiki.get("image", {})
            thumb = img.get("thumbnail_url")
            if thumb and not self.url_pattern.match(thumb):
                issues.append(f"Malformed image thumbnail_url: {thumb}")

        is_valid = len(issues) == 0
        return is_valid, issues

    def validate_and_audit_database(self, database: Dict[str, Any]) -> Dict[str, Any]:
        """
        Performs full audit across all records in the database.
        Returns quality report data dictionary.
        """
        records = database.get("records", [])
        total_records = len(records)

        wbtb_count = 0
        opk_count = 0
        matched_wiki = 0
        unmatched_wiki = 0
        manual_review_needed = 0
        with_images = 0
        with_licenses = 0
        missing_region = 0

        seen_ids = set()
        seen_composite_keys = set()
        duplicate_ids = []
        duplicate_composites = []
        all_validation_issues = []

        for r in records:
            # Type tally
            etype = r.get("dapobud", {}).get("entity_type")
            if etype == "WBTB":
                wbtb_count += 1
            elif etype == "OPK":
                opk_count += 1

            # Duplicate Check
            rid = r.get("record_id")
            if rid in seen_ids:
                duplicate_ids.append(rid)
            seen_ids.add(rid)

            comp_key = f"{etype}:{r.get('normalized_name')}:{r.get('dapobud', {}).get('region', {}).get('province')}"
            if comp_key in seen_composite_keys:
                duplicate_composites.append(comp_key)
            seen_composite_keys.add(comp_key)

            # Region check
            prov = r.get("dapobud", {}).get("region", {}).get("province")
            if not prov:
                missing_region += 1

            # Wikipedia metrics
            wiki = r.get("wikipedia", {})
            if wiki.get("status") == "matched":
                matched_wiki += 1
                if wiki.get("image", {}).get("thumbnail_url"):
                    with_images += 1
                if wiki.get("image", {}).get("license"):
                    with_licenses += 1
            else:
                unmatched_wiki += 1

            # Review status
            if r.get("quality", {}).get("requires_manual_review") or wiki.get("match", {}).get("review_status") == "requires_review":
                manual_review_needed += 1

            # Individual record validation
            is_valid, issues = self.validate_record(r)
            r["quality"]["record_valid"] = is_valid
            r["quality"]["validation_issues"] = issues
            if issues:
                all_validation_issues.append({"record_id": rid, "name": r.get("name"), "issues": issues})

        quality_report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "total_records": total_records,
                "wbtb_records": wbtb_count,
                "opk_records": opk_count,
                "matched_wikipedia_articles": matched_wiki,
                "unmatched_wikipedia_searches": unmatched_wiki,
                "enrichment_success_rate_percent": round((matched_wiki / total_records * 100) if total_records else 0, 2),
                "records_requiring_manual_review": manual_review_needed,
                "records_with_images": with_images,
                "records_with_verified_licenses": with_licenses,
                "records_missing_region": missing_region,
                "duplicate_ids_detected": len(duplicate_ids),
                "duplicate_keys_detected": len(duplicate_composites),
                "total_validation_issues": len(all_validation_issues)
            },
            "duplicate_samples": duplicate_ids[:10],
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
