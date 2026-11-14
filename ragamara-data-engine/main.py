"""
RAGAMARA Cultural Data Enrichment Engine CLI Entrypoint.
DAPOBUD × Wikipedia Indonesia Cultural Pipeline.
Schema Version: 2.0.0
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings
from src.dapobud_discovery import DapobudDiscovery
from src.pipeline import CulturalDataPipeline


def setup_logging(log_file: Path = settings.LOG_FILE) -> None:
    """Configures structured logging to both file and console."""
    log_file.parent.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)


def display_stats(db_path: Path) -> None:
    """Displays statistics of Schema v2.0.0 database."""
    if not db_path.exists():
        print(f"Error: Database file not found at {db_path}")
        return

    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)

    meta = db.get("metadata", {})
    entities = db.get("entities", [])
    records = db.get("records", [])

    total_canon = len(entities) or len(records)
    total_sources = meta.get("total_source_records", len(records))

    matched_count = sum(1 for e in entities if e.get("enrichment", {}).get("status") == "matched") if entities else sum(1 for r in records if r.get("wikipedia", {}).get("status") == "matched")
    with_media = sum(1 for e in entities if e.get("media")) if entities else sum(1 for r in records if r.get("wikipedia", {}).get("image", {}).get("thumbnail_url"))
    reviews = sum(1 for e in entities if e.get("enrichment", {}).get("matching_metadata", {}).get("review_status") == "requires_review") if entities else sum(1 for r in records if r.get("quality", {}).get("requires_manual_review"))

    multi_prov = sum(1 for e in entities if e.get("regional_scope", {}).get("scope_type") in ["multi_province", "national"]) if entities else 0

    print("\n" + "=" * 60)
    print("  RAGAMARA CULTURAL KNOWLEDGE DATABASE (SCHEMA v2.0.0)")
    print("=" * 60)
    print(f"  Database File              : {db_path.name}")
    print(f"  Schema Version             : {meta.get('schema_version')}")
    print(f"  Generated At               : {meta.get('generated_at')}")
    print(f"  Canonical Cultural Entities: {total_canon}")
    print(f"  Preserved Source Records   : {total_sources}")
    print(f"  Multi-Prov / National Scope: {multi_prov}")
    print(f"  Wikipedia Enriched         : {matched_count} ({round(matched_count/total_canon*100, 1) if total_canon else 0}%)")
    print(f"  Entities with Media Assets : {with_media}")
    print(f"  Flagged for Manual Review  : {reviews}")
    print("=" * 60 + "\n")


def main() -> None:
    """CLI Parser and dispatcher."""
    parser = argparse.ArgumentParser(
        description="RAGAMARA Cultural Data Enrichment Engine v2.0.0 (DAPOBUD × Wikipedia Indonesia)"
    )

    parser.add_argument(
        "--discover",
        action="store_true",
        help="Run public source discovery on DAPOBUD and generate discovery report."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of records to extract and enrich (useful for pilots)."
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume pipeline execution from saved checkpoint."
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force refresh all caches and re-fetch records from scratch."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform extraction and enrichment in-memory without saving final file."
    )
    parser.add_argument(
        "--entity-types",
        nargs="+",
        choices=["WBTb", "OPK", "wbtb", "opk"],
        default=None,
        help="Cultural entity types to process (default: WBTb and OPK)."
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Display statistics from the generated culture database."
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(settings.OUTPUT_FILE),
        help="Target output JSON path (default: ragamara_culture_db.json)."
    )

    args = parser.parse_args()
    setup_logging()

    output_path = Path(args.output).resolve()

    if args.stats:
        display_stats(output_path)
        return

    if args.discover:
        discovery = DapobudDiscovery()
        report = discovery.run_discovery()
        print("\nDiscovery completed successfully!")
        print(f"Discovery report saved to: {settings.DISCOVERY_REPORT_FILE}")
        return

    entities = [e.upper() for e in args.entity_types] if args.entity_types else None
    pipeline = CulturalDataPipeline(output_file=output_path)

    result = pipeline.run(
        limit=args.limit,
        entity_types=entities,
        resume=args.resume,
        force_refresh=args.force_refresh,
        dry_run=args.dry_run
    )

    print("\n" + "=" * 60)
    print("  RAGAMARA PIPELINE EXECUTION SUMMARY")
    print("=" * 60)
    print(f"  Status                  : {result['status'].upper()}")
    print(f"  Canonical Entities      : {result['total_canonical_entities']}")
    print(f"  Preserved Source Records: {result['total_source_records']}")
    summary = result.get("quality_summary", {})
    print(f"  Enrichment Matches      : {summary.get('matched_wikipedia_entities', 0)}")
    print(f"  Entities with Media     : {summary.get('entities_with_media', 0)}")
    print(f"  Manual Review Required  : {summary.get('entities_requiring_manual_review', 0)}")
    if result.get("output_path"):
        print(f"  Output Database (Engine): {result['output_path']}")
        print(f"  Output Database (Root)  : {settings.ROOT_OUTPUT_FILE}")
        print(f"  Frontend Envelope (JS)  : {settings.FRONTEND_JS_FILE}")
        print(f"  Quality Audit Report    : {settings.QUALITY_REPORT_FILE}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
