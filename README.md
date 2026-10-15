# BetterSelf

BetterSelf is a goal-pursuit application that helps users turn broad goals into realistic strategies, follow through on concrete commitments, and adapt their plans based on execution and real-world results.

## P2: Alpha MVP

### Core user journey

Starting with an empty database, Maya registers an account and creates a goal by describing her desired outcome, current context, constraints, timeline, and definition of success. She requests an AI strategy proposal, edits it, and explicitly saves the strategy she wants to use. She turns a strategy step into a commitment, adjusting its description, schedule, and recurrence before saving. Maya creates an accountability group, and Alex registers a separate account and joins using its group ID. Maya attaches her goal to the group and submits text or link evidence for a completed commitment occurrence. Reactions automatically record a completion claim and share the proof with the attached group. Alex reads the shared proof and verifies or disputes it. Completion claims and peer reviews remain separate, and the interface updates after these actions without a page refresh.

### Alpha scope

The Alpha supports initial AI strategy proposals, user-confirmed commitments, accountability groups, proof submission, completion claims, and peer verification. Evidence is currently text or links; file uploads are not implemented. Adaptive review and replanning, group chat, and the broader dashboard from the P1 sketches are deferred to P3 or later.

### Running locally

Requirements: Bun, Podman with Compose support, and a local MongoDB instance.

Install dependencies:

```bash
bun install
```

Create `.env` in the repository root:

```dotenv
MONGODB_URL=mongodb://dev:dev@localhost:27017/betterself?authSource=admin
```

For real AI strategy proposals, create `.env.local`:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-6-luna
```

Start MongoDB:

```bash
bun run db:up
```

Start the backend in one terminal:

```bash
bun run start
```

Start the frontend in another terminal:

```bash
bun run dev:frontend
```

Open http://localhost:5173. The API runs at http://localhost:3000.

Register two accounts to try peer verification. Usernames must contain 3–32 letters, numbers, underscores, or hyphens. Passwords must contain 8–128 characters.

Sessions are stored in memory. Sign in again after restarting the backend. Application data is persisted in MongoDB.

### Validation

```bash
bun test
bunx tsc --noEmit
bun run generate
bun run check
bun run check:frontend
bun run build:frontend
```

AI tests use a placeholder generator and do not make paid API requests.

### Known limitations

- Attach a goal to its accountability group before submitting proof. Earlier proofs are not automatically shared when a group is attached later.
- Only proofs without peer reviews can be deleted by their submitter. The completion claim is preserved, and evidence can be submitted again for the same occurrence.
- Corrected evidence after a dispute is deferred to P3. Reviewed proofs and their reviews remain stored.
- Peer activity in another browser is retrieved using the reload controls. Live cross-user updates are not implemented.
- Concurrent review and deletion are coordinated within one backend process. Multiple backend processes would require database-level coordination.

## P1: Design

[View the complete design submission](design.md)

## Design Notebook

My design notebook and personal reflections are kept in my private individual repository:

[Design Notebook](https://github.com/al1sah1l/6.1040-fall26/blob/main/reflections/design-notebook.md)
