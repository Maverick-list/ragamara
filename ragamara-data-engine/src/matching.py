"""
Matching Engine Module for RAGAMARA Cultural Knowledge Database.
Implements Multi-Factor Semantic Scoring with Taxonomic Anti-Pattern Penalties.
Eliminates lexical false positives (e.g. Debus Banten -> Suku Banten, Batik Indonesia -> Museum).
"""

import logging
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from rapidfuzz import fuzz
from config import settings
from src.normalization import (
    normalize_cultural_name,
    clean_matching_key,
    extract_headword,
    parse_parenthetical_qualifier,
    map_dapobud_to_canonical_domain,
)

logger = logging.getLogger("ragamara.matching")

INSTITUTIONAL_DISQUALIFIERS = [
    "museum", "yayasan", "stasiun", "kri", "film", "lagu", "album",
    "perusahaan", "toko", "bandara", "tokoh", "kelurahan", "kecamatan",
    "kabupaten", "provinsi"
]

POPULATION_DISQUALIFIERS = [
    "suku", "marga", "dialek", "bahasa", "etnis", "orang", "kaum"
]


class CulturalMatcher:
    """Matches cultural names against encyclopedic candidate titles using multi-factor evaluation."""

    def __init__(
        self,
        auto_accept_threshold: float = settings.CONFIDENCE_AUTO_ACCEPT,
        review_threshold: float = settings.CONFIDENCE_REVIEW_THRESHOLD,
        reject_threshold: float = settings.CONFIDENCE_REJECT_THRESHOLD
    ):
        self.auto_accept_threshold = auto_accept_threshold
        self.review_threshold = review_threshold
        self.reject_threshold = reject_threshold

    def calculate_composite_score(
        self,
        official_name: str,
        candidate: Dict[str, Any],
        cultural_domain: Optional[str] = None,
        province: Optional[str] = None,
        official_description: Optional[str] = None
    ) -> Tuple[float, Dict[str, float], Optional[str]]:
        """
        Calculates composite score, score breakdown, and rejection reason if any.
        Returns: (composite_score, breakdown_dict, rejection_reason)
        """
        title = candidate.get("title", "")
        snippet = candidate.get("snippet", "")

        # 1. Disambiguation filter
        if "(disambiguasi)" in title.lower():
            return 0.0, {"negative_penalty": 1.0}, "Disambiguation page"

        core_title, qualifier = parse_parenthetical_qualifier(title)
        clean_title = clean_matching_key(core_title)
        clean_official = clean_matching_key(official_name)
        headword_official = clean_matching_key(extract_headword(official_name))

        canonical_domain = map_dapobud_to_canonical_domain(cultural_domain) if cultural_domain else None
        low_snippet = snippet.lower()
        low_title = title.lower()

        # ---------------------------------------------------------------------
        # Negative Penalties Check First
        # ---------------------------------------------------------------------
        negative_penalty = 0.0
        rejection_reason = None

        # Check institutional disqualifiers (e.g. Museum Batik Indonesia)
        for disq in INSTITUTIONAL_DISQUALIFIERS:
            if disq in low_title.split() and disq not in clean_official.split():
                negative_penalty += 0.45
                rejection_reason = f"Candidate title contains institutional disqualifier: '{disq}'"
                break

        # Check population disqualifiers for non-ethnic traditions (e.g. Suku Banten for Debus)
        for disq in POPULATION_DISQUALIFIERS:
            if disq in low_title.split() and disq not in clean_official.split():
                negative_penalty += 0.35
                rejection_reason = f"Candidate title represents population group ('{disq}'), not cultural practice"
                break

        # ---------------------------------------------------------------------
        # Factor A: Name Match
        # ---------------------------------------------------------------------
        is_exact = (clean_official == clean_title)
        is_headword_exact = bool(headword_official and headword_official == clean_title)

        if is_exact and negative_penalty == 0.0:
            # Clean exact match without negative disqualifiers is authoritative 1.0
            breakdown = {
                "name_score": 1.0,
                "domain_score": 1.0,
                "geographic_score": 1.0,
                "description_score": 1.0,
                "negative_penalty": 0.0
            }
            return 1.0, breakdown, None

        if is_headword_exact and negative_penalty == 0.0:
            # Normalized exact match (e.g. Batik Indonesia -> Batik, Saman -> Tari Saman)
            breakdown = {
                "name_score": 0.95,
                "domain_score": 0.95,
                "geographic_score": 0.95,
                "description_score": 0.95,
                "negative_penalty": 0.0
            }
            return 0.95, breakdown, None

        # Standard token sort ratio
        token_ratio = fuzz.token_sort_ratio(clean_official, clean_title) / 100.0
        head_ratio = fuzz.token_sort_ratio(headword_official, clean_title) / 100.0 if headword_official else 0.0
        name_score = max(token_ratio, head_ratio)

        # ---------------------------------------------------------------------
        # Factor B: Domain Compatibility (0.25 weight)
        # ---------------------------------------------------------------------
        domain_score = 0.50  # Neutral default

        # Check qualifier harmony (e.g. Debus (seni))
        if qualifier:
            if qualifier in ["seni", "tari", "musik", "pertunjukan"]:
                domain_score = 1.0 if (not canonical_domain or canonical_domain in ["Seni", "Olahraga Tradisional"]) else 0.80
            elif qualifier in ["makanan", "kuliner", "minuman"]:
                domain_score = 1.0 if (not canonical_domain or canonical_domain in ["Teknologi Tradisional", "Pengetahuan Tradisional"]) else 0.80
            elif qualifier in ["upacara", "ritual", "adat"]:
                domain_score = 1.0 if (not canonical_domain or canonical_domain in ["Adat Istiadat", "Ritus"]) else 0.80
            elif qualifier in ["senjata", "alat", "bangunan", "kerajinan"]:
                domain_score = 1.0 if (not canonical_domain or canonical_domain in ["Teknologi Tradisional", "Cagar Budaya"]) else 0.80

        # Check domain keywords in snippet
        domain_keywords = {
            "Seni": ["seni", "tari", "musik", "pertunjukan", "sandiwara", "teater", "lagu tradisional", "alat musik"],
            "Tradisi Lisan": ["cerita", "lisan", "sastra", "dongeng", "pantun", "legenda", "mitos"],
            "Adat Istiadat": ["adat", "tradisi", "istiadat", "kebiasaan", "hukum adat"],
            "Ritus": ["upacara", "ritual", "ritus", "sesaji", "sembahyang", "doa"],
            "Pengetahuan Tradisional": ["pengetahuan", "kosmologi", "pengobatan", "herbal", "ramuan"],
            "Teknologi Tradisional": ["kerajinan", "senjata", "arsitektur", "kain", "tenun", "kuliner", "masakan", "makanan"],
            "Permainan Rakyat": ["permainan", "dolanan", "gasing", "engklek"],
            "Olahraga Tradisional": ["olahraga", "bela diri", "silat", "pencak"],
            "Cagar Budaya": ["bangunan", "cagar", "situs", "monumen", "rumah adat"]
        }

        if canonical_domain:
            kws = domain_keywords.get(canonical_domain, [])
            matched_kw_count = sum(1 for kw in kws if kw in low_snippet or kw in low_title)
            if matched_kw_count >= 2:
                domain_score = max(domain_score, 0.90)
            elif matched_kw_count == 1:
                domain_score = max(domain_score, 0.75)
        else:
            domain_score = 0.80  # Non-penalized if domain not provided

        # ---------------------------------------------------------------------
        # Factor C: Geographic Corroboration (0.20 weight)
        # ---------------------------------------------------------------------
        geo_score = 0.70  # Baseline
        if province and len(province) > 2:
            prov_lower = province.lower()
            if prov_lower in low_title or prov_lower in low_snippet:
                geo_score = 1.0
            else:
                geo_score = 0.40
        elif "indonesia" in official_name.lower():
            geo_score = 0.90

        # ---------------------------------------------------------------------
        # Factor D: Description Overlap (0.15 weight)
        # ---------------------------------------------------------------------
        desc_score = 0.60
        if official_description and len(official_description) > 20:
            off_tokens = set(clean_matching_key(official_description).split())
            cand_tokens = set(clean_matching_key(snippet).split())
            if off_tokens and cand_tokens:
                intersection = len(off_tokens & cand_tokens)
                if intersection >= 5:
                    desc_score = 1.0
                elif intersection >= 2:
                    desc_score = 0.80

        # Weighted calculation
        weighted_sum = (
            settings.WEIGHT_NAME * name_score +
            settings.WEIGHT_DOMAIN * domain_score +
            settings.WEIGHT_GEO * geo_score +
            settings.WEIGHT_DESC * desc_score
        )
        composite = max(0.0, min(1.0, weighted_sum - negative_penalty))

        breakdown = {
            "name_score": round(name_score, 3),
            "domain_score": round(domain_score, 3),
            "geographic_score": round(geo_score, 3),
            "description_score": round(desc_score, 3),
            "negative_penalty": round(negative_penalty, 3)
        }

        return round(composite, 3), breakdown, rejection_reason

    def find_best_match(
        self,
        official_name: str,
        candidates: List[Dict[str, Any]],
        cultural_domain: Optional[str] = None,
        province: Optional[str] = None,
        context_hints: Optional[List[str]] = None,
        official_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates candidate Wikipedia articles and returns the best matching candidate.
        """
        candidate_titles = [c.get("title", "") for c in candidates]
        if not official_name or not candidates:
            return {
                "matched_candidate": None,
                "confidence": 0.0,
                "method": "no_match",
                "review_status": "no_match",
                "score_breakdown": {},
                "candidate_titles": candidate_titles,
                "review_notes": "No candidates provided"
            }

        evaluated: List[Tuple[float, str, Dict[str, Any], Dict[str, float], Optional[str]]] = []

        for candidate in candidates:
            score, breakdown, reject_reason = self.calculate_composite_score(
                official_name=official_name,
                candidate=candidate,
                cultural_domain=cultural_domain,
                province=province,
                official_description=official_description
            )

            title = candidate.get("title", "")
            core_title, _ = parse_parenthetical_qualifier(title)
            if clean_matching_key(official_name) == clean_matching_key(core_title):
                method = "exact"
            elif clean_matching_key(extract_headword(official_name)) == clean_matching_key(core_title):
                method = "normalized_exact"
            else:
                method = "semantic_composite"

            evaluated.append((score, method, candidate, breakdown, reject_reason))

        evaluated.sort(key=lambda x: x[0], reverse=True)
        best_score, method, best_cand, breakdown, reject_reason = evaluated[0]

        if best_score >= self.auto_accept_threshold and breakdown.get("negative_penalty", 0.0) == 0.0:
            review_status = "not_required"
            review_notes = f"High confidence semantic match (score: {best_score})"
        elif best_score >= self.review_threshold:
            review_status = "requires_review"
            review_notes = f"Moderate confidence semantic match (score: {best_score}). Review recommended."
        else:
            return {
                "matched_candidate": None,
                "confidence": best_score,
                "method": "no_match",
                "review_status": "no_match",
                "score_breakdown": breakdown,
                "candidate_titles": candidate_titles,
                "review_notes": reject_reason or f"Best candidate score ({best_score}) below acceptance threshold ({self.review_threshold})"
            }

        return {
            "matched_candidate": best_cand,
            "confidence": best_score,
            "method": method,
            "review_status": review_status,
            "score_breakdown": breakdown,
            "candidate_titles": candidate_titles,
            "review_notes": review_notes
        }
