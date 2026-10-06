"""Security test suite to detect hardcoded API keys, tokens, and secrets in the codebase.

This test runs in GitHub Actions CI (and locally via pytest/make test) to ensure
no sensitive credentials, API keys, or private tokens are accidentally committed.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

ROOT_DIR = Path(__file__).resolve().parents[1]

# Known secret and API key pattern signatures
SECRET_PATTERNS: dict[str, re.Pattern[str]] = {
    "AWS Access Key": re.compile(r"\b(?:AKIA|ASIA|AROA)[0-9A-Z]{16}\b"),
    "AWS Secret Access Key": re.compile(
        r"""(?i)\b(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?"""
    ),
    "OpenAI API Key": re.compile(
        r"\b(?:sk-(?:proj-|admin-)?[a-zA-Z0-9_-]{20,}|sk-[a-zA-Z0-9]{20,})\b"
    ),
    "Anthropic API Key": re.compile(r"\bsk-ant-[a-zA-Z0-9_-]{20,}\b"),
    "Google / Firebase API Key": re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"),
    "GitHub Token": re.compile(
        r"\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|ghr_[a-zA-Z0-9]{36})\b"
    ),
    "Slack Token": re.compile(r"\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9]*\b"),
    "HuggingFace Token": re.compile(r"\bhf_[a-zA-Z0-9]{34,}\b"),
    "Stripe Secret Key": re.compile(r"\b(?:sk_live|rk_live)_[0-9a-zA-Z]{24,}\b"),
    "Private Key Block": re.compile(
        r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"
    ),
    "Generic High-Entropy Secret Assignment": re.compile(
        r"""(?i)\b(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{20,})["']"""
    ),
}

# Directories and file patterns to ignore during file discovery
IGNORED_DIR_NAMES = {
    ".git",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "__pycache__",
    ".pytest_cache",
    ".cache",
    "node_modules",
    ".next",
    "build",
    "dist",
    "backups",
}

IGNORED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".webp",
    ".pdf",
    ".db",
    ".sqlite",
    ".parquet",
    ".pkl",
    ".pickle",
    ".npy",
    ".npz",
    ".joblib",
    ".bin",
    ".sst",
    ".tar",
    ".gz",
    ".zip",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".pyc",
}

IGNORED_FILE_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "Pipfile.lock",
    "tsconfig.tsbuildinfo",
    ".DS_Store",
}

# Substrings that denote dummy templates, documentation, or placeholders
PLACEHOLDER_WORDS = [
    "your-api-key",
    "your_api_key",
    "your-key",
    "placeholder",
    "dummy",
    "example",
    "sample",
    "fake",
    "mock",
    "change-this",
    "change_me",
    "my-secret",
    "api_key_here",
    "your_token_here",
    "insert_here",
    "todo",
    "<api",
    "admin_netwatch",
]


class SecretFinding(NamedTuple):
    file_path: str
    line_number: int
    rule_name: str
    redacted_value: str
    line_content: str


def redact_secret(secret: str) -> str:
    """Mask secret value to prevent leaking it in test output or CI logs."""
    cleaned = secret.strip().strip("'\"")
    if len(cleaned) <= 8:
        return "***"
    prefix = cleaned[:4]
    suffix = cleaned[-4:]
    return f"{prefix}...{suffix}"


def is_placeholder(value: str) -> bool:
    """Determine whether a candidate secret match is an intentional placeholder."""
    val_lower = value.lower()
    # Check if exact placeholder phrase is present
    if any(p in val_lower for p in PLACEHOLDER_WORDS):
        return True
    # Check if template delimiters or env var calls
    if (
        "${" in val_lower
        or "process.env" in val_lower
        or "os.getenv" in val_lower
        or "os.environ" in val_lower
    ):
        return True
    # Check for excessive single-char repetition (e.g. 00000000 or xxxxxxxx)
    if re.search(r"(.)\1{7,}", val_lower):
        return True
    # Check for dummy keys like sk-proj-xxxxxxxxxxxxxxxxxxxx
    if re.search(r"^[a-z_-]*x{6,}[a-z_-]*$", val_lower):
        return True
    return False


