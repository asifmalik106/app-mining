# Architecture

JSONL is the canonical, inspectable audit trail. `data/phase1/*.jsonl` preserves imported marketplace rows; Phase 2 writes one record per review per stage. SQLite at `data/app-opportunity-miner.sqlite` is a rebuildable query index only.

The Node CLI separates commands, state/artifact utilities, research phases, and LLM providers. Providers normalize Ollama `/api/generate`, Ollama `/api/embed`, and llama.cpp OpenAI-compatible `/v1/chat/completions` responses. Models live in `config/models.json` and may be overridden in `.env`.

Phase 3 uses local `nomic-embed-text` semantic vectors and deterministic incremental cosine clustering. Phase 4 applies documented evidence weights. Phase 5 uses the configured adjudicator as a skeptical Business Critic. Phase 6 deterministically combines evidence scores and critic verdicts into JSON and Markdown reports.

Each test run has `data/runs/<run-id>/manifest.json` and isolated artifacts. Production remains `data/phase2/`.
