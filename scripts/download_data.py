"""
scripts/download_data.py
─────────────────────────
Kaggle dataset downloader for CICIDS2017.
Called automatically by ml/data/load.py if raw CSVs are not present.

Requirements
────────────
1. kaggle Python package  (`pip install kaggle`)
2. Kaggle API credentials in one of:
   - ~/.kaggle/kaggle.json
   - Environment variables KAGGLE_USERNAME and KAGGLE_KEY

Usage (direct)
──────────────
    python scripts/download_data.py

Or via Makefile:
    make data
"""
from __future__ import annotations

import os
import sys
import zipfile
from pathlib import Path
import yaml

# Allow running as  python scripts/download_data.py  from repo root
_REPO_ROOT = Path(__file__).resolve().parents[1]

with open(_REPO_ROOT / "ml" / "config.yaml", "r") as fh:
    cfg = yaml.safe_load(fh)

# ── Kaggle dataset slug ────────────────────────────────────────────────────────
KAGGLE_DATASET = cfg["kaggle"]["dataset"]
EXPECTED_FILES = list(cfg["kaggle"]["expected_files"])
RAW_DATA_DIR = _REPO_ROOT / cfg["paths"]["raw_data"]


def _credentials_present() -> bool:
    """Return True if Kaggle credentials are available."""
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    has_json = kaggle_json.exists()
    has_env  = bool(os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY"))
    return has_json or has_env


def _data_already_present() -> bool:
    """Return True if at least one expected file exists in RAW_DATA_DIR."""
    if not RAW_DATA_DIR.exists():
        return False
    for fname in EXPECTED_FILES:
        if (RAW_DATA_DIR / fname).exists():
            return True
    return False


def download() -> None:
    """Download CICIDS2017 from Kaggle if not already present."""
    if _data_already_present():
        print(f"[download_data] Raw data already present at {RAW_DATA_DIR} – skipping download.")
        return

    if not _credentials_present():
        print(
            "[download_data] ❌  Kaggle credentials not found.\n"
            "  Option 1: Place your kaggle.json at ~/.kaggle/kaggle.json\n"
            "  Option 2: Set env vars KAGGLE_USERNAME and KAGGLE_KEY\n"
            "  Get credentials at https://www.kaggle.com/settings → API → Create New Token"
        )
        sys.exit(1)

    # Import here so the module can be imported without kaggle installed
    try:
        import kaggle  # noqa: F401 – triggers auth
        from kaggle.api.kaggle_api_extended import KaggleApiExtended
    except ImportError:
        print("[download_data] ❌  kaggle package not installed. Run: pip install kaggle")
        sys.exit(1)

    api = KaggleApiExtended()
    api.authenticate()

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[download_data] Downloading dataset '{KAGGLE_DATASET}' → {RAW_DATA_DIR} …")
    print("  (This is ~1 GB; may take several minutes on a slow connection.)")

    api.dataset_download_files(
        KAGGLE_DATASET,
        path=str(RAW_DATA_DIR),
        unzip=False,
        quiet=False,
    )

    # Unzip any archives that were downloaded
    for zip_path in RAW_DATA_DIR.glob("*.zip"):
        print(f"[download_data] Extracting {zip_path.name} …")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(RAW_DATA_DIR)
        zip_path.unlink()  # remove archive after extraction

    # Flatten nested subdirectories (Kaggle sometimes wraps files)
    for subdir in [p for p in RAW_DATA_DIR.iterdir() if p.is_dir()]:
        for csv in subdir.glob("*.csv"):
            dest = RAW_DATA_DIR / csv.name
            if not dest.exists():
                csv.rename(dest)
                print(f"[download_data]   Moved {csv.name} → {RAW_DATA_DIR}")
        # Remove empty subdirs
        try:
            subdir.rmdir()
        except OSError:
            pass  # not empty – leave it

    print(f"[download_data] ✅  Download complete. Files in {RAW_DATA_DIR}:")
    for f in sorted(RAW_DATA_DIR.glob("*.csv")):
        size_mb = f.stat().st_size / 1_048_576
        print(f"    {f.name:60s}  {size_mb:6.1f} MB")


if __name__ == "__main__":
    download()
