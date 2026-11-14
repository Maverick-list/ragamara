"""
DAPOBUD Client Module.
Executes official cultural record extraction with pagination, throttling, retries, and raw caching.
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
from bs4 import BeautifulSoup
from config import settings

logger = logging.getLogger("ragamara.dapobud")


class DapobudClient:
    """Client for extracting official Indonesian cultural records from DAPOBUD."""

    def __init__(self, cache_enabled: bool = True):
        self.graphql_url = settings.DAPOBUD_GRAPHQL_URL
        self.base_url = settings.DAPOBUD_BASE_URL
        self.cache_enabled = cache_enabled
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def _get_cache_path(self, prefix: str, identifier: str) -> Path:
        """Returns the file path for caching raw requests."""
        safe_hash = hashlib.sha256(identifier.encode("utf-8")).hexdigest()[:16]
        return settings.CACHE_DIR / f"dapobud_{prefix}_{safe_hash}.json"

    def _execute_graphql(self, query: str, variables: Dict[str, Any], cache_key: Optional[str] = None) -> Dict[str, Any]:
        """Executes a GraphQL request with caching, throttling, and retry logic."""
        if self.cache_enabled and cache_key:
            cache_file = self._get_cache_path("gql", cache_key)
            if cache_file.exists():
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        logger.debug(f"Cache hit for key {cache_key}")
                        return json.load(f)
                except Exception as e:
                    logger.warning(f"Error reading cache file {cache_file}: {e}")

        payload = {"query": query, "variables": variables}
        delay = settings.DAPOBUD_REQUEST_DELAY

        for attempt in range(1, settings.MAX_RETRIES + 1):
            try:
                time.sleep(delay)
                response = self.session.post(self.graphql_url, json=payload, timeout=settings.REQUEST_TIMEOUT)

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    logger.warning(f"Received HTTP 429 Too Many Requests. Backing off for {retry_after}s...")
                    time.sleep(retry_after)
                    continue

                if response.status_code == 403:
                    logger.error("Received HTTP 403 Forbidden from DAPOBUD.")
                    response.raise_for_status()

                response.raise_for_status()
                data = response.json()

                if "errors" in data and not data.get("data"):
                    err_msg = json.dumps(data["errors"])
                    logger.warning(f"GraphQL returned errors on attempt {attempt}: {err_msg}")
                    if attempt == settings.MAX_RETRIES:
                        return {"error": err_msg, "data": None}
                    time.sleep(settings.BACKOFF_FACTOR ** attempt)
                    continue

                if self.cache_enabled and cache_key:
                    cache_file = self._get_cache_path("gql", cache_key)
                    try:
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump(data, f, ensure_ascii=False)
                    except Exception as e:
                        logger.warning(f"Error writing cache {cache_file}: {e}")

                return data

            except requests.exceptions.RequestException as e:
                logger.warning(f"Request failed (attempt {attempt}/{settings.MAX_RETRIES}): {e}")
                if attempt == settings.MAX_RETRIES:
                    logger.error(f"All {settings.MAX_RETRIES} attempts failed for GraphQL query.")
                    return {"error": str(e), "data": None}
                time.sleep(settings.BACKOFF_FACTOR ** attempt)

        return {"error": "Max retries exceeded", "data": None}

    def fetch_wbtb_list(self, page: int = 1, page_size: int = settings.DEFAULT_PAGE_SIZE, search: Optional[str] = None) -> Dict[str, Any]:
        """Fetches a page of Warisan Budaya Takbenda (WBTb) records."""
        query = """
        query ReadAllWBTB(
          $page: Int!
          $pageSize: Int!
          $search: String
          $orderBy: RekomendasiWbtbOrderByEnum
          $direction: DirectionEnum
        ) {
          findAllWbtb(
            findAllWbtbInput: {
              page: $page
              pageSize: $pageSize
              search: $search
              orderBy: $orderBy
              direction: $direction
            }
          ) {
            metaPage {
              currentPage
              totalPages
              totalItems
              currentItems
            }
            data {
              id
              number
              name
              domain { name }
              provinceHeritageWbtb { province }
              assignmentDate
            }
          }
        }
        """
        variables = {
            "page": page,
            "pageSize": page_size,
            "search": search,
            "direction": "asc",
            "orderBy": "number"
        }
        cache_key = f"wbtb_list_p{page}_s{page_size}_q{search or ''}"
        res = self._execute_graphql(query, variables, cache_key=cache_key)
        return res.get("data", {}).get("findAllWbtb", {})

    def fetch_wbtb_detail(self, dapobud_id: str) -> Optional[Dict[str, Any]]:
        """Fetches complete detail of a specific WBTb record including official description."""
        query = """
        query FindOneWbtb($dapobudId: String) {
          findOneWbtb(findOneWbtbInput: { id: $dapobudId }) {
            id
            number
            name
            culturalCreationDescription
            assignmentDate
            domain { name }
            provinceHeritageWbtb { province }
            photos {
              data {
                path
                caption
                mimeType
              }
            }
          }
        }
        """
        cache_key = f"wbtb_detail_{dapobud_id}"
        res = self._execute_graphql(query, {"dapobudId": dapobud_id}, cache_key=cache_key)
        return res.get("data", {}).get("findOneWbtb")

    def fetch_opk_list(self, page: int = 1, page_size: int = settings.DEFAULT_PAGE_SIZE, search: Optional[str] = None, verval_year: str = "2024") -> Dict[str, Any]:
        """Fetches a page of Objek Pemajuan Kebudayaan (OPK) records."""
        query = """
        query FindAllDapobud(
          $page: Int
          $pageSize: Int
          $search: String
          $entity: String
          $vervalYear: String
        ) {
          findAllDapobud(
            findAllDapobudInput: {
              page: $page
              pageSize: $pageSize
              search: $search
              entity: $entity
              vervalYear: $vervalYear
            }
          ) {
            metaPage {
              currentPage
              totalPages
              currentItems
              totalItems
            }
            data {
              id
              number
              name
              dapobudType
              category
              province { province }
              regency { regency }
            }
          }
        }
        """
        variables = {
            "page": page,
            "pageSize": page_size,
            "search": search,
            "entity": "opk",
            "vervalYear": verval_year
        }
        cache_key = f"opk_list_p{page}_s{page_size}_y{verval_year}_q{search or ''}"
        res = self._execute_graphql(query, variables, cache_key=cache_key)
        return res.get("data", {}).get("findAllDapobud", {})

    def fetch_opk_detail(self, dapobud_id: str) -> Optional[Dict[str, Any]]:
        """Fetches general detail of an OPK record."""
        query = """
        query FindOneDapobud($dapobudId: String!) {
          findOneDapobud(id: $dapobudId) {
            name
            number
            level
            createdAt
            verval { date }
            dapobudType
            category
            subCategory
          }
        }
        """
        cache_key = f"opk_detail_{dapobud_id}"
        res = self._execute_graphql(query, {"dapobudId": dapobud_id}, cache_key=cache_key)
        return res.get("data", {}).get("findOneDapobud")

    def parse_html_fallback(self, html_text: str) -> List[Dict[str, Any]]:
        """DOM parsing fallback if GraphQL is ever blocked or inaccessible."""
        soup = BeautifulSoup(html_text, "html.parser")
        records = []
        table = soup.find("table", id="tableEntity") or soup.find("table")
        if not table:
            return records

        rows = table.find_all("tr")[1:]  # skip header
        for row in rows:
            cols = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
            if len(cols) >= 4:
                records.append({
                    "number": cols[1] if len(cols) > 1 else None,
                    "name": cols[2] if len(cols) > 2 else cols[0],
                    "region": cols[3] if len(cols) > 3 else None,
                    "category": cols[5] if len(cols) > 5 else (cols[4] if len(cols) > 4 else None)
                })
        return records
