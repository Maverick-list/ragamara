"""
Tests for DAPOBUD Client and Discovery.
"""

import pytest
from unittest.mock import MagicMock, patch
from src.dapobud_client import DapobudClient


@pytest.fixture
def mock_dapobud_client():
    client = DapobudClient(cache_enabled=False)
    return client


def test_wbtb_parsing(mock_dapobud_client):
    mock_response = {
        "data": {
            "findAllWbtb": {
                "metaPage": {
                    "currentPage": 1,
                    "totalPages": 10,
                    "totalItems": 100,
                    "currentItems": 1
                },
                "data": [
                    {
                        "id": "mock-uuid-1",
                        "number": "WBTB/2020/001",
                        "name": "Rendang Padang",
                        "domain": {"name": "Kemahiran Kerajinan Tradisional"},
                        "provinceHeritageWbtb": {"province": "SUMATERA BARAT"},
                        "assignmentDate": "2020-01-01"
                    }
                ]
            }
        }
    }

    with patch.object(mock_dapobud_client.session, "post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_response
        mock_post.return_value = mock_resp

        result = mock_dapobud_client.fetch_wbtb_list(page=1, page_size=1)
        assert result["metaPage"]["totalItems"] == 100
        assert len(result["data"]) == 1
        assert result["data"][0]["name"] == "Rendang Padang"


def test_html_fallback_parsing(mock_dapobud_client):
    html = """
    <table id="tableEntity">
        <tr><th>No</th><th>Nomor</th><th>Nama</th><th>Wilayah</th><th>Domain</th></tr>
        <tr><td>1</td><td>WBTB/001</td><td>Tari Saman</td><td>Aceh</td><td>Seni Pertunjukan</td></tr>
    </table>
    """
    records = mock_dapobud_client.parse_html_fallback(html)
    assert len(records) == 1
    assert records[0]["name"] == "Tari Saman"
    assert records[0]["number"] == "WBTB/001"
