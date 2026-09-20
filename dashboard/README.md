# NetWatch dashboard

```bash
npm install
npm run dev     # http://localhost:3000, expects the API on :8000
```

Set `NEXT_PUBLIC_API_URL` if the API runs elsewhere.

| Route | What it shows |
|---|---|
| `/` | live alert feed over WebSocket, severity and novel-only filters |
| `/alerts/[id]` | why the flow fired, ATT&CK mapping, triage buttons |
| `/evaluation` | per-class metrics, LOFO table, confusion matrix, threshold |
| `/drift` | PSI history, top drifting features, retraining recommendation |
| `/models` | active version, thresholds, analyst feedback counts |

`lib/types.ts` mirrors `api/schemas.py`. If one changes, change both in the same pull
request, or the UI will render undefined fields.

The triage buttons call `PATCH /alerts/{id}`. They record an analyst decision. They do
not touch any network device.
