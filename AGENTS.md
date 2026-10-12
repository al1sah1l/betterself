## Database

This project uses MongoDB, defined in `compose.yaml`. The connection string is in `.env`.

- `bun run db:up` starts MongoDB and waits until it accepts connections.
- `bun run db:check` checks that the app can connect.
- `bun run db:reset` deletes all local data and starts fresh. It is safe to run at any time.
- `bun run db:logs` shows MongoDB's output.
- Only use the local database. Never connect to a hosted one.