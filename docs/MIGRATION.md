# Migration between computers

Move the repository and the `data/` directory together. CSV exports remain source backups. JSONL carries resumable processing history; rebuild SQLite with `npm run db:rebuild` after a move. Copy `.env` securely if its endpoints differ.
