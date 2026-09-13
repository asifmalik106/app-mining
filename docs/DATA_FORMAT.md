# Data format and provenance

Every JSONL line is independently valid JSON. Phase 2 entries carry `review_id`, `app_id`, stage, provider/model, versions, timestamps, latency, status, and either a result or an error. Finalization records its source (`primary` or `verification`) and whether adjudication is needed. Findings require a short evidence span; unsupported information remains null.

Phase 3 stores one semantic vector per finding plus traceable cluster membership. Phase 4 opportunities retain cluster IDs, review/app evidence, component scores, weights, and explicit unknowns. Phase 5 results retain opportunity and cluster IDs with model provenance. Phase 6 JSON retains ranked and rejected opportunities so every conclusion can be traced back to marketplace evidence.
