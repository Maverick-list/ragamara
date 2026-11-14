"""
Regional Scope Resolution Module for RAGAMARA Cultural Knowledge Database.
Provides authoritative geographic taxonomy without fabricating unverified assignments.
"""

from typing import Dict, Any, List, Optional
from src.models import RegionalScope

# Primary 8 Game Adventure Regions
PROVINCE_TO_GAME_REGION: Dict[str, str] = {
    # Sumatra
    "Aceh": "Sumatra",
    "Sumatera Utara": "Sumatra",
    "Sumatera Barat": "Sumatra",
    "Riau": "Sumatra",
    "Kepulauan Riau": "Sumatra",
    "Jambi": "Sumatra",
    "Sumatera Selatan": "Sumatra",
    "Kepulauan Bangka Belitung": "Sumatra",
    "Bengkulu": "Sumatra",
    "Lampung": "Sumatra",
    # Jawa
    "DKI Jakarta": "Jawa",
    "Jawa Barat": "Jawa",
    "Banten": "Jawa",
    "Jawa Tengah": "Jawa",
    "Daerah Istimewa Yogyakarta": "Jawa",
    "Jawa Timur": "Jawa",
    # Bali & Nusa Tenggara
    "Bali": "Bali & Nusa Tenggara",
    "Nusa Tenggara Barat": "Bali & Nusa Tenggara",
    "Nusa Tenggara Timur": "Bali & Nusa Tenggara",
    # Kalimantan
    "Kalimantan Barat": "Kalimantan",
    "Kalimantan Tengah": "Kalimantan",
    "Kalimantan Selatan": "Kalimantan",
    "Kalimantan Timur": "Kalimantan",
    "Kalimantan Utara": "Kalimantan",
    # Sulawesi
    "Sulawesi Utara": "Sulawesi",
    "Gorontalo": "Sulawesi",
    "Sulawesi Tengah": "Sulawesi",
    "Sulawesi Barat": "Sulawesi",
    "Sulawesi Selatan": "Sulawesi",
    "Sulawesi Tenggara": "Sulawesi",
    # Maluku
    "Maluku": "Maluku",
    "Maluku Utara": "Maluku",
    # Papua
    "Papua": "Papua",
    "Papua Barat": "Papua",
    "Papua Pegunungan": "Papua",
    "Papua Selatan": "Papua",
    "Papua Tengah": "Papua",
    "Papua Barat Daya": "Papua",
}

# Authoritative multi-province and national matrix based on WBTb decrees & historical distribution
SPECIAL_REGIONAL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "batik indonesia": {
        "scope_type": "national",
        "primary_game_region": "Nasional",
        "provinces": ["Seluruh Indonesia"],
        "is_nationwide": True,
        "metadata_source": "UNESCO Intangible Cultural Heritage Representative List 2009 & Kemendikbudristek WBTb Nasional"
    },
    "tabot atau tabuik": {
        "scope_type": "multi_province",
        "primary_game_region": "Sumatra",
        "provinces": ["Bengkulu", "Sumatera Barat"],
        "is_nationwide": False,
        "metadata_source": "WBTB Dual Manifestation: Tabot Bengkulu (Kemendikbud) & Tabuik Pariaman (Sumatera Barat)"
    },
    "aksara dan naskah ka ga nga": {
        "scope_type": "multi_province",
        "primary_game_region": "Sumatra",
        "provinces": ["Bengkulu", "Sumatera Selatan", "Lampung"],
        "is_nationwide": False,
        "metadata_source": "Surat Ulu/Ka-Ga-Nga indigenous script family across Rejang, Pasemah, and Lampung highlands"
    },
    "rumah panjang dayak": {
        "scope_type": "multi_province",
        "primary_game_region": "Kalimantan",
        "provinces": ["Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Timur"],
        "is_nationwide": False,
        "metadata_source": "Traditional Dayak communal longhouse architecture (Radakng/Betang/Lamin) across Kalimantan"
    }
}


class RegionalScopeResolver:
    """Resolves authoritative regional scopes for cultural entities."""

    def resolve(
        self,
        name: str,
        province: Optional[str],
        regencies: Optional[List[str]] = None
    ) -> RegionalScope:
        norm_name = name.lower().strip()
        reg_list = [r for r in (regencies or []) if r]

        # 1. Check special cross-province / national registry
        for key, spec in SPECIAL_REGIONAL_REGISTRY.items():
            if key in norm_name or norm_name in key:
                return RegionalScope(
                    scope_type=spec["scope_type"],
                    primary_game_region=spec["primary_game_region"],
                    provinces=spec["provinces"],
                    regencies=reg_list,
                    is_nationwide=spec["is_nationwide"],
                    metadata_source=spec["metadata_source"]
                )

        # 2. Single province resolution
        if province and province.strip() and province.strip().lower() != "unknown":
            prov_clean = province.strip()
            # Normalize common names
            if "Yogyakarta" in prov_clean:
                prov_clean = "Daerah Istimewa Yogyakarta"
            elif "Jakarta" in prov_clean:
                prov_clean = "DKI Jakarta"

            game_region = PROVINCE_TO_GAME_REGION.get(prov_clean, "Sumatra")

            return RegionalScope(
                scope_type="single_province",
                primary_game_region=game_region,
                provinces=[prov_clean],
                regencies=reg_list,
                is_nationwide=False,
                metadata_source="DAPOBUD Official Administrative Registration"
            )

        # 3. Unassigned / Ambiguous
        return RegionalScope(
            scope_type="unassigned",
            primary_game_region="Nasional",
            provinces=[],
            regencies=reg_list,
            is_nationwide=False,
            metadata_source="Unspecified in Source Record"
        )
