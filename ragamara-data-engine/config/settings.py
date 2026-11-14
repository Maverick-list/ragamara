"""
Configuration and settings for the RAGAMARA Cultural Data Enrichment Engine.
Schema Version: 2.0.0
"""

from pathlib import Path
import os

# Project Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
RAW_DIR = DATA_DIR / "raw"
REPORTS_DIR = DATA_DIR / "reports"
BACKUPS_DIR = BASE_DIR.parent / "data" / "backups"

# Primary & Mirrored Deliverables
OUTPUT_FILE = BASE_DIR / "ragamara_culture_db.json"
ROOT_OUTPUT_FILE = BASE_DIR.parent / "ragamara_culture_db.json"
FRONTEND_JS_FILE = BASE_DIR.parent / "js" / "culture_db_data.js"

DISCOVERY_REPORT_FILE = REPORTS_DIR / "dapobud_discovery_report.json"
QUALITY_REPORT_FILE = REPORTS_DIR / "data_quality_report.json"
LOG_FILE = REPORTS_DIR / "pipeline_execution.log"

# Network & API Endpoints
DAPOBUD_BASE_URL = "https://dapobud.kemenbud.go.id/"
DAPOBUD_GRAPHQL_URL = "https://dapobud.kemenbud.go.id/backend/graphql"
MEDIAWIKI_API_URL = "https://id.wikipedia.org/w/api.php"

# Compliance & User-Agent Policy
USER_AGENT = os.getenv(
    "RAGAMARA_USER_AGENT",
    "RAGAMARA-DataPipeline/2.0 (+https://ragamara.budayago.id; cultural-research@ragamara.budayago.id)"
)

# Throttling & Politeness (seconds)
DAPOBUD_REQUEST_DELAY = float(os.getenv("DAPOBUD_REQUEST_DELAY", "1.0"))
MEDIAWIKI_REQUEST_DELAY = float(os.getenv("MEDIAWIKI_REQUEST_DELAY", "1.0"))

# Request Parameters
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "15"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
BACKOFF_FACTOR = float(os.getenv("BACKOFF_FACTOR", "1.5"))

# Semantic Matching Weights & Thresholds
WEIGHT_NAME = 0.40
WEIGHT_DOMAIN = 0.25
WEIGHT_GEO = 0.20
WEIGHT_DESC = 0.15
MAX_NEGATIVE_PENALTY = 0.45

CONFIDENCE_AUTO_ACCEPT = 0.85
CONFIDENCE_REVIEW_THRESHOLD = 0.72
CONFIDENCE_REJECT_THRESHOLD = 0.60

# Schema Version
SCHEMA_VERSION = "2.0.0"

# Supported Cultural Entity Types
SUPPORTED_ENTITIES = ["WBTB", "OPK"]
DEFAULT_PAGE_SIZE = 50

# Ensure directories exist
for directory in [DATA_DIR, CACHE_DIR, RAW_DIR, REPORTS_DIR, BACKUPS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
