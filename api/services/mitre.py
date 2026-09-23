"""
api/services/mitre.py
──────────────────────
MITRE ATT&CK mapping for NetWatch alert families.

Verbatim mapping from the project spec.
The system NEVER auto-blocks; MITRE info is advisory context for analysts.

Public API
──────────
  get_mitre(family: str) → MitreInfo
  MITRE_MAP : dict[str, MitreInfo]
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Optional


@dataclass(frozen=True)
class MitreInfo:
    tactic:    str
    technique: str
    technique_id: str
    url:       str


# ── Mapping table (from spec) ─────────────────────────────────────────────────
MITRE_MAP: dict[str, MitreInfo] = {
    "DoS": MitreInfo(
        tactic="Impact",
        technique="Network Denial of Service",
        technique_id="T1498",
        url="https://attack.mitre.org/techniques/T1498/",
    ),
    "DDoS": MitreInfo(
        tactic="Impact",
        technique="Network Denial of Service / Endpoint Denial of Service",
        technique_id="T1498/T1499",
        url="https://attack.mitre.org/techniques/T1498/",
    ),
    "PortScan": MitreInfo(
        tactic="Reconnaissance / Discovery",
        technique="Active Scanning / Network Service Discovery",
        technique_id="T1595/T1046",
        url="https://attack.mitre.org/techniques/T1595/",
    ),
    "BruteForce": MitreInfo(
        tactic="Credential Access",
        technique="Brute Force",
        technique_id="T1110",
        url="https://attack.mitre.org/techniques/T1110/",
    ),
    "WebAttack": MitreInfo(
        tactic="Initial Access",
        technique="Exploit Public-Facing Application",
        technique_id="T1190",
        url="https://attack.mitre.org/techniques/T1190/",
    ),
    "Bot": MitreInfo(
        tactic="Command and Control",
        technique="Application Layer Protocol",
        technique_id="T1071",
        url="https://attack.mitre.org/techniques/T1071/",
    ),
    "Unknown": MitreInfo(
        tactic="Unmapped",
        technique="Analyst to classify",
        technique_id="—",
        url="https://attack.mitre.org/",
    ),
    "Novel": MitreInfo(
        tactic="Unmapped",
        technique="Analyst to classify",
        technique_id="—",
        url="https://attack.mitre.org/",
    ),
}

# Fallback for any unexpected family
_UNKNOWN = MitreInfo(
    tactic="Unmapped",
    technique="Analyst to classify",
    technique_id="—",
    url="https://attack.mitre.org/",
)


def get_mitre(family: str) -> MitreInfo:
    """
    Return the MITRE ATT&CK mapping for the given family.

    Parameters
    ----------
    family : canonical family name (e.g. "DoS", "PortScan", "Unknown")

    Returns
    -------
    MitreInfo dataclass (tactic, technique, technique_id, url)
    """
    return MITRE_MAP.get(family, _UNKNOWN)


def get_mitre_dict(family: str) -> dict[str, str]:
    """Return MITRE info as a plain dict (for JSON serialisation)."""
    return asdict(get_mitre(family))