def is_ignored_path(path: Path) -> bool:
    """Check whether a path should be skipped during secret scanning."""
    # Never scan the test file itself (contains detection regexes)
    if path.name == "test_api_keys.py":
        return True

    # Ignore template and example configuration files
    if ".example" in path.name or ".template" in path.name or ".sample" in path.name:
        return True

    # Ignore file names and extensions
    if path.name in IGNORED_FILE_NAMES or path.suffix.lower() in IGNORED_EXTENSIONS:
        return True

    # Ignore directory parts
    for part in path.parts:
        if part in IGNORED_DIR_NAMES:
            return True

    return False


def get_files_to_scan(root: Path = ROOT_DIR) -> list[Path]:
    """Return all tracked or repository files to scan."""
    # First priority: git tracked files
    try:
        proc = subprocess.run(
            ["git", "ls-files"],
            cwd=str(root),
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            tracked = [
                (root / line.strip()).resolve()
                for line in proc.stdout.splitlines()
                if line.strip()
            ]
            return [p for p in tracked if p.is_file() and not is_ignored_path(p)]
    except Exception:
        pass

    # Fallback: filesystem walk
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIR_NAMES]
        for f in filenames:
            file_path = (Path(dirpath) / f).resolve()
            if not is_ignored_path(file_path):
                files.append(file_path)
    return files


def scan_file_for_secrets(file_path: Path) -> list[SecretFinding]:
    """Scan an individual file for hardcoded secrets and API keys."""
    if is_ignored_path(file_path):
        return []

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    findings: list[SecretFinding] = []
    rel_path = str(file_path.relative_to(ROOT_DIR)) if file_path.is_relative_to(ROOT_DIR) else str(file_path)

    for line_idx, line in enumerate(content.splitlines(), start=1):
        # Allow suppressing a line with an explicit pragma comment
        if "pragma: allowlist secret" in line or "netwatch: allow-key" in line or "allow-secret" in line:
            continue

        for rule_name, pattern in SECRET_PATTERNS.items():
            for match in pattern.finditer(line):
                matched_val = match.group(1) if match.groups() else match.group(0)

                # Filter out obvious placeholders, environment variable calls, or doc strings
                if is_placeholder(matched_val):
                    continue

                findings.append(
                    SecretFinding(
                        file_path=rel_path,
                        line_number=line_idx,
                        rule_name=rule_name,
                        redacted_value=redact_secret(matched_val),
                        line_content=line.strip()[:100],
                    )
                )

    return findings


# ==============================================================================
# Pytest Test Cases
# ==============================================================================

def test_no_hardcoded_api_keys_in_repository():
    """Scan all tracked files in repository to ensure no API keys or secrets are committed."""
    files_to_scan = get_files_to_scan(ROOT_DIR)
    assert len(files_to_scan) > 0, "Expected to find repository files to scan."

    all_findings: list[SecretFinding] = []
    for f in files_to_scan:
        findings = scan_file_for_secrets(f)
        all_findings.extend(findings)

    if all_findings:
        msg = "\n" + "=" * 80 + "\n"
        msg += f"FAILED: Found {len(all_findings)} potential hardcoded secret(s) in repository:\n"
        for finding in all_findings:
            msg += (
                f"  - {finding.file_path}:{finding.line_number} "
                f"[{finding.rule_name}] -> {finding.redacted_value}\n"
                f"    Snippet: {finding.line_content}\n"
            )
        msg += "=" * 80 + "\n"
        raise AssertionError(msg)


def test_gitignore_protects_env_files():
    """Verify that sensitive .env and secret files are explicitly ignored by .gitignore."""
    gitignore_path = ROOT_DIR / ".gitignore"
    assert gitignore_path.exists(), ".gitignore must exist"

    gitignore_content = gitignore_path.read_text(encoding="utf-8")
    expected_rules = [".env", ".env*.local", "deployment/.env.production"]

    for rule in expected_rules:
        assert rule in gitignore_content, f".gitignore should contain '{rule}'"


