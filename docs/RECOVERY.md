# Recovery

Stop with Ctrl-C. Complete JSONL lines persist and are skipped on restart. Failed records remain visible and do not overwrite successes. Inspect them with `npm run failures`; change the provider/configuration, then rerun the appropriate limited stage. Never hand-edit a JSONL line while a process is writing.

Each run identity has an atomic lock in `state/locks/`, preventing two terminals from processing the same run concurrently.
