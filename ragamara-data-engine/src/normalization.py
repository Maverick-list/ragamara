"""
Normalization Module.
Standardizes cultural entity names, regions, textual content, qualifiers, and domain mappings.
"""

import re
import unicodedata
from typing import Dict, Any, Optional, Tuple, List


def normalize_unicode(text: Optional[str]) -> str:
    """Normalizes string using Unicode NFKC form and cleans invisible whitespace."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", str(text))
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


def slugify(text: Optional[str]) -> str:
    """Generates a clean URL and identifier slug."""
    text = normalize_unicode(text).lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "_", text).strip("_")
    return text or "unnamed"


def parse_parenthetical_qualifier(title: str) -> Tuple[str, Optional[str]]:
    """
    Splits a MediaWiki or cultural title with parentheses into core title and qualifier.
    Example: 'Debus (seni)' -> ('Debus', 'seni')
    """
    clean_title = normalize_unicode(title)
    match = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", clean_title)
    if match:
        core = match.group(1).strip()
        qualifier = match.group(2).strip().lower()
        return core, qualifier
    return clean_title, None


def extract_headword(name: str) -> str:
    """
    Extracts the core cultural headword by stripping trailing regional or national qualifiers.
    Example:
        'Debus Banten' -> 'Debus'
        'Batik Indonesia' -> 'Batik'
        'Songket Palembang' -> 'Songket'
    """
    text = normalize_cultural_name(name)
    # Strip national qualifier
    text = re.sub(r"\s+Indonesia$", "", text, flags=re.IGNORECASE)
    # Strip province / region qualifiers if following cultural term
    regions = [
        "Banten", "Aceh", "Palembang", "Minangkabau", "Karo", "Batak",
        "Jawa", "Sunda", "Betawi", "Bali", "Dayak", "Banjar", "Bugis", "Makassar",
        "Mempawah", "Yalimo", "Papua"
    ]
    words = text.split()
    if len(words) >= 2 and words[-1] in regions:
        # Check if remaining part is a valid non-empty term
        remainder = " ".join(words[:-1])
        if len(remainder) >= 3:
            return remainder
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
    upper = text.upper()
    if "DKI" in upper or "JAKARTA" in upper:
        return "DKI Jakarta"
    if "DIY" in upper or "YOGYAKARTA" in upper:
        return "Daerah Istimewa Yogyakarta"
    if "ACEH" in upper:
        return "Aceh"

    words = [w.capitalize() for w in text.split()]
    return " ".join(words)


def normalize_regency(regency: Optional[str]) -> Optional[str]:
    """Normalizes regency/city names (e.g. KAB. -> Kabupaten, KOTA -> Kota)."""
    text = normalize_unicode(regency)
    if not text:
        return None
    text = re.sub(r"^KAB\.?\s*", "Kabupaten ", text, flags=re.IGNORECASE)
    text = re.sub(r"^KOTA\s*", "Kota ", text, flags=re.IGNORECASE)
    words = [w.capitalize() for w in text.split()]
    return " ".join(words)


def clean_article_extract(extract: Optional[str]) -> Optional[str]:
    """Cleans Wikipedia text extracts removing reference markers and excess whitespace."""
    if not extract:
        return None
    text = normalize_unicode(extract)
    text = re.sub(r"\[\d+\]", "", text)
    text = re.sub(r"\[rujukan\?\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) > 10 else None


def map_dapobud_to_canonical_domain(raw_domain: Optional[str]) -> str:
    """
    Maps DAPOBUD domains / OPK categories to standard UU 5/2017 Objects of Cultural Advancement.
    """
    if not raw_domain:
        return "Lainnya"
    low = raw_domain.lower()

    if "lisan" in low or "pantun" in low or "sastra" in low:
        return "Tradisi Lisan"
    if "manuskrip" in low or "aksara" in low or "naskah" in low:
        return "Manuskrip"
    if "adat" in low or "istiadat" in low:
        return "Adat Istiadat"
    if "ritus" in low or "upacara" in low:
        return "Ritus"
    if "pengetahuan" in low or "semesta" in low or "obat" in low:
        return "Pengetahuan Tradisional"
    if "teknologi" in low or "kemahiran" in low or "kerajinan" in low:
        return "Teknologi Tradisional"
    if "seni" in low or "pertunjukan" in low or "musik" in low or "tari" in low:
        return "Seni"
    if "bahasa" in low:
        return "Bahasa"
    if "permainan" in low:
        return "Permainan Rakyat"
    if "olahraga" in low or "beladiri" in low or "silat" in low:
        return "Olahraga Tradisional"
    if "cagar" in low or "bangunan" in low or "arsitektur" in low:
        return "Cagar Budaya"

    return "Lainnya"
