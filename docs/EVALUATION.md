# Evaluation

## Purpose

OpsMind AI uses a deterministic golden set to catch regressions in the parts of
the workflow that must remain stable even when the language model changes:

- retrieval reaches the expected operational document;
- analysis contains the expected causal concept;
- every hypothesis cites retrieved evidence;
- medium- and high-risk actions require approval.

## Run

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m app.evaluation
```

The command exits non-zero when the pass rate is below 80 percent. CI runs the
same suite through `pytest`.

## Dataset

`apps/api/app/eval/golden_cases.json` contains five scenarios covering:

1. checkout deployment regression;
2. payment provider timeout;
3. search replication lag;
4. checkout database pool pressure;
5. rollback governance.

Each case specifies the expected knowledge document, an expected causal term,
incident signals, service, and severity.

## Metrics

| Metric | Meaning |
| --- | --- |
| Retrieval hit rate | expected document appears in retrieved evidence |
| Citation coverage | every hypothesis references known retrieved evidence |
| Action policy pass rate | no medium/high action bypasses approval |
| Case pass rate | all checks pass for the scenario |

The deterministic demo analyzer makes the suite reproducible in CI. When an
OpenAI-compatible provider is configured, a separate online evaluation run
should record model name, prompt version, latency, cost, and human acceptance.

## Next Evaluation Layers

- retrieval recall@k and mean reciprocal rank on a larger labeled corpus;
- claim-level groundedness and citation precision;
- action-plan safety classification with red-team examples;
- human responder acceptance and correction rates;
- p50/p95 latency and token cost by incident size;
- tenant-isolation and access-control regression tests.
