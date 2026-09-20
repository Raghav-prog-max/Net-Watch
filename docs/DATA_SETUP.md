# Getting the real data

The synthetic generator exists so nobody is blocked. Every number you report must
come from the real dataset.

## 1. Download

Official source: the Canadian Institute for Cybersecurity's CIC-IDS2017 page at
`https://www.unb.ca/cic/datasets/ids-2017.html`. It asks for a name and email, then
sends a download link. Two archives matter:

| Archive | Contents | Use it? |
|---|---|---|
| `GeneratedLabelledFlows.zip` | Labelled flows **with Timestamp, IPs and ports** | **Yes** |
| `MachineLearningCSV.zip` | The same flows with those columns stripped | Only if the above fails |

Take `GeneratedLabelledFlows.zip`. Our splitting groups flows into 5-minute blocks,
which needs the Timestamp column; the ML-CSV version does not have it, and the code
falls back to row order, which is weaker.

If the download is slow from campus, unofficial mirrors exist on Hugging Face and
Kaggle. Verify the row counts below before trusting any mirror.

## 2. Corrected labels (worth doing)

Engelen, Rimmer and Joosen (IEEE SPW 2021, *Troubleshooting an Intrusion Detection
Dataset: the CICIDS2017 Case Study*) found labelling and feature-extraction errors in
the original release, and published corrected data. Engelen and Joosen followed up in
2022 for CSE-CIC-IDS2018. Search for the paper's artefact repository, use the
corrected CSVs if you can get them, and cite the paper on the limitations slide.

If you use the original files, say so and list the known label issues under
limitations. Either choice is defensible. Silence is not.

## 3. Place and prepare

```bash
unzip GeneratedLabelledFlows.zip -d data/raw/
ls data/raw/          # 8 CSVs, Monday through Friday
make data
```

`ml/data/load.py` takes the day from the file name (`Friday-WorkingHours-...csv`
becomes `Friday`), which is what keeps one day's bursts inside one split.

## 4. Sanity check before training

Published flow counts, after the original release's own cleaning:

| Family | Approximate flows |
|---|---|
| Benign | 2,273,097 |
| DoS (Hulk, GoldenEye, slowloris, Slowhttptest) | 252,661 |
| PortScan | 158,930 |
| DDoS | 128,027 |
| BruteForce (FTP/SSH-Patator) | 13,835 |
| WebAttack (brute force, XSS, SQL injection) | 2,180 |
| Bot | 1,966 |
| Infiltration | 36 |
| Heartbleed | 11 |

`make data` prints its own counts. If yours differ by more than a few percent, you
have a different release or a partial download. Do not proceed.

## 5. Memory

The full set is roughly 2.8 million rows and about 80 features. On 8 GB of RAM:

- keep `benign_downsample: 0.20` in `ml/config.yaml` (training only; test stays whole),
- run `make quick` while iterating, and the full `make train` with LOFO once a day,
- if `make data` still runs out of memory, prepare day by day: move the other CSVs out
  of `data/raw/`, run `make data`, and concatenate the pickles in a scratch script.

## 6. Label encoding trap

The web-attack labels in some releases contain a `0x96` byte where an en dash should
be, which is why `ml/data/labels.py` lists both spellings and `load.py` reads with
`encoding="latin-1"`. If a family shows up as `Unknown` after `make data`, print the
unique raw labels and add the exact string to `LABEL_MAP`.
