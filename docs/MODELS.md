# Models

Defaults are Qwen 3.5 4B for primary extraction, Gemma 3 4B for selective verification, and Qwen 3.5 9B for selective adjudication. They are defaults, not hardcoded assumptions. Configure provider, model, and endpoint in `config/models.json` or `.env`.

Phase 3 defaults to `nomic-embed-text` through Ollama for local semantic embeddings. `npm run models:install` installs all configured Ollama models through the HTTP API.
