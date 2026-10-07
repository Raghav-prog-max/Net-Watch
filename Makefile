# Use the project's .venv when it exists, on Windows and on macOS/Linux alike.
# ($(wildcard) is evaluated by make itself, so no shell-specific syntax.)
ifeq ($(OS),Windows_NT)
VENV_BIN := .venv/Scripts
PY_FALLBACK := python
else
VENV_BIN := .venv/bin
PY_FALLBACK := python3
endif
PYTHON  := $(if $(wildcard $(VENV_BIN)/python*),$(VENV_BIN)/python,$(PY_FALLBACK))
UVICORN := $(PYTHON) -m uvicorn
PIP     := $(PYTHON) -m pip

.PHONY: venv setup synthetic data train evaluate api demo seed retrain promote rollback test check-secrets quick holdout nslkdd clean

venv:           ## create the virtual environment
	$(PY_FALLBACK) -m venv .venv
	$(VENV_BIN)/python -m pip install --upgrade pip
	$(VENV_BIN)/python -m pip install -r requirements-dev.txt

setup:          ## install dependencies (with the test tools) into the active venv
	$(PIP) install -r requirements-dev.txt

synthetic:      ## generate fake traffic so the pipeline runs before the download finishes
	$(PYTHON) scripts/make_synthetic.py --rows 60000

data:           ## raw CSVs -> cleaned pickle
	$(PYTHON) -m ml.prepare --config ml/config.yaml

train:          ## train both models, pick thresholds, write reports/metrics.json
	$(PYTHON) -m ml.train --config ml/config.yaml

evaluate:       ## regenerate docs/model_card.md from reports/metrics.json (run after make train)
	$(PYTHON) -m ml.evaluate.model_card

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

promote:        ## serve a retrained bundle if it passes the check: make promote VERSION=v2
	$(PYTHON) scripts/promote.py $(VERSION)

rollback:       ## serve v1 again (or VERSION=...); restart the API after either
	$(PYTHON) scripts/promote.py $(or $(VERSION),v1) --rollback

nslkdd:         ## NSL-KDD sanity check of the metrics code (needs data/raw/nsl-kdd/)
	$(PYTHON) scripts/nslkdd_check.py

test:           ## run the full test suite
# pytest, not `python tests/x.py`: most test files have no __main__, so running
# them as scripts executed none of their tests and still exited 0
	$(PYTHON) -m pytest -q

check-secrets:  ## check for hardcoded API keys and secrets
	$(PYTHON) -m pytest tests/test_api_keys.py -v

clean:
	rm -rf data/processed/* models/v1/* reports/* data/alerts.db
