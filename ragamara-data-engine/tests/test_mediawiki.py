"""
Tests for Wikipedia Indonesia MediaWiki Client.
"""

import pytest
from unittest.mock import MagicMock, patch
from src.mediawiki_client import MediaWikiClient


@pytest.fixture
def mock_wiki_client():
    return MediaWikiClient(cache_enabled=False)


def test_wiki_search_parsing(mock_wiki_client):
    mock_payload = {
        "query": {
            "search": [
                {"title": "Rendang", "pageid": 1234, "snippet": "Makanan khas Minangkabau"}
            ]
        }
    }

    with patch.object(mock_wiki_client.session, "get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_payload
        mock_get.return_value = mock_resp

        results = mock_wiki_client.search_articles("Rendang")
        assert len(results) == 1
        assert results[0]["title"] == "Rendang"
        assert results[0]["pageid"] == 1234


def test_wiki_image_metadata(mock_wiki_client):
    mock_payload = {
        "query": {
            "pages": {
                "999": {
                    "imageinfo": [
                        {
                            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Rendang.jpg",
                            "user": "WikiPhotographer",
                            "extmetadata": {
                                "LicenseShortName": {"value": "CC BY-SA 4.0"},
                                "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0/"},
                                "Artist": {"value": "John Doe"}
                            }
                        }
                    ]
                }
            }
        }
    }

    with patch.object(mock_wiki_client.session, "get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_payload
        mock_get.return_value = mock_resp

        meta = mock_wiki_client.get_image_metadata("Rendang.jpg")
        assert meta["license"] == "CC BY-SA 4.0"
        assert meta["creator"] == "John Doe"
