"""
tests/test_mitre.py
────────────────────
Unit tests for api/services/mitre.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO_ROOT))

from api.services.mitre import get_mitre, get_mitre_dict, MITRE_MAP, MitreInfo  # noqa: E402


_KNOWN_FAMILIES = ["DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Bot", "Unknown"]


class TestMitreMap:
    def test_all_families_present(self):
        for fam in _KNOWN_FAMILIES:
            assert fam in MITRE_MAP, f"Missing MITRE entry for {fam}"

    def test_all_fields_non_empty(self):
        for fam, info in MITRE_MAP.items():
            assert info.tactic,       f"Empty tactic for {fam}"
            assert info.technique,    f"Empty technique for {fam}"
            assert info.technique_id, f"Empty technique_id for {fam}"
            assert info.url,          f"Empty url for {fam}"

    def test_url_starts_with_https(self):
        for fam, info in MITRE_MAP.items():
            assert info.url.startswith("https://"), f"Bad URL for {fam}: {info.url}"


class TestGetMitre:
    def test_returns_mitre_info(self):
        result = get_mitre("DoS")
        assert isinstance(result, MitreInfo)

    def test_known_family(self):
        info = get_mitre("DDoS")
        assert "Impact" in info.tactic
        assert "T1498" in info.technique_id

    def test_unknown_family_fallback(self):
        info = get_mitre("SomeRandomFamily")
        assert info.tactic == "Unmapped"

    def test_dict_output_serialisable(self):
        d = get_mitre_dict("Bot")
        assert isinstance(d, dict)
        assert "tactic" in d
        assert "technique" in d
        assert "technique_id" in d
        assert "url" in d

    @pytest.mark.parametrize("family", _KNOWN_FAMILIES)
    def test_each_family(self, family: str):
        info = get_mitre(family)
        assert info is not None
        assert isinstance(info.tactic, str)
