# Notebooks (exploration only — not part of the scored pipeline)

| Notebook | What it shows |
|---|---|
| `eda.ipynb` | Handbook task t5: class counts, feature distributions, correlated features, and whether flows inside one 5-minute block are near-duplicates (the reason the pipeline splits by time). |

Nothing reported in the deck or model card comes from a notebook: reported numbers are
produced by `make train` / `make evaluate`. The notebook recomputes everything from
`data/processed/` when run, so after processing new data run it again:

```
pip install -r requirements-dev.txt
make eda
```

The committed outputs are from **synthetic** data (`scripts/make_synthetic.py`) until the
CICIDS2017 files are processed.
