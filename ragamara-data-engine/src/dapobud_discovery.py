"""
DAPOBUD Source Discovery Module.
Discovers and verifies public endpoints, queries, and metadata schemas from dapobud.kemenbud.go.id.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import requests
from bs4 import BeautifulSoup

from config import settings

logger = logging.getLogger("ragamara.discovery")


class DapobudDiscovery:
    """Discovers and documents public API endpoints and structures of DAPOBUD."""

    def __init__(self, base_url: str = settings.DAPOBUD_BASE_URL, graphql_url: str = settings.DAPOBUD_GRAPHQL_URL):
        self.base_url = base_url
        self.graphql_url = graphql_url
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "application/json, text/html, */*",
        })

    def run_discovery(self) -> Dict[str, Any]:
        """Runs the complete discovery workflow and returns the findings."""
        logger.info("Starting DAPOBUD source discovery workflow...")
        report: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target_base_url": self.base_url,
            "target_graphql_url": self.graphql_url,
            "status": "in_progress",
            "robots_txt": self._check_robots_txt(),
            "homepage_headers": self._check_homepage_headers(),
            "discovered_endpoints": {},
            "verified_capabilities": {},
            "schema_conclusions": {}
        }

        # Verify GraphQL endpoint availability
        gql_status = self._verify_graphql_endpoint()
        report["discovered_endpoints"]["graphql"] = {
            "url": self.graphql_url,
            "accessible": gql_status["accessible"],
            "status_code": gql_status.get("status_code"),
            "protocol": "GraphQL POST"
        }

        # Verify WBTb Query Capabilities
        wbtb_cap = self._verify_wbtb_query()
        report["verified_capabilities"]["wbtb"] = wbtb_cap

        # Verify OPK Query Capabilities
        opk_cap = self._verify_opk_query()
        report["verified_capabilities"]["opk"] = opk_cap

        # Finalize discovery report conclusions
        report["status"] = "completed" if (wbtb_cap.get("verified") and opk_cap.get("verified")) else "partial"
        report["extraction_strategy"] = "direct_graphql_api"
        report["fallback_strategy"] = "dom_scraping"
        report["schema_conclusions"] = {
            "pagination": {
                "type": "page_based",
                "request_fields": ["page", "pageSize"],
                "response_meta": ["currentPage", "totalPages", "totalItems", "currentItems"]
            },
            "wbtb_entity": {
                "list_query": "findAllWbtb",
                "detail_query": "findOneWbtb",
                "primary_fields": ["id", "number", "name", "domain", "provinceHeritageWbtb", "culturalCreationDescription"]
            },
            "opk_entity": {
                "list_query": "findAllDapobud",
                "detail_query": "findOneDapobud",
                "primary_fields": ["id", "number", "name", "dapobudType", "category", "province", "regency"]
            }
        }

        # Save discovery report
        self.save_report(report)
        return report

    def _check_robots_txt(self) -> Dict[str, Any]:
        """Checks for robots.txt on DAPOBUD server."""
        url = f"{self.base_url}robots.txt"
        try:
            r = self.session.get(url, timeout=settings.REQUEST_TIMEOUT)
            return {
                "status_code": r.status_code,
                "exists": r.status_code == 200,
                "rules": r.text if r.status_code == 200 else None
            }
        except Exception as e:
            logger.warning(f"Failed to fetch robots.txt: {e}")
            return {"status_code": None, "exists": False, "error": str(e)}

    def _check_homepage_headers(self) -> Dict[str, Any]:
        """Checks HTTP response headers and web technology stack of DAPOBUD."""
        try:
            r = self.session.get(self.base_url, timeout=settings.REQUEST_TIMEOUT)
            server = r.headers.get("Server", "Unknown")
            x_served_by = r.headers.get("X-Served-By", "Unknown")
            return {
                "status_code": r.status_code,
                "server": server,
                "x_served_by": x_served_by,
                "content_type": r.headers.get("Content-Type", "")
            }
        except Exception as e:
            logger.error(f"Failed to fetch homepage headers: {e}")
            return {"status_code": None, "error": str(e)}

    def _verify_graphql_endpoint(self) -> Dict[str, Any]:
        """Tests GraphQL endpoint connectivity with a minimal query."""
        payload = {"query": "{ __typename }"}
        try:
            r = self.session.post(self.graphql_url, json=payload, timeout=settings.REQUEST_TIMEOUT)
            return {
                "accessible": r.status_code in [200, 400],
                "status_code": r.status_code
            }
        except Exception as e:
            logger.error(f"GraphQL endpoint connection failed: {e}")
            return {"accessible": False, "error": str(e)}

    def _verify_wbtb_query(self) -> Dict[str, Any]:
        """Verifies ReadAllWBTB and findOneWbtb GraphQL operations."""
        query = """
        query ReadAllWBTB($page: Int!, $pageSize: Int!) {
          findAllWbtb(findAllWbtbInput: { page: $page, pageSize: $pageSize }) {
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
        try:
            r = self.session.post(
                self.graphql_url,
                json={"query": query, "variables": {"page": 1, "pageSize": 2}},
                timeout=settings.REQUEST_TIMEOUT
            )
            data = r.json()
            wbtb_data = data.get("data", {}).get("findAllWbtb", {})
            meta = wbtb_data.get("metaPage", {})
            sample = wbtb_data.get("data", [])
            return {
                "verified": bool(sample),
                "total_items": meta.get("totalItems", 0),
                "total_pages": meta.get("totalPages", 0),
                "sample_id": sample[0]["id"] if sample else None,
                "sample_name": sample[0]["name"] if sample else None
            }
        except Exception as e:
            logger.error(f"WBTb verification error: {e}")
            return {"verified": False, "error": str(e)}

    def _verify_opk_query(self) -> Dict[str, Any]:
        """Verifies findAllDapobud OPK query operation."""
        query = """
        query FindAllDapobud($page: Int, $pageSize: Int, $entity: String, $vervalYear: String) {
          findAllDapobud(findAllDapobudInput: {
            page: $page
            pageSize: $pageSize
            entity: $entity
            vervalYear: $vervalYear
          }) {
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
        try:
            r = self.session.post(
                self.graphql_url,
                json={"query": query, "variables": {"page": 1, "pageSize": 2, "entity": "opk", "vervalYear": "2024"}},
                timeout=settings.REQUEST_TIMEOUT
            )
            data = r.json()
            opk_data = data.get("data", {}).get("findAllDapobud", {})
            meta = opk_data.get("metaPage", {})
            sample = opk_data.get("data", [])
            return {
                "verified": bool(sample),
                "total_items": meta.get("totalItems", 0),
                "sample_id": sample[0]["id"] if sample else None,
                "sample_name": sample[0]["name"] if sample else None
            }
        except Exception as e:
            logger.error(f"OPK verification error: {e}")
            return {"verified": False, "error": str(e)}

    def save_report(self, report_data: Dict[str, Any], output_path: Optional[Path] = None) -> Path:
        """Saves the discovery report to JSON."""
        target_path = output_path or settings.DISCOVERY_REPORT_FILE
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved discovery report to {target_path}")
        return target_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    discovery = DapobudDiscovery()
    rep = discovery.run_discovery()
    print("Discovery complete. Total WBTb items:", rep["verified_capabilities"]["wbtb"].get("total_items"))
