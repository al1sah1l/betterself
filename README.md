# BetterSelf

**BetterSelf** is a goal-pursuit application that helps people turn ambitious goals into actionable strategies, follow through on concrete commitments, demonstrate their execution through evidence and peer accountability, and adapt their plans based on observed results.

**Live application:** https://betterself.mit-sdg.dev/

**Course:** MIT 6.1040 Software Design, Fall 2026

## Overview

People often know what they want to achieve but struggle to translate their goals into realistic plans and consistent action. Even when they complete planned activities, they may not know whether those activities are bringing them closer to their desired outcomes.

BetterSelf addresses this problem through a structured, evidence-based goal-pursuit process:

**Goal → Strategy → Commitments → Execution and Proof → Observed Results → Review → Revision**

The application deliberately separates four concepts:

- **Commitment completion:** The user claims to have performed a planned action.
- **Evidence:** The user provides supporting proof of that action.
- **Peer verification:** Another user evaluates whether the evidence supports the claim.
- **Observed results:** The user records whether their actions have produced meaningful progress toward the desired outcome.

This separation allows BetterSelf to support accountability without assuming that completing tasks automatically means achieving a goal.

---

## P1: Design (October 5, 2026)

The initial design established the goal-pursuit loop, core concepts, and early interface sketches.

The design focused on:

- Translating desired outcomes into strategies.
- Converting strategies into concrete commitments.
- Supporting accountability through evidence and peer review.
- Separating execution from real-world outcomes.
- Allowing users to revise strategies based on what they learn.

The initial sketches covered Dashboard, Goals, Commitments, and Groups.

See the [P1 design document](docs/design.md).

---

## P2: Alpha MVP (October 13, 2026)

The Alpha implemented the first complete accountability journey.

Starting with an empty database, Maya could register, create a goal, request an AI-generated strategy, edit and accept it, create a commitment, and join an accountability group.

After completing a commitment, Maya could submit evidence. The application automatically recorded a completion claim and shared the proof with her attached group. Another member, Alex, could review the submitted evidence and verify or dispute it.

The Alpha established the core domain concepts and their interactions.

At this stage, proof evidence was limited to text and links. More advanced review, image evidence, and the broader dashboard were implemented in later milestones.

---

## P3: Beta — Complete Functionality

The Beta expanded the Alpha into a more complete goal-management application.

### Expanded user journey

Maya creates a goal by specifying her desired outcome, current situation, constraints, timeline, and definition of success.

She requests an AI-generated strategy, edits the suggested steps, and explicitly accepts the strategy.

She converts strategy steps into one-time or recurring commitments. Commitments can have their own schedules and can later be retired without losing their completion and proof history.

Maya creates a public or private accountability group. Alex joins through public group discovery or a private group ID.

When Maya submits proof, BetterSelf records the relevant completion claim and shares the proof with her attached group. Alex can verify or dispute the evidence.

If a proof is disputed, Maya can resubmit new evidence while preserving earlier attempts and review history.

Maya also records observed results separately from completed commitments. She can request an AI-assisted progress review, evaluate suggested improvements, and explicitly accept or edit a strategy revision.

### Beta functionality

- Persistent accounts and authenticated sessions.
- Goal creation, editing, and personal goal management.
- AI-generated strategy proposals requiring user approval.
- Editable one-time and recurring commitments.
- Commitment retirement with preserved history.
- Proof submission and automatic completion claims.
- Public and private accountability groups.
- Group discovery, joining, and owner-controlled settings.
- Automatic proof sharing with attached groups.
- Peer verification and dispute.
- Proof resubmission with preserved attempt history.
- Deletion of unreviewed pending proofs.
- Separate observed-results tracking.
- AI-assisted progress review and strategy revision.
- Plan, Results, and Review sections in the goal interface.

### P3 submission materials

