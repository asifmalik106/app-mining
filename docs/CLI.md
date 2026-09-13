# CLI

`npm run import:phase1` imports the existing CSV snapshots without changing them. `npm run phase2 -- --limit 10` runs isolated Phase 2. Supply `--run-id name` to name a test run and `--dry-run` to inspect a stage without calling a model.

Use `npm run test-pipeline -- --limit 10` for an isolated end-to-end run through Phases 2–6. Individual later phases accept the same run identity, for example `npm run phase3 -- --run-id test-10`. Dependencies are resolved within that run rather than against production state.

Supported providers are `ollama` and `llamacpp`; edit `config/models.json` or `.env`. `npm run models:status` is read-only. `npm run models:install` pulls only configured Ollama models through the Ollama HTTP API, so the Ollama CLI does not need to be on the same machine.

`npm run wizard` is intentionally non-destructive in non-interactive environments and points to the same commands. `npm run db:build` indexes JSONL; `db:rebuild` replaces only the rebuildable index.
