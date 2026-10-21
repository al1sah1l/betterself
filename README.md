# BetterSelf

BetterSelf is a goal-pursuit application that helps users turn broad goals into realistic strategies, follow through on concrete commitments, demonstrate their execution through peer accountability, and revise plans based on real-world results.

Its core loop is **goal → strategy → commitments → execution and proof → observed results → review → revision**. Completion claims, evidence, peer verification, and observed results are deliberately modeled separately.

## P1: Design (October 5, 2026)

The initial design established the core goal-pursuit loop, concept boundaries, and early sketches of Dashboard, Goals, Commitments, and Groups. See the [P1 design document](docs/design.md) for the original scope and sketches.

## P2: Alpha MVP (October 13, 2026)

### Core user journey

Starting with an empty database, Maya registers an account and creates a goal by describing her desired outcome, current context, constraints, timeline, and definition of success. She requests an AI strategy proposal, edits it, and explicitly saves the strategy she wants to use. She turns a strategy step into a commitment, adjusting its description, schedule, and recurrence before saving. Maya creates an accountability group, and Alex registers a separate account and joins using its group ID. Maya attaches her goal to the group and submits text or link evidence for a completed commitment occurrence. Reactions automatically record a completion claim and share the proof with the attached group. Alex reads the shared proof and verifies or disputes it. Completion claims and peer reviews remain separate, and the interface updates after these actions without a page refresh.

### Alpha scope and deferred work

The Alpha supports initial AI strategy proposals, user-confirmed commitments, accountability groups, proof submission, completion claims, and peer verification.

Evidence is currently text or links; file uploads are not implemented. Adaptive review and replanning, group chat, and the broader dashboard from the P1 sketches are deferred to P3 or later.

> **Historical milestone:** This section describes what was in scope for P2 Alpha. Features described as deferred here may now be implemented in the P3 Beta section below. The limitations near the end of this README describe the current application.


## P3: Beta — Complete Functionality

### Updated user journey

Starting with an empty database, Maya registers an account and creates a goal with its desired outcome, current context, constraints, timeline, and success definition. She requests an AI-generated strategy, edits the suggested steps, and explicitly approves the strategy before it is saved. She creates one-time or recurring commitments based on those steps, choosing a schedule and adjusting the wording as needed.

Maya creates an accountability group (public or private), and Alex joins it using the public group search or a shared private group ID. Maya attaches her goal to the group. She submits text or link evidence for a commitment occurrence. The application records a completion claim and automatically shares the proof with her accountability group. Alex reviews it and marks it verified or disputed. Maya can see her proof, its review status, and the review history on her goal page. A disputed proof can be resubmitted as a new attempt without losing the earlier review or creating another completion claim.

Maya separately records observed results—whether her actions are achieving her intended outcome. She can then request an AI progress review that considers her strategy, execution, and observed results. She reviews the proposed changes and explicitly accepts or edits the next strategy revision. The goal detail interface organizes this work into **Plan**, **Results**, and **Review** sections.

### Beta functionality

- Username/password authentication with persisted accounts and sessions, and application data in MongoDB.
- Goal creation, editing, and personal goal overview.
- AI-assisted initial strategy proposals that require user approval.
- Strategy steps linked to editable one-time or recurring commitments; commitment retirement preserves history.
- Text/link proof submission, automatic completion claims, and automatic proof sharing with the attached group.
- Public/private accountability groups, group discovery, join-by-ID, and owner-controlled group settings.
- Peer verification or dispute, with authorization and self-review restrictions.
- Pending proof deletion when no review exists; replacement proof for the same one-time occurrence.
- Disputed proof resubmission with preserved attempts and reviews.
- Separate observed-results tracking and AI-assisted strategy review/revision, with user approval.
- Updated UI with Plan / Results / Review tabs, clearer visual hierarchy, and clickable evidence URLs.

### Design decisions and boundaries

**Completion, evidence, peer verification, and observed results are distinct.** A user can execute a commitment without necessarily achieving their desired outcome. The app uses that distinction to support strategy review instead of treating a completion checkbox as success.

The Beta supports text and URL evidence, not uploaded files or images. Group chat, automated proof verification, automatic group matching, external integrations, and real-time cross-browser synchronization are outside the current scope.

## P3 submission materials

