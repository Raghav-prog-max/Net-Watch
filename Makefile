PYTHON := $(shell if exist .venv\Scripts\python.exe (echo .venv\Scripts\python.exe) else (echo python))
UVICORN := $(shell if exist .venv\Scripts\uvicorn.exe (echo .venv\Scripts\uvicorn.exe) else (echo uvicorn))
PIP := $(shell if exist .venv\Scripts\pip.exe (echo .venv\Scripts\pip.exe) else (echo pip))

.PHONY: venv setup synthetic data train evaluate card dashboard-snapshot api demo seed retrain test quick holdout clean

venv:           ## create the virtual environment
	python -m venv .venv
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

setup:          ## install dependencies into the active venv
	$(PIP) install -r requirements.txt

synthetic:      ## generate fake traffic so the pipeline runs before the download finishes
	$(PYTHON) scripts/make_synthetic.py --rows 60000

data:           ## raw CSVs -> cleaned pickle
	$(PYTHON) -m ml.prepare --config ml/config.yaml

train:          ## train both models, pick thresholds, write reports/metrics.json
	$(PYTHON) -m ml.train --config ml/config.yaml

card:           ## regenerate docs/model_card.md from reports/metrics.json
	$(PYTHON) -m ml.evaluate.model_card

evaluate:       ## regenerate model card + evaluation report (run after make train)
	$(PYTHON) -m ml.evaluate.model_card
	$(PYTHON) -m ml.evaluate.report

dashboard-snapshot: ## copy reports/metrics.json into the dashboard offline fallback
	$(PYTHON) scripts/dashboard_snapshot.py

quick:          ## train without leave-one-family-out experiments
	$(PYTHON) -m ml.train --config ml/config.yaml --skip-lofo

api:            ## run the scoring service
	$(UVICORN) api.main:app --reload --port 8000

demo:           ## replay traffic at a running API
	$(PYTHON) replay/replayer.py --scenario known --rate 60

dashboard:      ## run the SOC UI (expects the API on :8000)
	cd dashboard && npm install && npm run dev

holdout:        ## demo model trained without one family, for the novel-attack moment
	$(PYTHON) -m ml.train --holdout WebAttack

seed:           ## seed the alert database for offline demo (run after make train)
	$(PYTHON) scripts/seed_db.py --count 80 --scenario known

retrain:        ## retrain v2 with analyst feedback labels
	$(PYTHON) scripts/retrain.py --out models/v2

test:           ## run the full test suite
	$(PYTHON) tests/test_split_leakage.py
	$(PYTHON) tests/test_novelty.py
	$(PYTHON) tests/test_anomaly.py
	$(PYTHON) tests/test_drift.py
	$(PYTHON) tests/test_classifier.py
	$(PYTHON) tests/test_combine.py
	$(PYTHON) tests/test_explain.py
	$(PYTHON) tests/test_mitre.py
	$(PYTHON) tests/test_naive_split.py
	$(PYTHON) tests/test_schema.py
	$(PYTHON) tests/test_scorer.py
	$(PYTHON) tests/test_thresholds.py
	$(PYTHON) tests/test_api.py

clean:
	rm -rf data/processed/* models/v1/* reports/* data/alerts.db
