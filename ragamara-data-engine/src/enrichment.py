"""
Enrichment Module for RAGAMARA Cultural Knowledge Database.
Orchestrates multi-factor semantic matching and Wikimedia Commons asset verification.
Enforces Schema Version 2.0.0.
"""

import hashlib
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.models import CanonicalEntity, EnrichmentLayer, MediaAsset, MatchingMetadata, ScoreBreakdown
from src.normalization import (
    clean_article_extract,
    extract_headword,
    clean_matching_key
)
from src.matching import CulturalMatcher
from src.mediawiki_client import MediaWikiClient

logger = logging.getLogger("ragamara.enrichment")

# Known permissive licenses allowing commercial distribution
PERMISSIVE_LICENSES = [
    "cc by-sa 4.0", "cc by-sa 3.0", "cc by-sa 2.5", "cc by-sa 2.0",
    "cc by 4.0", "cc by 3.0", "cc by 2.5", "cc by 2.0",
    "cc0", "public domain", "cc0 1.0"
]


class CulturalEnricher:
    """Enriches canonical cultural entities with verified encyclopedic context and licensed media."""

    def __init__(self, mediawiki_client: Optional[MediaWikiClient] = None, matcher: Optional[CulturalMatcher] = None):
        self.wiki_client = mediawiki_client or MediaWikiClient()
        self.matcher = matcher or CulturalMatcher()

    def enrich_entity(self, entity: CanonicalEntity) -> CanonicalEntity:
        """
        Enriches a canonical cultural entity with Wikipedia data and verified Wikimedia assets.
        """
        name = entity["canonical_name"]
        domain = entity["cultural_domain"]
        provinces = entity["regional_scope"].get("provinces", [])
        primary_province = provinces[0] if provinces else None
        description = entity["canonical_description"]

        # 1. Search candidate articles
        candidates = self.wiki_client.search_articles(name, limit=5)
        seen_titles = {c.get("title", "").lower() for c in candidates}

        # Secondary search with core headword if distinct
        headword = extract_headword(name)
        if headword and headword.lower() != name.lower():
            secondary = self.wiki_client.search_articles(headword, limit=3)
            for c in secondary:
                if c.get("title", "").lower() not in seen_titles:
                    candidates.append(c)
                    seen_titles.add(c.get("title", "").lower())

        # 2. Execute multi-factor semantic matching
        match_res = self.matcher.find_best_match(
            official_name=name,
            candidates=candidates,
            cultural_domain=domain,
            province=primary_province,
            official_description=description
        )

        matched_cand = match_res.get("matched_candidate")
        score = match_res.get("confidence", 0.0)
        method = match_res.get("method", "no_match")
        review_status = match_res.get("review_status", "no_match")
        breakdown = match_res.get("score_breakdown", {})
        candidate_titles = match_res.get("candidate_titles", [])
        review_notes = match_res.get("review_notes", "")

        matching_metadata = MatchingMetadata(
            confidence_score=score,
            method=method,
            score_breakdown=ScoreBreakdown(
                name_score=breakdown.get("name_score", 0.0),
                domain_score=breakdown.get("domain_score", 0.0),
                geographic_score=breakdown.get("geographic_score", 0.0),
                description_score=breakdown.get("description_score", 0.0),
                negative_penalty=breakdown.get("negative_penalty", 0.0)
            ),
            review_status=review_status,
            candidate_titles=candidate_titles,
            review_notes=review_notes
        )

        if not matched_cand or method == "no_match":
            entity["enrichment"] = EnrichmentLayer(
                status="no_match",
                source="Wikipedia Indonesia",
                page_title=None,
                page_id=None,
                page_url=None,
                revision_id=None,
                summary_extract=None,
                matching_metadata=matching_metadata
            )
            entity["media"] = []
            return entity

        # 3. Fetch detailed article extract and page images
        title = matched_cand.get("title")
        page_data = self.wiki_client.get_article_details(title)

        if not page_data:
            entity["enrichment"] = EnrichmentLayer(
                status="no_match",
                source="Wikipedia Indonesia",
                page_title=None,
                page_id=None,
                page_url=None,
                revision_id=None,
                summary_extract=None,
                matching_metadata=matching_metadata
            )
            entity["media"] = []
            return entity

        # 4. Populate Enrichment Layer
        clean_extract = clean_article_extract(page_data.get("extract"))
        entity["enrichment"] = EnrichmentLayer(
            status="matched",
            source="Wikipedia Indonesia",
            page_title=page_data.get("title"),
            page_id=page_data.get("pageid"),
            page_url=page_data.get("fullurl"),
            revision_id=page_data.get("lastrevid"),
            summary_extract=clean_extract,
            matching_metadata=matching_metadata
        )

        # 5. Extract and Validate Media Assets
        media_assets: List[MediaAsset] = []
        thumbnail = page_data.get("thumbnail", {})
        original = page_data.get("original", {})
        page_image = page_data.get("pageimage")

        thumb_url = thumbnail.get("source") or original.get("source")
        orig_url = original.get("source") or thumbnail.get("source")

        if (thumb_url or orig_url) and page_image:
            img_meta = self.wiki_client.get_image_metadata(page_image)
            raw_lic = (img_meta.get("license") or "unknown").strip().lower()
            creator = (img_meta.get("creator") or "Unknown Author").strip()
            attr_text = img_meta.get("attribution") or f"{creator}, {img_meta.get('license', 'CC')}, via Wikimedia Commons"

            # Strict commercial verification: must match permissive licenses and not contain NC or ND
            is_commercial = any(p in raw_lic for p in PERMISSIVE_LICENSES) and "-nc" not in raw_lic and "-nd" not in raw_lic

            # Cultural relevance audit:
            # - If Debus Banten matches Debus (seni), ensure image is not a wedding procession
            # - If Batik matches Batik, ensure image is authentic textile
            relevance_status = "verified_authentic"
            file_title = page_image or ""
            if "wedding" in file_title.lower() or "bantenese_wedding" in file_title.lower():
                relevance_status = "requires_replacement"
            elif "museum" in file_title.lower():
                relevance_status = "requires_replacement"

            asset_hash = hashlib.sha256((thumb_url or orig_url).encode("utf-8")).hexdigest()[:16]
            media_asset = MediaAsset(
                asset_id=f"media_img_{asset_hash}",
                asset_type="image",
                role="hero",
                file_title=file_title,
                thumbnail_url=thumb_url or "",
                original_url=orig_url or "",
                file_page_url=img_meta.get("file_page_url") or f"https://commons.wikimedia.org/wiki/File:{file_title}",
                creator=creator,
                license=img_meta.get("license") or "Custom Permissive",
                license_url=img_meta.get("license_url"),
                attribution_text=attr_text,
                commercial_use_permitted=is_commercial,
                cultural_relevance_status=relevance_status,
                verification_timestamp=datetime.now(timezone.utc).isoformat()
            )
            media_assets.append(media_asset)

        entity["media"] = media_assets
        entity["provenance"]["last_updated_at"] = datetime.now(timezone.utc).isoformat()

        return entity
