.PHONY: setup synthetic data train evaluate api demo test clean

setup:          ## install dependencies
	pip install -r requirements.txt

synthetic:      ## generate fake traffic so the pipeline runs before the download finishes
	python scripts/make_synthetic.py --rows 60000

data:           ## raw CSVs -> cleaned pickle
	python -m ml.prepare --config ml/config.yaml

train:          ## train both models, pick thresholds, write reports/metrics.json
	python -m ml.train --config ml/config.yaml

quick:          ## train without the leave-one-family-out experiments
	python -m ml.train --config ml/config.yaml --skip-lofo

api:            ## run the scoring service
	uvicorn api.main:app --reload --port 8000

demo:           ## replay traffic at a running API
	python replay/replayer.py --scenario known --rate 60

dashboard:      ## run the SOC UI (expects the API on :8000)
	cd dashboard && npm install && npm run dev

holdout:        ## demo model trained without one family, for the novel-attack moment
	python -m ml.train --holdout WebAttack

test:           ## run the test suite (no pytest needed; each file runs standalone)
	python tests/test_split_leakage.py
	python tests/test_novelty.py

clean:
	rm -rf data/processed/* models/v1/* reports/* data/alerts.db
