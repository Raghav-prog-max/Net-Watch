"""Read the raw CSVs into one DataFrame."""
from pathlib import Path
import pandas as pd

from ml.data.labels import to_family


def load_raw(raw_dir: str) -> pd.DataFrame:
    files = sorted(Path(raw_dir).glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No CSVs in {raw_dir}. See README for the download step.")
    frames = []
    for f in files:
        df = pd.read_csv(f, encoding="latin-1", low_memory=False)
        df.columns = [c.strip() for c in df.columns]
        df["day"] = f.stem.split("-")[0]          # e.g. "Friday" from the file name
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df["family"] = df["Label"].map(to_family)
    return df


def load_processed(path: str) -> pd.DataFrame:
    return pd.read_pickle(path)
