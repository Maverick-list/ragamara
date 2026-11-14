"""
Data Models and TypedDict Definitions for RAGAMARA Cultural Knowledge Database.
Schema Version: 2.0.0
"""

from typing import Dict, Any, List, Optional, TypedDict


class SourceRecord(TypedDict, total=False):
    source_name: str
    official_uuid: str
    registration_number: str
    entity_type: str  # WBTB | OPK
    administrative_tier: str  # nasional | provinsi | kabupaten_kota | komunitas | unknown
    registered_province: Optional[str]
    registered_regency: Optional[str]
    assignment_date: Optional[str]
    official_description: Optional[str]
    source_url: str
    raw_payload_snippet: Dict[str, Any]


class RegionalScope(TypedDict, total=False):
    scope_type: str  # single_province | multi_province | national | unassigned
    primary_game_region: str  # Sumatra | Jawa | Bali & Nusa Tenggara | Kalimantan | Sulawesi | Maluku | Papua | Nasional
    provinces: List[str]
    regencies: List[str]
    is_nationwide: bool
    metadata_source: str


class ScoreBreakdown(TypedDict, total=False):
    name_score: float
    domain_score: float
    geographic_score: float
    description_score: float
    negative_penalty: float


class MatchingMetadata(TypedDict, total=False):
    confidence_score: float
    method: str  # exact | normalized_exact | semantic_composite | manual_curated | no_match
    score_breakdown: ScoreBreakdown
    review_status: str  # not_required | requires_review | approved | rejected
    candidate_titles: List[str]
    review_notes: str


class EnrichmentLayer(TypedDict, total=False):
    status: str  # matched | no_match | manual_override
    source: str
    page_title: Optional[str]
    page_id: Optional[int]
    page_url: Optional[str]
    revision_id: Optional[int]
    summary_extract: Optional[str]
    matching_metadata: MatchingMetadata


class MediaAsset(TypedDict, total=False):
    asset_id: str
    asset_type: str  # image | audio | video
    role: str  # hero | gallery | thumbnail
    file_title: str
    thumbnail_url: str
    original_url: str
    file_page_url: str
    creator: str
    license: str
    license_url: Optional[str]
    attribution_text: str
    commercial_use_permitted: bool
    cultural_relevance_status: str  # verified_authentic | requires_replacement | unverified
    verification_timestamp: str


class Provenance(TypedDict, total=False):
    created_at: str
    last_updated_at: str
    quality_verified: bool
    validation_flags: List[str]


class CanonicalEntity(TypedDict, total=False):
    entity_id: str
    canonical_name: str
    slug: str
    alternate_names: List[str]
    cultural_domain: str
    dapobud_category_raw: str
    canonical_description: str
    regional_scope: RegionalScope
    source_records: List[SourceRecord]
    enrichment: EnrichmentLayer
    media: List[MediaAsset]
    provenance: Provenance


class DatabaseMetadata(TypedDict, total=False):
    database_name: str
    schema_version: str
    generated_at: str
    language: str
    primary_source: str
    enrichment_source: str
    total_canonical_entities: int
    total_source_records: int
    enrichment_summary: Dict[str, Any]


class CulturalDatabase(TypedDict, total=False):
    metadata: DatabaseMetadata
    sources: Dict[str, Any]
    entities: List[CanonicalEntity]
