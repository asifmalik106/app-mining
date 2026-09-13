# Phases

1. Marketplace data collection
2. Review intelligence / structured evidence extraction
3. Recurring problem clustering
4. Commercial opportunity analysis and scoring
5. Business Critic
6. Final Opportunity Report

All phases are operational. Test runs preserve isolated manifests under `data/runs/<run-id>/phaseN/`; production phases remain dependency-blocked until their production predecessor is complete.

Phase 3 embeds grounded findings locally and groups them by cosine similarity. Phase 4 records component metrics, weights, unknowns, and supporting evidence for every score. Phase 5 stores the critic model, prompt version, verdict, risks, missing evidence, and confidence. Phase 6 produces both machine-readable report data and a human-readable Markdown report, including rejected candidates for auditability.
