"""
Pipeline Orchestrator Module.
Coordinates discovery, extraction, enrichment, validation, checkpointing, and storage.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

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
from src.data_validator import DataValidator
from src.storage import StorageManager

logger = logging.getLogger("ragamara.pipeline")


class CulturalDataPipeline:
    """End-to-end data pipeline orchestrator for RAGAMARA."""

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
        self.validator = DataValidator()
        self.storage = StorageManager(self.output_file)

    def run(
        self,
        limit: Optional[int] = None,
        entity_types: Optional[List[str]] = None,
        resume: bool = False,
        force_refresh: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Executes the data pipeline.
        
        Args:
            limit: Maximum records to process (for pilots/testing).
            entity_types: Entities to extract (['WBTb', 'OPK'] by default).
            resume: Whether to resume from last saved checkpoint.
            force_refresh: Clear existing cache and re-fetch everything.
            dry_run: Run extraction and enrichment in-memory without saving to final file.
        """
        start_time = datetime.now(timezone.utc)
        logger.info(f"Starting Cultural Data Pipeline at {start_time.isoformat()}")

        selected_entities = [e.upper() for e in (entity_types or settings.SUPPORTED_ENTITIES)]
        processed_records: List[Dict[str, Any]] = []
        processed_ids = set()

        # Handle resume
        if resume and not force_refresh:
            cp = self.storage.load_checkpoint()
            if cp and "records" in cp:
                processed_records = cp["records"]
                processed_ids = {r["record_id"] for r in processed_records}
                logger.info(f"Resuming pipeline from checkpoint: {len(processed_records)} records already processed.")

        # Stage 1: Discovery check
        if not settings.DISCOVERY_REPORT_FILE.exists() or force_refresh:
            logger.info("Running initial DAPOBUD source discovery...")
            self.discovery.run_discovery()

        # Calculate limits per entity type if limit specified
        per_entity_limit = (limit // len(selected_entities)) if limit else None
        if limit and per_entity_limit == 0:
            per_entity_limit = 1

        # Stage 2: Extract official DAPOBUD records
        extracted_raw_records: List[Tuple_Raw] = []

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
                    # If detail fetching enabled and ID present, retrieve full official description
                    if self.fetch_details and item.get("id"):
                        try:
                            detail = self.dapobud_client.fetch_wbtb_detail(item["id"])
                            if detail:
                                item.update(detail)
                        except Exception as e:
                            logger.warning(f"Failed to fetch detail for WBTb {item.get('name')}: {e}")

                    extracted_raw_records.append((item, "WBTB"))
                    wbtb_count += 1
                    if per_entity_limit and wbtb_count >= per_entity_limit:
                        break

                meta = res.get("metaPage", {})
                if page >= meta.get("totalPages", 1):
                    break
                page += 1

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

                    extracted_raw_records.append((item, "OPK"))
                    opk_count += 1
                    if per_entity_limit and opk_count >= per_entity_limit:
                        break

                meta = res.get("metaPage", {})
                if page >= meta.get("totalPages", 1):
                    break
                page += 1

        logger.info(f"Total raw records gathered from DAPOBUD: {len(extracted_raw_records)}")

        # Stage 3: Normalize and Enrich
        for idx, (raw_item, etype) in enumerate(extracted_raw_records, 1):
            base_rec = self.enricher.build_base_record(raw_item, etype)
            rid = base_rec["record_id"]

            if rid in processed_ids:
                logger.debug(f"Skipping already processed record {rid}")
                continue

            logger.info(f"[{idx}/{len(extracted_raw_records)}] Enriching: {base_rec['name']} ({etype})")
            enriched_rec = self.enricher.enrich_record(base_rec)
            processed_records.append(enriched_rec)
            processed_ids.add(rid)

            # Checkpoint every 10 records
            if idx % 10 == 0 and not dry_run:
                self.storage.save_checkpoint({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "records": processed_records
                })

        # Stage 4: Deduplicate and Assemble Final Database Structure
        database = self._build_database_object(processed_records)

        # Stage 5: Quality Audit & Validation
        logger.info("Running quality audit and schema validation...")
        quality_report = self.validator.validate_and_audit_database(database)
        self.validator.save_quality_report(quality_report)

        # Update metadata counts
        meta = database["metadata"]
        meta["total_records"] = quality_report["summary"]["total_records"]
        meta["successful_enrichments"] = quality_report["summary"]["matched_wikipedia_articles"]
        meta["unmatched_records"] = quality_report["summary"]["unmatched_wikipedia_searches"]
        meta["records_requiring_review"] = quality_report["summary"]["records_requiring_manual_review"]

        # Stage 6: Atomic Storage
        if not dry_run:
            self.storage.atomic_write_json(database, self.output_file)
            self.storage.clear_checkpoint()
            logger.info(f"Pipeline complete! Database successfully written to {self.output_file}")
        else:
            logger.info("[DRY RUN] Skipped writing final database to disk.")

        return {
            "status": "success",
            "total_records": len(processed_records),
            "quality_summary": quality_report["summary"],
            "output_path": str(self.output_file) if not dry_run else None
        }

    def _build_database_object(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Constructs the canonical JSON database envelope following Section 9 specification."""
        return {
            "metadata": {
                "database_name": "RAGAMARA Cultural Knowledge Database",
                "schema_version": "1.0.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "language": "id",
                "primary_source": "DAPOBUD",
                "enrichment_source": "Wikipedia Indonesia",
                "total_records": len(records),
                "successful_enrichments": 0,
                "unmatched_records": 0,
                "records_requiring_review": 0
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
            "records": records
        }


# Type helper
Tuple_Raw = Any
