"""Raw CSVs -> one cleaned, pickled DataFrame.

    python -m ml.prepare --config ml/config.yaml
"""
import argparse
from pathlib import Path

import yaml

from ml.data.clean import clean
from ml.data.load import load_raw


def main(config_path):
    cfg = yaml.safe_load(open(config_path))
    df = load_raw(cfg["paths"]["raw_dir"])
    print(f"loaded {len(df):,} rows")
    df = clean(df)
    print(f"after cleaning {len(df):,} rows, {df.shape[1]} columns")
    print(df["family"].value_counts().to_string())
    out = Path(cfg["paths"]["processed"]); out.parent.mkdir(parents=True, exist_ok=True)
    df.to_pickle(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="ml/config.yaml")
    main(ap.parse_args().config)