- [P1 design document](docs/design.md)
- [P3 test results](test-results/p3-tests.txt) — 205 passing tests in the recorded P3 validation.
- [Visual Design Study — Typography & Color](docs/BetterSelf_Visual_Design_Study_Beta_UI_Updated.pdf)
- [Beta demonstration video](https://drive.google.com/file/d/1B2yCBv189ynPdFAyojnRX8xBB8lIsn21/view?usp=sharing)
- [Deployed application](https://betterself.mit-sdg.dev/)
- [Design notebook](https://github.com/al1sah1l/6.1040-fall26/blob/main/reflections/design-notebook.md)

The design notebook is maintained in the private course repository and is available to authorized course staff.

---

## P4: Code Complete (October 26, 2026)

P4 focuses on making BetterSelf more complete, usable, and reliable.

The application now includes an improved goal workspace, goal prioritization, image evidence, progress visualization, resource-management operations, and a redesigned interface.

### 1. Goal creation and planning

Users create goals using five fields:

1. Desired outcome
2. Current context
3. Constraints
4. Timeline
5. Success definition

The goal-creation interface provides a structured form with clear sections and validation.

After creating a goal, users can request an AI-generated strategy. They may edit or accept the proposal before it becomes their saved strategy.

Strategy steps can be converted into commitments, but users may also create commitments independently.

### 2. Goal Workspace

Each goal has a dedicated workspace organized into three sections:

**Plan**

- View the goal context and current strategy.
- Create commitments from strategy steps.
- Add custom commitments.
- View active and retired commitments.
- Submit proofs and inspect peer reviews.
- Attach the goal to an accountability group.

**Results**

- Record observed changes in the real world.
- Track whether actions are producing progress toward the desired outcome.

**Review**

- Request an AI-assisted evaluation of progress.
- Review suggested changes to the strategy.
- Accept or edit a revised strategy.

The workspace also includes:

- A prominent goal title and target timeline.
- Quick actions for submitting proof and recording results.
- Progress summaries.
- A shortcut to Goal Settings through the `...` button on the goal description card.

Goal Settings contains goal editing, commitment management, and goal deletion.

### 3. Priority Goals

Users can choose one goal as their current priority.

The selected priority:

- Is saved to MongoDB.
- Appears prominently in the Dashboard.
- Is displayed first in the goals list.
- Influences the ordering of commitments shown on the Dashboard.
- Can be changed or cleared by the user.

Prioritization is user-controlled rather than determined automatically by AI.

### 4. Commitments and progress

BetterSelf supports one-time and recurring commitments.

Users can:

- Create commitments from strategy steps.
- Customize commitment descriptions and schedules.
- Submit evidence for completed occurrences.
- Review completion and proof history.
- Retire commitments while preserving historical records.

Progress views summarize commitments and recorded activity. Completion counts are kept distinct from observed outcomes.

### 5. Proof submission and image attachments

Users can provide text, URLs, and uploaded images as evidence.

Supported image formats:

- PNG
- JPEG
- WebP
- GIF

The application supports up to six uploaded images per proof, with a maximum size of 5 MB per image.

Uploaded images are stored in MongoDB GridFS rather than an external file-storage service.

The backend validates image formats and enforces ownership checks before an image can be submitted as evidence.

Image viewing is authenticated. Authors can view their uploads, and eligible group members can view images referenced by proofs shared with their groups.

### 6. Peer accountability

BetterSelf supports public and private accountability groups.

Users can:

- Create groups.
- Discover public groups.
- Join groups through the supported discovery or ID flows.
- Attach goals to groups.
- View shared proofs.
- Verify or dispute another member's proof.
- Resubmit disputed evidence.
- Leave groups when permitted.

Group owners have additional controls for group management.

The application prevents users from reviewing their own proofs.

### 7. Resource management

Users can edit goals, retire commitments, delete goals, and leave accountability groups.

**Goal deletion** removes associated commitments, completion records, proofs, reviews, group references, and observed results. It also clears the user's priority selection if the deleted goal was their priority.

Image cleanup is handled separately through persistent MongoDB cleanup jobs. Pending jobs can be retried after server restart.

**Leaving a group** removes the user's membership and relevant group-specific references while preserving their personal goals, commitments, and proof history.

The production deployment uses standalone MongoDB, so these multi-document cleanup operations are performed sequentially rather than as MongoDB transactions.

### 8. Updated visual design

The P4 interface uses a consistent purple visual identity, with improved hierarchy and navigation.

Notable changes include:

- A redesigned Dashboard with progress summaries.
- Priority goal highlighting.
- More structured goal creation.
- Goal Workspace navigation.
- Improved strategy and commitment cards.
- Clear proof status indicators.
- Dedicated interfaces for Results and Review.
- Goal Settings accessible through an overflow button.
- Confirmation before destructive operations.

Proof statuses remain visually differentiated, with Verified using the application's purple color palette.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3, TypeScript, Vite |
| Backend | Bun, TypeScript |
| Application architecture | MIT Sync Engine |
| Database | MongoDB |
| Image storage | MongoDB GridFS |
| AI features | OpenAI API |
| Testing | Bun Test |
| Deployment | MIT 6.1040 Apps |

The backend and frontend are maintained in one repository.

The backend serves the application API and the compiled frontend in production.

### Application architecture

The system uses concept-oriented design through MIT Sync Engine.

Its main responsibilities include:

- Authentication and session management.
- Goal planning and strategy management.
- Commitment tracking and completion recording.
- Proof submission and verification.
- Accountability group membership and proof sharing.
- Observed-results tracking.
- AI-assisted strategy proposal and review.

Concepts are connected through application synchronization and reactions, including automatic completion recording and proof sharing.

Additional HTTP endpoints implement functionality such as image upload and access control, goal priority selection, and resource cleanup.

---

## Running Locally

### Requirements

- Bun 1.4.2
- Podman with Compose support
- MongoDB through the provided `compose.yaml`
- An OpenAI API key for AI-generated strategies and reviews

### 1. Install dependencies

From the repository root:

```bash
bun install
```

### 2. Configure environment variables

Create a `.env` file containing the MongoDB connection URL for your local database.

For the current local replica-set configuration:

```dotenv
MONGODB_URL=mongodb://127.0.0.1:27017/betterself?replicaSet=rs0&directConnection=true
```

The local Compose configuration starts `mongod` with replica-set mode enabled. A fresh MongoDB data volume may require one-time replica-set initialization.

**MongoDB transactions are not required by the current resource-management implementation.** The deployed application uses the standalone MongoDB service supplied by MIT Apps.

Configure AI credentials in `.env.local`:

```dotenv
OPENAI_API_KEY=your-api-key
# Optional:
# OPENAI_MODEL=your-supported-model
```

Do not commit local environment files or API keys.

### 3. Start MongoDB

```bash
bun run db:up
```

Check database connectivity:

```bash
bun run db:check
```

### 4. Start the backend

```bash
bun run start
```

The default backend port is 3000.

### 5. Start the frontend development server

In another terminal:

```bash
bun run dev:frontend
```

Open:

http://localhost:5173

For a complete accountability flow, register two different accounts so that one user can submit a proof and the other can review it.

Usernames must contain 3–32 letters, numbers, underscores, or hyphens. Passwords must contain 8–128 characters.

### Production-style local preview

To build and serve the frontend directly through Bun:

```bash
bun run preview
```

Open:

http://127.0.0.1:3000

The health endpoint is:

http://127.0.0.1:3000/health

It should return:

```json
{"status":"ok"}
```

when MongoDB is available.

---

## Testing and Validation

### Complete test suite

```bash
bun test
```

### Resource-management tests

```bash
bun test ./tests/http/resource-management.test.ts
```

### In-memory MongoDB tests

```bash
bun run test:memory
```

### TypeScript and architecture checks

```bash
bun run generate
bun run check
```

### Frontend validation

```bash
bun run check:frontend
bun run build:frontend
```

These commands validate the concept artifacts, TypeScript, Vue components, and production frontend build.

The P3 submission included a saved result of 205 passing tests. Additional tests were introduced during P4, particularly for image management, resource deletion, and concurrency-related behavior.

The complete local test suite and build were run successfully before the final P4 deployment.

Tests use isolated databases and should not be run against the deployed application's production database.

AI-related automated tests use injected test generators rather than requiring paid model calls.

### Manual end-to-end verification

The main user journey should cover:

1. Register and sign in.
2. Create a goal.
3. Generate and accept a strategy.
4. Create a commitment.
5. Select a priority goal.
6. Create or join an accountability group.
7. Attach a goal to the group.
8. Submit proof with text or an image.
9. Verify or dispute the proof using another account.
10. Inspect completion history and proof status.
11. Record observed results.
12. Request a strategy review and accept a revision.
13. Edit a goal through Goal Settings.
14. Test goal deletion and group leaving using disposable test data.

---

## Deployment on MIT Apps

**Live URL:** https://betterself.mit-sdg.dev/

The application is deployed through the MIT 6.1040 Apps platform.

### Deployment configuration

| Setting | Value |
| --- | --- |
| Runtime | Bun |
| Package directory | `.` |
| Build script | `build` |
| Start script | `start` |
| Port | `3000` |
| Health check | `/health` |

Configure the following environment variables:

- `MONGODB_URL` — provided by the MongoDB service on MIT Apps.
- `OPENAI_API_KEY` — required for live AI requests.
- `OPENAI_MODEL` — optional model configuration.

MIT Apps supplies runtime configuration such as `HOST`, `PORT`, and `NODE_ENV`.

The application reads its MongoDB database name from the connection URL.

### Deployment workflow

1. Run the local test suite and validation commands.
2. Commit the tested changes.
3. Push the commit to GitHub.
4. Select that commit for deployment in MIT Apps.
5. Deploy the application.
6. Verify that the build and application startup succeed.
7. Check the `/health` endpoint.
8. Test the deployed UI and representative user flows.

Pushing a commit to GitHub does not automatically redeploy the application. A new deployment must be initiated through the platform.

The deployed MongoDB database is separate from the local development database.

### Production MongoDB compatibility

The production MongoDB instance on MIT Apps reports standalone topology rather than replica-set membership.

Accordingly, goal deletion and group leaving use ordinary sequential MongoDB operations without multi-document transactions.

This avoids requiring changes to the managed MongoDB service.

---

## Design Decisions

### User approval of AI suggestions

AI-generated strategies and revisions are proposals, not automatically applied decisions.

Users can inspect and edit recommendations before saving them.

This keeps users in control of their plans.

### Execution is not the same as success

Completing commitments is useful evidence of execution, but it does not necessarily show that the desired outcome has been achieved.

Observed results are tracked separately to support meaningful progress evaluation.

### Proofs and verification are separate

Submitting evidence records what the user claims to have done.

A peer review provides an additional accountability signal.

The system preserves disputed attempts and their review history rather than rewriting the past.

### User-controlled prioritization

BetterSelf allows users to explicitly select their current priority goal.

The application does not automatically decide which personal goal deserves the most attention.

### Image storage in MongoDB

Image evidence is stored in MongoDB GridFS to keep the prototype's infrastructure relatively simple.

Authenticated access checks prevent arbitrary users from viewing uploaded evidence.

### Standalone MongoDB support

Because the production environment does not provide MongoDB transactions, resource deletion uses a sequential, retry-oriented approach.

This is a deliberate deployment tradeoff rather than an atomic multi-document deletion guarantee.

---

## Known Limitations

BetterSelf is a course prototype and has several limitations:

- **No atomic multi-document deletion in production.** Standalone MongoDB does not provide transaction-based rollback for the resource-management workflow. An interrupted deletion may leave partial cleanup work.
- **Process-local concurrency coordination.** Some backend operations use in-process goal locks, which do not coordinate across multiple application instances.
- **Limited restart recovery.** Persistent image-cleanup jobs are retried after startup, but arbitrary partially completed goal deletions are not automatically resumed by a general recovery worker.
- **Orphaned images.** Automatic periodic cleanup of unreferenced uploads is disabled to avoid races with in-progress proof submission. Goal-deletion cleanup remains supported.
- **Manual refresh for peer activity.** Changes made by another browser are not pushed to all connected users in real time. The UI provides reload and refresh controls.
- **AI assistance is optional.** Strategy proposals and progress reviews require a configured API key and a successful external model request.
- **No automated proof verification.** Other users evaluate evidence; the application does not independently establish that submitted evidence is genuine.
- **No group chat or automatic matching.** Users organize accountability through the supported group creation and joining flows.
- **No third-party integrations.** BetterSelf does not automatically import data from calendars, fitness trackers, or other goal-tracking services.

These limitations define the current implementation boundary and possible directions for future development.

---

## Future Work

Potential future extensions include:

- More reliable distributed coordination and resumable deletion workflows.
- Real-time group notifications.
- More flexible recurring commitment schedules.
- Additional progress analytics and visualizations.
- Improved image lifecycle management.
- Optional calendar and third-party integrations.
- User-customizable themes.
- More sophisticated AI-assisted strategy adaptation.

These are potential extensions, not claims about the current implementation.

---

## Project Documentation

- [P1 Design](docs/design.md)
- [P3 Visual Design Study](docs/BetterSelf_Visual_Design_Study_Beta_UI_Updated.pdf)
- [P3 Saved Test Results](test-results/p3-tests.txt)
- [P3 Beta Demo](https://drive.google.com/file/d/1B2yCBv189ynPdFAyojnRX8xBB8lIsn21/view?usp=sharing)
- [Live BetterSelf Application](https://betterself.mit-sdg.dev/)
- [Design Notebook](https://github.com/al1sah1l/6.1040-fall26/blob/main/reflections/design-notebook.md)

The design notebook is located in the private individual course repository and is available to authorized course staff.

---

**BetterSelf — Big goals. Small steps. Real progress.**