def test_detector_identifies_synthetic_keys(tmp_path):
    """Verify detector identifies all secret patterns and flags them."""
    # Synthesize test cases with intentional fake keys (safely constructed)
    test_cases = [
        ("AWS Access Key", "AKIA" + "J234567890ABCDEF"),
        ("OpenAI API Key", "sk-" + "abcdef1234567890abcdef1234567890"),
        ("Anthropic API Key", "sk-ant-" + "api03-abcdef1234567890abcdef123456"),
        ("Google / Firebase API Key", "AIza" + "SyD3uL8v7qW1xZ5r0tY2uI3oP4aS5dF6gH7"),
        ("GitHub Token", "ghp_" + "1234567890abcdefghijklmnopqrstuvwxyz"),
        ("Slack Token", "xoxb-" + "123456789012-1234567890123-abcABC123"),
        ("Stripe Secret Key", "sk_live_" + "1234567890abcdefghijklmn"),
        ("Private Key Block", "-----BEGIN " + "RSA PRIVATE KEY-----"),
    ]

    for idx, (rule_name, sample_key) in enumerate(test_cases):
        safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", rule_name)
        sample_file = tmp_path / f"test_{safe_name}_{idx}.txt"
        sample_file.write_text(f"my_secret = '{sample_key}'\n", encoding="utf-8")
        findings = scan_file_for_secrets(sample_file)
        assert len(findings) >= 1, f"Expected {rule_name} to be flagged in {sample_file}"
        assert any(f.rule_name == rule_name for f in findings)


def test_detector_ignores_safe_placeholders(tmp_path):
    """Verify detector ignores standard placeholders and environment variable references."""
    safe_file = tmp_path / "safe_config.py"
    safe_file.write_text(
        """
        api_key = "your-api-key"
        openai_key = os.getenv("OPENAI_API_KEY")
        firebase_key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
        dummy_secret = "<API_KEY_HERE>"
        test_token = "placeholder_token_value_123456"
        """,
        encoding="utf-8",
    )
    findings = scan_file_for_secrets(safe_file)
    assert len(findings) == 0, f"Expected 0 findings on safe placeholders, got: {findings}"


def test_detector_respects_inline_allowlist_pragma(tmp_path):
    """Verify inline comments allow suppressing false positives when needed."""
    suppressed_file = tmp_path / "suppressed.py"
    suppressed_file.write_text(
        "API_KEY = 'AIza" + "SyD3uL8v7qW1xZ5r0tY2uI3oP4aS5dF6gH7' # pragma: allowlist secret\n",
        encoding="utf-8",
    )
    findings = scan_file_for_secrets(suppressed_file)
    assert len(findings) == 0, "Expected finding to be suppressed by pragma comment"


def test_redact_secret_masks_data():
    """Verify secrets are redacted without leaking full credentials in logs."""
    raw = "AKIAIOSFODNN7EXAMPLE"
    redacted = redact_secret(raw)
    assert redacted.startswith("AKIA")
    assert redacted.endswith("MPLE")
    assert "..." in redacted
    assert raw not in redacted


def test_scans_diverse_file_types(tmp_path):
    """Verify scanner inspects various code, config, and script file extensions."""
    for ext in [".py", ".ts", ".tsx", ".yaml", ".json", ".sh", ".md"]:
        f = tmp_path / f"sample{ext}"
        f.write_text("token = 'ghp_" + "1234567890abcdefghijklmnopqrstuvwxyz'\n", encoding="utf-8")
        findings = scan_file_for_secrets(f)
        assert len(findings) == 1, f"Expected 1 finding for {ext}, got {findings}"


if __name__ == "__main__":
    findings = []
    files = get_files_to_scan(ROOT_DIR)
    print(f"Scanning {len(files)} files for hardcoded API keys and secrets...")
    for f in files:
        findings.extend(scan_file_for_secrets(f))

    if findings:
        print(f"\n[ERROR] Found {len(findings)} potential hardcoded secrets:")
        for finding in findings:
            print(
                f"  - {finding.file_path}:{finding.line_number} "
                f"[{finding.rule_name}] -> {finding.redacted_value}"
            )
        sys.exit(1)
    else:
        print("[SUCCESS] No hardcoded API keys or secrets detected!")
        sys.exit(0)
