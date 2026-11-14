"""
Tests for Pipeline Execution and Checkpoint Recovery.
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from src.pipeline import CulturalDataPipeline


def test_pipeline_dry_run(tmp_path):
    output_file = tmp_path / "test_culture_db.json"
    pipeline = CulturalDataPipeline(output_file=output_file, cache_enabled=False, fetch_details=False)

    # Mock DapobudClient and MediaWikiClient
    mock_wbtb_data = {
        "metaPage": {"currentPage": 1, "totalPages": 1, "totalItems": 1},
        "data": [
            {
                "id": "item-101",
                "number": "WBTB/2021/001",
                "name": "Angklung",
                "domain": {"name": "Seni Pertunjukan"},
                "provinceHeritageWbtb": {"province": "JAWA BARAT"}
            }
        ]
    }

    mock_wiki_search = [
        {"title": "Angklung", "pageid": 555, "snippet": "Alat musik bambu dari Jawa Barat"}
    ]

    mock_wiki_detail = {
        "pageid": 555,
        "title": "Angklung",
        "fullurl": "https://id.wikipedia.org/wiki/Angklung",
        "extract": "Angklung adalah alat musik multitonal bambu tradisional Indonesia.",
        "thumbnail": {"source": "https://upload.wikimedia.org/angklung.jpg"}
    }

    with patch.object(pipeline.dapobud_client, "fetch_wbtb_list", return_value=mock_wbtb_data), \
         patch.object(pipeline.mediawiki_client, "search_articles", return_value=mock_wiki_search), \
         patch.object(pipeline.mediawiki_client, "get_article_details", return_value=mock_wiki_detail):

        result = pipeline.run(limit=1, entity_types=["WBTb"], dry_run=True)
        assert result["status"] == "success"
        assert result["total_records"] == 1
        assert result["quality_summary"]["matched_wikipedia_articles"] == 1
        assert not output_file.exists()  # dry run does not write


def test_pipeline_storage_atomic(tmp_path):
    output_file = tmp_path / "atomic_db.json"
    pipeline = CulturalDataPipeline(output_file=output_file, cache_enabled=False, fetch_details=False)

    mock_wbtb_data = {
        "metaPage": {"currentPage": 1, "totalPages": 1, "totalItems": 1},
        "data": [
            {
                "id": "item-202",
                "number": "WBTB/2021/002",
                "name": "Sasando",
                "domain": {"name": "Seni Pertunjukan"},
                "provinceHeritageWbtb": {"province": "NUSA TENGGARA TIMUR"}
            }
        ]
    }

    with patch.object(pipeline.dapobud_client, "fetch_wbtb_list", return_value=mock_wbtb_data), \
         patch.object(pipeline.mediawiki_client, "search_articles", return_value=[]):

        result = pipeline.run(limit=1, entity_types=["WBTb"], dry_run=False)
        assert result["status"] == "success"
        assert output_file.exists()

        with open(output_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert data["metadata"]["total_records"] == 1
            assert data["records"][0]["name"] == "Sasando"
            assert data["records"][0]["wikipedia"]["status"] == "no_match"