- [Updated user journey](#updated-user-journey) — documented above.
- [Saved automated test output](test-results/p3-tests.txt) — 205 passing tests, 0 failures in the final local run reported for P3.
- [Visual Design Study — Typography & Color](docs/BetterSelf_Visual_Design_Study_Beta_UI_Updated.pdf).
- **Narrated Beta demo (YouTube, up to 2 minutes):** https://drive.google.com/file/d/1B2yCBv189ynPdFAyojnRX8xBB8lIsn21/view?usp=sharing
- **Deployed Beta app:** https://betterself.mit-sdg.dev/
- [P1 design submission](docs/design.md).
- [Design notebook](https://github.com/al1sah1l/6.1040-fall26/blob/main/reflections/design-notebook.md) — maintained in the private individual repository; accessible to authorized course staff.

## Running locally

Requirements: Bun 1.4.2, Podman with Compose support, and MongoDB through the included Compose setup.

Install dependencies from the repository root:

```bash
bun install
```

Create `.env` in the repository root:

```dotenv
MONGODB_URL=mongodb://dev:dev@localhost:27017/betterself?authSource=admin
```

For real AI strategy proposals and progress reviews, configure a valid API key in `.env.local` (never commit either environment file):

```dotenv
OPENAI_API_KEY=your-api-key
# Optional: OPENAI_MODEL=your-supported-model
```

Start MongoDB:

```bash
bun run db:up
```

Start the backend in one terminal:

```bash
bun run start
```

Start the frontend development server in another terminal:

```bash
bun run dev:frontend
```

Open http://localhost:5173. Register two accounts to try peer verification. Usernames must contain 3–32 letters, numbers, underscores, or hyphens; passwords must contain 8–128 characters.

Application data is persisted in MongoDB. For changes to the frontend served directly by the backend on port 3000, run `bun run build:frontend` before refreshing that production-style page; `bun run start` does not rebuild Vue assets.

## Automated tests and validation

Start local MongoDB and run the complete Bun test suite:

```bash
bun run db:up
bun test
```

To save an updated test log:

```bash
mkdir -p test-results
set -o pipefail
bun test 2>&1 | tee test-results/p3-tests.txt
```

Check the concept specifications, generated artifacts, TypeScript, and frontend:

```bash
bun run generate
bun run check
bun run check:frontend
bun run build:frontend
```

Alternatively, run against a temporary in-memory MongoDB server:

```bash
bun run test:memory
```

Tests use their own isolated databases and must never target the deployed application database. The AI-related automated tests use injected test generators rather than paid API calls.

The latest local P3 validation reported **205 passing tests and no failures**. The sync-engine check also reported 37 non-blocking advisories (endpoint fallbacks and order-sensitive formers); a passing diagnostic does not guarantee every possible request path is covered.

## Production preview

Dependencies for both backend and Vue are installed from the root package; there is no separate frontend package.

Stop any existing backend on port 3000, then run:

```bash
bun run preview
```

This starts the local database, builds the frontend, and starts the backend in production mode.

- http://127.0.0.1:3000/health should return `{"status":"ok"}` when MongoDB is available.
- http://127.0.0.1:3000 should show BetterSelf.

The backend serves the built frontend and `/api` together. Sign in, create data, reload, and check that your records remain available.

## Deployment on 6.1040 Apps

Use the following settings:

| Setting | Value |
| --- | --- |
| Runtime | Bun |
| Package directories | `.` |
| Build script | `build` |
| Start script | `start` |
| Port | `3000` |
| Health check path | `/health` |

The Bun version in `packageManager` should match the version used locally.

Add MongoDB through the platform and name its supplied connection variable `MONGODB_URL`. The application selects the database from the connection string using `client.db()`; do not add `MONGODB_DB_NAME`.

Configure `OPENAI_API_KEY` and, if necessary, `OPENAI_MODEL`. The platform supplies `HOST`, `PORT`, and `NODE_ENV` automatically. The application supports username/password sign-in.

Commit and push tested changes, including `bun.lock` if it changed. Select the exact submitted commit on the platform and deploy explicitly. **Pushing to GitHub does not redeploy the app.** Verify the live UI and flows after deployment.

The deployed database is separate from the local MongoDB database.

## Known limitations

- Evidence can be text or links, not direct image/file uploads.
- Peer activity from another browser is not pushed live; reload controls retrieve the latest state.
- Some concurrency coordination uses process-local locks. Database uniqueness constraints protect important duplicate-write cases, but this is not a general distributed transaction design.
- Automatic proof verification, group chat, group recommendations, and external service integrations are not part of Beta.

## Design notebook

Design decisions, tradeoffs, implementation problems, and manual validation notes are recorded in the [private individual design notebook](https://github.com/al1sah1l/6.1040-fall26/blob/main/reflections/design-notebook.md) (available to authorized course staff).

