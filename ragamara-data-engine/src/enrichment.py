"""
Enrichment Module.
Orchestrates DAPOBUD record transformation and supplementary Wikipedia enrichment.
"""

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.normalization import (
    normalize_cultural_name,
    normalize_province,
    normalize_regency,
    clean_article_extract
)
from src.matching import CulturalMatcher
from src.mediawiki_client import MediaWikiClient
from src.storage import StorageManager

logger = logging.getLogger("ragamara.enrichment")


class CulturalEnricher:
    """Enriches official DAPOBUD records with verified encyclopedic data."""

    def __init__(self, mediawiki_client: Optional[MediaWikiClient] = None, matcher: Optional[CulturalMatcher] = None):
        self.wiki_client = mediawiki_client or MediaWikiClient()
        self.matcher = matcher or CulturalMatcher()

    def build_base_record(self, raw_record: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
        """Converts raw DAPOBUD GraphQL object into normalized database record skeleton."""
        raw_name = raw_record.get("name") or "Tanpa Nama"
        normalized_name = normalize_cultural_name(raw_name)
        official_id = str(raw_record.get("id")) if raw_record.get("id") else None

        # Regional parsing
        province = None
        regency = None
        if "provinceHeritageWbtb" in raw_record and raw_record["provinceHeritageWbtb"]:
            province = raw_record["provinceHeritageWbtb"].get("province")
        elif "province" in raw_record and raw_record["province"]:
            province = raw_record["province"].get("province")

        if "regency" in raw_record and raw_record["regency"]:
            regency = raw_record["regency"].get("regency")

        norm_province = normalize_province(province)
        norm_regency = normalize_regency(regency)

        # Category parsing
        category = None
        if "domain" in raw_record and raw_record["domain"]:
            category = raw_record["domain"].get("name")
        elif "category" in raw_record and raw_record["category"]:
            category = raw_record.get("category")

        # Official detail source URL
        source_url = None
        if official_id:
            if entity_type.upper() == "WBTB":
                source_url = f"https://dapobud.kemenbud.go.id/wbtb/detail-wbtb/?id={official_id}"
            else:
                source_url = f"https://dapobud.kemenbud.go.id/opk/detail-opk/?id={official_id}"

        record_id = StorageManager.generate_record_id(official_id, entity_type, normalized_name, norm_province)

        return {
            "record_id": record_id,
            "name": raw_name,
            "normalized_name": normalized_name,
            "dapobud": {
                "official_id": official_id,
                "number": raw_record.get("number"),
                "entity_type": entity_type.upper(),
                "category": category,
                "region": {
                    "province": norm_province,
                    "regency_city": norm_regency,
                    "district": None,
                    "village": None
                },
                "official_description": raw_record.get("culturalCreationDescription") or raw_record.get("description"),
                "assignment_date": raw_record.get("assignmentDate"),
                "source_url": source_url,
                "original_record": {k: v for k, v in raw_record.items() if k not in ["culturalCreationDescription", "description"]}
            },
            "wikipedia": {
                "status": "no_match",
                "language": "id",
                "page_id": None,
                "page_title": None,
                "page_url": None,
                "extract": None,
                "historical_context": None,
                "image": {
                    "thumbnail_url": None,
                    "original_url": None,
                    "file_title": None,
                    "file_page_url": None,
                    "creator": None,
                    "license": None,
                    "license_url": None,
                    "attribution": None
                },
                "match": {
                    "confidence": None,
                    "method": "none",
                    "review_status": "not_required",
                    "candidate_titles": []
                },
                "retrieved_at": None,
                "revision_id": None
            },
            "provenance": {
                "official_source": "DAPOBUD",
                "supplementary_source": "Wikipedia Indonesia",
                "last_enriched_at": None
            },
            "quality": {
                "record_valid": True,
                "has_official_region": bool(norm_province),
                "has_wikipedia_enrichment": False,
                "requires_manual_review": False,
                "validation_issues": []
            }
        }

    def enrich_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Performs Wikipedia query, matching, and metadata attachment."""
        name = record.get("normalized_name") or record.get("name")
        province = record["dapobud"]["region"].get("province")
        category = record["dapobud"].get("category")

        context_hints = [h for h in [province, category] if h]
        candidates = self.wiki_client.search_articles(name, limit=5)

        match_res = self.matcher.find_best_match(name, candidates, context_hints=context_hints)
        matched_cand = match_res.get("matched_candidate")

        record["wikipedia"]["match"]["candidate_titles"] = match_res.get("candidate_titles", [])
        record["wikipedia"]["match"]["confidence"] = match_res.get("confidence")
        record["wikipedia"]["match"]["method"] = match_res.get("method")
        record["wikipedia"]["match"]["review_status"] = match_res.get("review_status")

        if match_res.get("review_status") == "requires_review":
            record["quality"]["requires_manual_review"] = True

        if not matched_cand:
            record["wikipedia"]["status"] = "no_match"
            return record

        # Fetch detailed page information
        title = matched_cand.get("title")
        page_data = self.wiki_client.get_article_details(title)

        if not page_data:
            record["wikipedia"]["status"] = "no_match"
            return record

        # Success - populate matched Wikipedia details
        record["wikipedia"]["status"] = "matched"
        record["wikipedia"]["page_id"] = page_data.get("pageid")
        record["wikipedia"]["page_title"] = page_data.get("title")
        record["wikipedia"]["page_url"] = page_data.get("fullurl")
        record["wikipedia"]["extract"] = clean_article_extract(page_data.get("extract"))
        record["wikipedia"]["retrieved_at"] = datetime.now(timezone.utc).isoformat()
        record["wikipedia"]["revision_id"] = page_data.get("lastrevid")

        # Handle image metadata
        thumbnail = page_data.get("thumbnail", {})
        original = page_data.get("original", {})
        page_image = page_data.get("pageimage")

        if thumbnail or original or page_image:
            img_dict = record["wikipedia"]["image"]
            img_dict["thumbnail_url"] = thumbnail.get("source")
            img_dict["original_url"] = original.get("source")
            img_dict["file_title"] = page_image

            if page_image:
                img_meta = self.wiki_client.get_image_metadata(page_image)
                img_dict["file_page_url"] = img_meta.get("file_page_url")
                img_dict["creator"] = img_meta.get("creator")
                img_dict["license"] = img_meta.get("license")
                img_dict["license_url"] = img_meta.get("license_url")
                img_dict["attribution"] = img_meta.get("attribution")

        record["quality"]["has_wikipedia_enrichment"] = True
        record["provenance"]["last_enriched_at"] = datetime.now(timezone.utc).isoformat()

        return record
