"""
Pipeline Orchestrator Module for RAGAMARA Cultural Knowledge Database.
Coordinates discovery, extraction, deduplication, multi-factor enrichment, validation, and storage.
Schema Version: 2.0.0
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings
from src.dapobud_discovery import DapobudDiscovery
from src.dapobud_client import DapobudClient
from src.mediawiki_client import MediaWikiClient
from src.matching import CulturalMatcher
from src.enrichment import CulturalEnricher
from src.deduplication import EntityDeduplicator
from src.data_validator import DataValidator
from src.storage import StorageManager
from src.models import CanonicalEntity, CulturalDatabase, DatabaseMetadata

logger = logging.getLogger("ragamara.pipeline")


class CulturalDataPipeline:
    """End-to-end data pipeline orchestrator for RAGAMARA Schema v2.0.0."""

    def __init__(
        self,
        output_file: Path = settings.OUTPUT_FILE,
        cache_enabled: bool = True,
        fetch_details: bool = True
    ):
        self.output_file = output_file
        self.cache_enabled = cache_enabled
        self.fetch_details = fetch_details

        self.discovery = DapobudDiscovery()
        self.dapobud_client = DapobudClient(cache_enabled=cache_enabled)
        self.mediawiki_client = MediaWikiClient(cache_enabled=cache_enabled)
        self.matcher = CulturalMatcher()
        self.enricher = CulturalEnricher(self.mediawiki_client, self.matcher)
        self.deduplicator = EntityDeduplicator()
        self.validator = DataValidator()
        self.storage = StorageManager(self.output_file)

    def extract_raw_records(
        self,
        limit: Optional[int] = None,
        entity_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Extracts raw WBTB and OPK records from DAPOBUD GraphQL."""
        selected_entities = [e.upper() for e in (entity_types or settings.SUPPORTED_ENTITIES)]
        per_entity_limit = (limit // len(selected_entities)) if limit else None
        if limit and per_entity_limit == 0:
            per_entity_limit = 1

        extracted_raw_records: List[Dict[str, Any]] = []

        # 1. WBTB Extraction
        if "WBTB" in selected_entities:
            logger.info("Extracting WBTb records from DAPOBUD...")
            wbtb_count = 0
            page = 1
            while True:
                if per_entity_limit and wbtb_count >= per_entity_limit:
                    break
                page_size = min(settings.DEFAULT_PAGE_SIZE, per_entity_limit - wbtb_count) if per_entity_limit else settings.DEFAULT_PAGE_SIZE
                res = self.dapobud_client.fetch_wbtb_list(page=page, page_size=page_size)
                items = res.get("data", [])
                if not items:
                    break

                for item in items:
                    if self.fetch_details and item.get("id"):
                        try:
                            detail = self.dapobud_client.fetch_wbtb_detail(item["id"])
                            if detail:
                                item.update(detail)
                        except Exception as e:
                            logger.warning(f"Failed to fetch detail for WBTb {item.get('name')}: {e}")

                    item["entity_type"] = "WBTB"
                    if "domain" in item and item["domain"]:
                        item["category"] = item["domain"].get("name")
                    if "culturalCreationDescription" in item:
                        item["official_description"] = item["culturalCreationDescription"]
                    if "provinceHeritageWbtb" in item and item["provinceHeritageWbtb"]:
                        prov_val = item["provinceHeritageWbtb"]
                        item["province"] = prov_val.get("province") if isinstance(prov_val, dict) else prov_val

                    extracted_raw_records.append(item)
                    wbtb_count += 1
                    if per_entity_limit and wbtb_count >= per_entity_limit:
                        break

                meta = res.get("meta", {})
                if page >= meta.get("totalPages", 1):
                    break
                page += 1

        # 2. OPK Extraction
        if "OPK" in selected_entities:
            logger.info("Extracting OPK records from DAPOBUD...")
            opk_count = 0
            page = 1
            while True:
                if per_entity_limit and opk_count >= per_entity_limit:
                    break
                page_size = min(settings.DEFAULT_PAGE_SIZE, per_entity_limit - opk_count) if per_entity_limit else settings.DEFAULT_PAGE_SIZE
                res = self.dapobud_client.fetch_opk_list(page=page, page_size=page_size)
                items = res.get("data", [])
                if not items:
                    break

                for item in items:
                    if self.fetch_details and item.get("id"):
                        try:
                            detail = self.dapobud_client.fetch_opk_detail(item["id"])
                            if detail:
                                item.update(detail)
                        except Exception as e:
                            logger.warning(f"Failed to fetch detail for OPK {item.get('name')}: {e}")

                    item["entity_type"] = "OPK"
                    if "category" in item and isinstance(item["category"], dict):
                        item["category"] = item["category"].get("name")
                    if "description" in item:
                        item["official_description"] = item["description"]
                    if "province" in item and isinstance(item["province"], dict):
                        item["province"] = item["province"].get("province")
                    if "regency" in item and isinstance(item["regency"], dict):
                        item["regency"] = item["regency"].get("regency")

                    extracted_raw_records.append(item)
                    opk_count += 1
                    if per_entity_limit and opk_count >= per_entity_limit:
                        break

                meta = res.get("metaPage", {})
                if page >= meta.get("totalPages", 1):
                    break
                page += 1

        logger.info(f"Total raw records gathered from DAPOBUD: {len(extracted_raw_records)}")
        return extracted_raw_records

    def run(
        self,
        limit: Optional[int] = None,
        entity_types: Optional[List[str]] = None,
        resume: bool = False,
        force_refresh: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Executes Schema v2.0.0 pipeline."""
        start_time = datetime.now(timezone.utc)
        logger.info(f"Starting Cultural Data Pipeline (Schema v2.0.0) at {start_time.isoformat()}")

        # Stage 1: Discovery check
        if not settings.DISCOVERY_REPORT_FILE.exists() or force_refresh:
            logger.info("Running initial DAPOBUD source discovery...")
            self.discovery.run_discovery()

        # Stage 2: Extract official records
        raw_records = self.extract_raw_records(limit=limit, entity_types=entity_types)

        # Stage 3: Deduplicate into Canonical Entities
        logger.info("Consolidating source records into canonical entities...")
        canonical_entities = self.deduplicator.consolidate_records(raw_records)
        logger.info(f"Consolidation complete: {len(raw_records)} source records -> {len(canonical_entities)} canonical entities.")

        # Stage 4: Enrich Canonical Entities with Wikipedia and Media
        enriched_entities: List[CanonicalEntity] = []
        for idx, entity in enumerate(canonical_entities, 1):
            logger.info(f"[{idx}/{len(canonical_entities)}] Enriching: {entity['canonical_name']} ({entity['cultural_domain']})")
            enriched = self.enricher.enrich_entity(entity)
            enriched_entities.append(enriched)

        # Stage 5: Build Canonical Database Envelope (with backward-compatible records view)
        database = self._build_database_object(enriched_entities, total_source_records=len(raw_records))

        # Stage 6: Quality Audit & Validation
        logger.info("Running quality audit and schema validation...")
        quality_report = self.validator.validate_and_audit_database(database)
        self.validator.save_quality_report(quality_report)

        # Update metadata summary
        summary = quality_report["summary"]
        database["metadata"]["enrichment_summary"] = {
            "matched_entities": summary["matched_wikipedia_entities"],
            "unmatched_entities": summary["unmatched_wikipedia_entities"],
            "entities_with_media": summary["entities_with_media"],
            "entities_requiring_review": summary["entities_requiring_manual_review"],
            "multi_province_entities": summary["multi_province_entities"],
            "national_heritage_entities": summary["national_heritage_entities"]
        }

        # Stage 7: Synchronize Target Artifacts
        if not dry_run:
            self.storage.atomic_write_json(database, self.output_file)
            if self.output_file == settings.OUTPUT_FILE:
                self.storage.sync_all_targets(database)
            self.storage.clear_checkpoint()
            logger.info("Pipeline complete! Target artifacts synchronized successfully.")
        else:
            logger.info("[DRY RUN] Skipped writing final database to disk.")

        return {
            "status": "success",
            "total_records": len(enriched_entities),
            "total_canonical_entities": len(enriched_entities),
            "total_source_records": len(raw_records),
            "quality_summary": quality_report["summary"],
            "output_path": str(self.output_file) if not dry_run else None
        }

    def _build_database_object(self, entities: List[CanonicalEntity], total_source_records: int) -> Dict[str, Any]:
        """Constructs the canonical JSON database envelope following Schema v2.0.0."""
        # Also build a backward-compatible records array for legacy components
        legacy_records = []
        for e in entities:
            primary_src = e["source_records"][0] if e["source_records"] else {}
            first_media = e["media"][0] if e["media"] else {}
            provinces = e["regional_scope"].get("provinces", [])
            primary_prov = provinces[0] if provinces else None
            legacy_rec = {
                "record_id": e["entity_id"],
                "name": e["canonical_name"],
                "normalized_name": e["canonical_name"],
                "dapobud": {
                    "official_id": primary_src.get("official_uuid"),
                    "number": primary_src.get("registration_number"),
                    "entity_type": primary_src.get("entity_type", "WBTB"),
                    "category": e.get("dapobud_category_raw") or e["cultural_domain"],
                    "region": {
                        "province": primary_prov,
                        "regency_city": (e["regional_scope"].get("regencies") or [None])[0],
                        "district": None,
                        "village": None
                    },
                    "official_description": e["canonical_description"],
                    "assignment_date": primary_src.get("assignment_date"),
                    "source_url": primary_src.get("source_url")
                },
                "wikipedia": {
                    "status": e["enrichment"].get("status", "no_match"),
                    "language": "id",
                    "page_id": e["enrichment"].get("page_id"),
                    "page_title": e["enrichment"].get("page_title"),
                    "page_url": e["enrichment"].get("page_url"),
                    "extract": e["enrichment"].get("summary_extract"),
                    "image": {
                        "thumbnail_url": first_media.get("thumbnail_url"),
                        "original_url": first_media.get("original_url"),
                        "file_title": first_media.get("file_title"),
                        "file_page_url": first_media.get("file_page_url"),
                        "creator": first_media.get("creator"),
                        "license": first_media.get("license"),
                        "license_url": first_media.get("license_url"),
                        "attribution": first_media.get("attribution_text")
                    } if first_media else {},
                    "match": {
                        "confidence": e["enrichment"].get("matching_metadata", {}).get("confidence_score"),
                        "method": e["enrichment"].get("matching_metadata", {}).get("method"),
                        "review_status": e["enrichment"].get("matching_metadata", {}).get("review_status"),
                        "candidate_titles": e["enrichment"].get("matching_metadata", {}).get("candidate_titles", [])
                    }
                },
                "provenance": {
                    "official_source": "DAPOBUD",
                    "supplementary_source": "Wikipedia Indonesia",
                    "last_enriched_at": e["provenance"].get("last_updated_at")
                },
                "quality": {
                    "record_valid": e["provenance"].get("quality_verified", True),
                    "has_official_region": bool(primary_prov),
                    "has_wikipedia_enrichment": e["enrichment"].get("status") == "matched",
                    "requires_manual_review": e["enrichment"].get("matching_metadata", {}).get("review_status") == "requires_review",
                    "validation_issues": e["provenance"].get("validation_flags", [])
                }
            }
            legacy_records.append(legacy_rec)

        return {
            "metadata": {
                "database_name": "RAGAMARA Cultural Knowledge Database",
                "schema_version": settings.SCHEMA_VERSION,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "language": "id",
                "primary_source": "DAPOBUD",
                "enrichment_source": "Wikipedia Indonesia",
                "total_records": len(entities),
                "total_canonical_entities": len(entities),
                "total_source_records": total_source_records,
                "enrichment_summary": {}
            },
            "sources": {
                "dapobud": {
                    "name": "Data Pokok Kebudayaan",
                    "base_url": settings.DAPOBUD_BASE_URL,
                    "graphql_url": settings.DAPOBUD_GRAPHQL_URL,
                    "role": "official_cultural_registry"
                },
                "wikipedia": {
                    "name": "Wikipedia Indonesia",
                    "api_url": settings.MEDIAWIKI_API_URL,
                    "role": "supplementary_encyclopedic_enrichment"
                }
            },
            "entities": entities,
            "records": legacy_records  # Seamless backward-compatibility view
        }
