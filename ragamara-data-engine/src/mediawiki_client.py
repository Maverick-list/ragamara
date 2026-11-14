"""
Wikipedia Indonesia MediaWiki Client Module.
Performs search, page extraction, image resolution, and license metadata parsing via MediaWiki Action API.
"""

import hashlib
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import requests
from config import settings

logger = logging.getLogger("ragamara.mediawiki")


class MediaWikiClient:
    """Client for Wikipedia Indonesia MediaWiki Action API."""

    def __init__(self, api_url: str = settings.MEDIAWIKI_API_URL, cache_enabled: bool = True):
        self.api_url = api_url
        self.cache_enabled = cache_enabled
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "application/json",
        })

    def _get_cache_path(self, prefix: str, identifier: str) -> Path:
        """Returns the file path for caching raw MediaWiki responses."""
        safe_hash = hashlib.sha256(identifier.encode("utf-8")).hexdigest()[:16]
        return settings.CACHE_DIR / f"wiki_{prefix}_{safe_hash}.json"

    def _get(self, params: Dict[str, Any], cache_key: Optional[str] = None) -> Dict[str, Any]:
        """Executes a GET request with caching, polite throttling, and exponential backoff."""
        if self.cache_enabled and cache_key:
            cache_file = self._get_cache_path("get", cache_key)
            if cache_file.exists():
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception as e:
                    logger.warning(f"Error reading wiki cache {cache_file}: {e}")

        params["format"] = "json"
        delay = settings.MEDIAWIKI_REQUEST_DELAY

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                time.sleep(delay)
                response = self.session.get(self.api_url, params=params, timeout=settings.REQUEST_TIMEOUT)

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    logger.warning(f"Wikipedia 429 Rate Limit. Backing off for {retry_after}s...")
                    time.sleep(retry_after)
                    continue

                response.raise_for_status()
                data = response.json()

                if self.cache_enabled and cache_key:
                    cache_file = self._get_cache_path("get", cache_key)
                    try:
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump(data, f, ensure_ascii=False)
                    except Exception as e:
                        logger.warning(f"Error writing wiki cache {cache_file}: {e}")

                return data

            except requests.exceptions.RequestException as e:
                logger.warning(f"Wiki request failed (attempt {attempt}/{settings.MAX_RETRIES}): {e}")
                if attempt == settings.MAX_RETRIES:
                    logger.error(f"All {settings.MAX_RETRIES} attempts failed for Wiki API query.")
                    return {"error": str(e)}
                time.sleep(settings.BACKOFF_FACTOR ** attempt)

        return {"error": "Max retries exceeded"}

    def search_articles(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Searches Wikipedia Indonesia for candidate articles matching the cultural query."""
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": limit,
            "utf8": 1
        }
        cache_key = f"search_{query}_{limit}"
        res = self._get(params, cache_key=cache_key)
        return res.get("query", {}).get("search", [])

    def get_article_details(self, title: str) -> Optional[Dict[str, Any]]:
        """Retrieves page summary extract, canonical URL, and thumbnail image for an article."""
        params = {
            "action": "query",
            "prop": "extracts|pageimages|info",
            "inprop": "url",
            "exintro": 1,
            "explaintext": 1,
            "pithumbsize": 800,
            "piprop": "thumbnail|name|original",
            "titles": title,
            "utf8": 1
        }
        cache_key = f"detail_{title}"
        res = self._get(params, cache_key=cache_key)
        pages = res.get("query", {}).get("pages", {})
        if not pages:
            return None

        # MediaWiki returns pages keyed by page ID (or "-1" if missing)
        for page_id, page_data in pages.items():
            if str(page_id) == "-1" or "missing" in page_data:
                return None
            return page_data
        return None

    def get_image_metadata(self, file_title: str) -> Dict[str, Any]:
        """Retrieves license, author, and usage metadata for a Wikimedia file."""
        if not file_title.startswith("File:"):
            file_title = f"File:{file_title}"

        params = {
            "action": "query",
            "titles": file_title,
            "prop": "imageinfo",
            "iiprop": "url|user|extmetadata",
            "utf8": 1
        }
        cache_key = f"img_{file_title}"
        res = self._get(params, cache_key=cache_key)
        pages = res.get("query", {}).get("pages", {})

        metadata = {
            "creator": None,
            "license": None,
            "license_url": None,
            "attribution": None,
            "file_page_url": None
        }

        for _, page in pages.items():
            image_infos = page.get("imageinfo", [])
            if not image_infos:
                continue
            ii = image_infos[0]
            metadata["file_page_url"] = ii.get("descriptionurl")
            metadata["creator"] = ii.get("user")

            ext = ii.get("extmetadata", {})
            if "LicenseShortName" in ext:
                metadata["license"] = ext["LicenseShortName"].get("value")
            if "LicenseUrl" in ext:
                metadata["license_url"] = ext["LicenseUrl"].get("value")
            if "Artist" in ext:
                # Strip HTML from artist string if present
                artist_val = ext["Artist"].get("value", "")
                if "<" in artist_val:
                    from bs4 import BeautifulSoup
                    artist_val = BeautifulSoup(artist_val, "html.parser").get_text(strip=True)
                metadata["creator"] = artist_val or metadata["creator"]
            if "UsageTerms" in ext:
                metadata["attribution"] = ext["UsageTerms"].get("value")

        return metadata
