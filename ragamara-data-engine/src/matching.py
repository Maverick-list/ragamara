"""
Matching Engine Module.
Compares DAPOBUD official cultural entities against Wikipedia Indonesia candidate articles.
Uses exact matching, normalized key matching, and fuzzy string distance with context validation.
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
from src.normalization import normalize_cultural_name, clean_matching_key

logger = logging.getLogger("ragamara.matching")


class CulturalMatcher:
    """Matches cultural names against encyclopedic candidate titles."""

    def __init__(
        self,
        exact_threshold: float = settings.EXACT_MATCH_SCORE,
        high_threshold: float = settings.HIGH_CONFIDENCE_SCORE,
        review_threshold: float = settings.MANUAL_REVIEW_SCORE
    ):
        self.exact_threshold = exact_threshold
        self.high_threshold = high_threshold
        self.review_threshold = review_threshold

    def find_best_match(
        self,
        official_name: str,
        candidates: List[Dict[str, Any]],
        context_hints: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates candidate Wikipedia articles and returns the best matching candidate.
        
        Returns:
            dict containing:
                - matched_candidate: Optional[dict]
                - confidence: float
                - method: str ('exact', 'normalized_exact', 'fuzzy_high', 'fuzzy_review', 'no_match')
                - review_status: str ('not_required', 'requires_review', 'no_match')
                - candidate_titles: List[str]
        """
        candidate_titles = [c.get("title", "") for c in candidates]
        if not official_name or not candidates:
            return {
                "matched_candidate": None,
                "confidence": 0.0,
                "method": "no_match",
                "review_status": "no_match",
                "candidate_titles": candidate_titles
            }

        norm_official = normalize_cultural_name(official_name)
        clean_official = clean_matching_key(official_name)

        scored_candidates: List[Tuple[float, str, Dict[str, Any]]] = []

        for candidate in candidates:
            title = candidate.get("title", "")
            snippet = candidate.get("snippet", "")

            # Exclude explicit disambiguation pages
            if "(disambiguasi)" in title.lower():
                continue

            norm_title = normalize_cultural_name(title)
            clean_title = clean_matching_key(title)

            # Check 1: Exact case-insensitive match
            if norm_official.lower() == norm_title.lower():
                scored_candidates.append((1.0, "exact", candidate))
                continue

            # Check 2: Cleaned prefix-stripped key exact match
            if clean_official and clean_title and clean_official == clean_title:
                scored_candidates.append((0.95, "normalized_exact", candidate))
                continue

            # Check 3: Fuzzy token sort ratio
            ratio = fuzz.token_sort_ratio(clean_official, clean_title) / 100.0

            # Context boost if province or cultural hints appear in snippet or title
            if context_hints:
                for hint in context_hints:
                    if hint and len(hint) > 3 and hint.lower() in (snippet.lower() + " " + title.lower()):
                        ratio = min(1.0, ratio + 0.08)
                        break

            if ratio >= self.high_threshold:
                scored_candidates.append((ratio, "fuzzy_high", candidate))
            elif ratio >= self.review_threshold:
                scored_candidates.append((ratio, "fuzzy_review", candidate))
            else:
                scored_candidates.append((ratio, "below_threshold", candidate))

        if not scored_candidates:
            return {
                "matched_candidate": None,
                "confidence": 0.0,
                "method": "no_match",
                "review_status": "no_match",
                "candidate_titles": candidate_titles
            }

        # Sort by score descending
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, method, best_cand = scored_candidates[0]

        if best_score >= self.high_threshold:
            return {
                "matched_candidate": best_cand,
                "confidence": round(best_score, 3),
                "method": method,
                "review_status": "not_required",
                "candidate_titles": candidate_titles
            }
        elif best_score >= self.review_threshold:
            return {
                "matched_candidate": best_cand,
                "confidence": round(best_score, 3),
                "method": method,
                "review_status": "requires_review",
                "candidate_titles": candidate_titles
            }
        else:
            return {
                "matched_candidate": None,
                "confidence": round(best_score, 3),
                "method": "no_match",
                "review_status": "no_match",
                "candidate_titles": candidate_titles
            }
