"""
Normalization Module.
Standardizes cultural entity names, regions, and textual content with strict Unicode handling.
"""

import re
import unicodedata
from typing import Dict, Any, Optional


def normalize_unicode(text: Optional[str]) -> str:
    """Normalizes string using Unicode NFKC form and cleans invisible whitespace."""
    if not text:
        return ""
    # NFKC normalizes compatibility characters
    normalized = unicodedata.normalize("NFKC", str(text))
    # Replace multiple spaces, newlines, and tabs with a single space
    cleaned = re.sub(r"\s+", " ", normalized).strip()
    return cleaned


def normalize_cultural_name(name: Optional[str]) -> str:
    """Standardizes cultural entity name while preserving authentic Indonesian spelling."""
    text = normalize_unicode(name)
    if not text:
        return ""
    # Strip leading/trailing quotation marks, dashes, or brackets
    text = re.sub(r"^[\"\'`\(\[\{]+|[\"\'`\)\]\}]+$", "", text).strip()
    return text


def clean_matching_key(name: Optional[str]) -> str:
    """Generates a stripped, lowercase key for high-accuracy string comparison."""
    text = normalize_cultural_name(name).lower()
    # Strip common administrative/taxonomic prefixes used in casual titles
    prefixes = [
        r"^tari\s+",
        r"^tarian\s+",
        r"^upacara\s+(?:adat\s+)?",
        r"^tradisi\s+",
        r"^kesenian\s+",
        r"^seni\s+",
        r"^senjata\s+(?:tradisional\s+)?",
        r"^rumah\s+(?:adat\s+)?",
        r"^alat\s+musik\s+(?:tradisional\s+)?",
        r"^pakaian\s+(?:adat\s+)?"
    ]
    for p in prefixes:
        text = re.sub(p, "", text)
    # Remove punctuation
    text = re.sub(r"[^\w\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_province(province: Optional[str]) -> Optional[str]:
    """Standardizes Indonesian province names into title case with official naming."""
    text = normalize_unicode(province)
    if not text:
        return None
    # Special standard mappings
    upper = text.upper()
    if "DKI" in upper or "JAKARTA" in upper:
        return "DKI Jakarta"
    if "DIY" in upper or "YOGYAKARTA" in upper:
        return "Daerah Istimewa Yogyakarta"
    if "ACEH" in upper:
        return "Aceh"

    # Title-case standard conversion
    words = [w.capitalize() for w in text.split()]
    return " ".join(words)


def normalize_regency(regency: Optional[str]) -> Optional[str]:
    """Normalizes regency/city names (e.g. KAB. -> Kabupaten, KOTA -> Kota)."""
    text = normalize_unicode(regency)
    if not text:
        return None
    # Standardize abbreviations
    text = re.sub(r"^KAB\.?\s*", "Kabupaten ", text, flags=re.IGNORECASE)
    text = re.sub(r"^KOTA\s*", "Kota ", text, flags=re.IGNORECASE)
    words = [w.capitalize() for w in text.split()]
    return " ".join(words)


def clean_article_extract(extract: Optional[str]) -> Optional[str]:
    """Cleans Wikipedia text extracts removing reference markers and excess whitespace."""
    if not extract:
        return None
    text = normalize_unicode(extract)
    # Remove citations like [1], [2], [rujukan?]
    text = re.sub(r"\[\d+\]", "", text)
    text = re.sub(r"\[rujukan\?\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) > 10 else None
