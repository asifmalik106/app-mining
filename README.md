# App Opportunity Miner

A transparent, local-first research machine for turning Atlassian Marketplace evidence into ranked commercial app opportunities. It researches opportunities; it does not build apps.

## Quick start

```bash
npm install
npm run bootstrap
npm run import:phase1     # converts preserved CSV exports to visible JSONL once
npm run doctor
npm run status
npm run test-pipeline -- --limit 10
```

The 10-review run is isolated at `data/runs/test-10/`; it executes Phases 2–6 and never marks production complete. A production Phase 2 run without `--limit` is deliberately protected and requires `--confirm-full`.

## Operating the machine

- `npm run status` — derives visible progress from artifacts.
- `npm run phase2:primary -- --limit 10` — Qwen extraction.
- `npm run phase2:verify -- --limit 10` — selective Gemma verification.
- `npm run phase2:finalize -- --limit 10` — deterministic merge.
- `npm run phase2:adjudicate -- --limit 10` — only unresolved records.
- `npm run failures` — inspect recorded failures.
- `npm run db:rebuild` — rebuild the disposable SQLite index from JSONL.
- `npm run phase3 -- --run-id test-10` — semantic problem clustering.
- `npm run phase4 -- --run-id test-10` — inspectable commercial scoring.
- `npm run phase5 -- --run-id test-10` — local-LLM Business Critic.
- `npm run phase6 -- --run-id test-10` — final ranked report.

Phase dependencies are enforced: Phase 3 requires Phase 2, and so on. Interruptions are safe: success records are appended to JSONL and skipped on the next run. Original CSV exports are never modified.

See [CLI reference](docs/CLI.md), [architecture](docs/ARCHITECTURE.md), and [recovery](docs/RECOVERY.md).
