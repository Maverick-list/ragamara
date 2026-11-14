"""
Entity Deduplication Module for RAGAMARA Cultural Knowledge Database.
Consolidates multi-tier government registrations into authoritative canonical cultural entities.
Preserves 100% of upstream source records, official UUIDs, and registration numbers.
"""

from collections import defaultdict
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from src.models import CanonicalEntity, SourceRecord, RegionalScope, Provenance
from src.normalization import (
    normalize_cultural_name,
    clean_matching_key,
    slugify,
    map_dapobud_to_canonical_domain,
)
from src.regional import RegionalScopeResolver


class EntityDeduplicator:
    """Consolidates DAPOBUD raw records into canonical cultural entities."""

    def __init__(self):
        self.regional_resolver = RegionalScopeResolver()

    @staticmethod
    def determine_administrative_tier(reg_number: Optional[str], entity_type: str) -> str:
        """Determines official registration tier from national registration number pattern."""
        if not reg_number:
            return "unknown"
        num = reg_number.strip().upper()
        if "REK/WBTB" in num:
            return "nasional"
        if num.startswith("OP.5151"):
            return "provinsi"
        if num.startswith("OP.6061") or num.startswith("OP.6161"):
            return "kabupaten_kota"
        return "komunitas"

    def consolidate_records(self, raw_dapobud_records: List[Dict[str, Any]]) -> List[CanonicalEntity]:
        """
        Groups raw DAPOBUD records into canonical cultural entities.
        Returns a list of CanonicalEntity instances with preserved source records.
        """
        grouped = defaultdict(list)

        for raw in raw_dapobud_records:
            # Handle both raw DAPOBUD dicts and v1 db record wrappers
            dapobud_data = raw.get("dapobud", raw)
            name = raw.get("name") or dapobud_data.get("name")
            norm_name = normalize_cultural_name(name)
            domain = map_dapobud_to_canonical_domain(dapobud_data.get("category"))
            
            group_key = f"{clean_matching_key(norm_name)}::{domain}"
            grouped[group_key].append((raw, dapobud_data))

        canonical_entities: List[CanonicalEntity] = []

        for group_key, items in grouped.items():
            primary_raw, primary_dapobud = items[0]
            name = primary_raw.get("name") or primary_dapobud.get("name")
            canonical_name = normalize_cultural_name(name)
            slug = slugify(canonical_name)
            entity_id = f"ragamara_cult_{slug}"

            # Aggregate all source registrations
            source_records: List[SourceRecord] = []
            collected_provinces = []
            collected_regencies = []
            best_description = ""

            for raw, d in items:
                reg_no = d.get("number")
                entity_type = d.get("entity_type", "WBTB")
                tier = self.determine_administrative_tier(reg_no, entity_type)

                region_info = d.get("region", {})
                prov = None
                if isinstance(region_info, dict) and region_info.get("province"):
                    prov = region_info.get("province")
                elif d.get("province"):
                    prov = d.get("province")
                elif d.get("provinceHeritageWbtb"):
                    prov = d.get("provinceHeritageWbtb")

                if isinstance(prov, dict):
                    prov = prov.get("province")
                if prov and isinstance(prov, str):
                    prov = prov.strip().title()

                regency = None
                if isinstance(region_info, dict) and region_info.get("regency_city"):
                    regency = region_info.get("regency_city")
                elif d.get("regency"):
                    regency = d.get("regency")

                if isinstance(regency, dict):
                    regency = regency.get("regency")
                if regency and isinstance(regency, str):
                    regency = regency.strip().title()

                if prov and prov not in collected_provinces:
                    collected_provinces.append(prov)
                if regency and regency not in collected_regencies:
                    collected_regencies.append(regency)

                desc = d.get("official_description") or d.get("description") or ""
                if len(desc) > len(best_description):
                    best_description = desc

                uuid_val = d.get("official_id") or d.get("id") or ""
                src_url = d.get("source_url") or f"https://dapobud.kemenbud.go.id/detail/?id={uuid_val}"

                source_records.append(
                    SourceRecord(
                        source_name="DAPOBUD",
                        official_uuid=uuid_val,
                        registration_number=reg_no or "",
                        entity_type=entity_type,
                        administrative_tier=tier,
                        registered_province=prov,
                        registered_regency=regency,
                        assignment_date=d.get("assignment_date"),
                        official_description=desc or None,
                        source_url=src_url,
                        raw_payload_snippet=d.get("original_record") or {}
                    )
                )

            # Resolve regional scope using aggregated regional metadata
            primary_prov = collected_provinces[0] if collected_provinces else None
            regional_scope = self.regional_resolver.resolve(
                name=canonical_name,
                province=primary_prov,
                regencies=collected_regencies
            )
            # If multiple provinces discovered during aggregation, ensure multi_province scope
            if len(collected_provinces) > 1 and regional_scope.get("scope_type") == "single_province":
                regional_scope["scope_type"] = "multi_province"
                regional_scope["provinces"] = collected_provinces

            canonical_domain = map_dapobud_to_canonical_domain(primary_dapobud.get("category"))
            raw_category = primary_dapobud.get("category") or ""

            # Check if any alternate names exist in duplicate filings
            all_names = list({normalize_cultural_name(r[0].get("name") or r[1].get("name")) for r in items})
            alt_names = [n for n in all_names if n != canonical_name]

            now_iso = datetime.now(timezone.utc).isoformat()
            provenance = Provenance(
                created_at=now_iso,
                last_updated_at=now_iso,
                quality_verified=True,
                validation_flags=[]
            )

            canonical_entity = CanonicalEntity(
                entity_id=entity_id,
                canonical_name=canonical_name,
                slug=slug,
                alternate_names=alt_names,
                cultural_domain=canonical_domain,
                dapobud_category_raw=raw_category,
                canonical_description=best_description,
                regional_scope=regional_scope,
                source_records=source_records,
                enrichment={
                    "status": "no_match",
                    "source": "Wikipedia Indonesia",
                    "matching_metadata": {
                        "confidence_score": 0.0,
                        "method": "no_match",
                        "review_status": "no_match",
                        "candidate_titles": [],
                        "review_notes": "Awaiting enrichment"
                    }
                },
                media=[],
                provenance=provenance
            )

            canonical_entities.append(canonical_entity)

        return canonical_entities
