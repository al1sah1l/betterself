import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "../../src/concepts.ts";
import { ReviewProof } from "../../src/compositions/verification.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
});

afterAll(async () => {
  await testDb.close();
});

function assembleTestApplication() {
  const instances = applicationConceptSet.implementations("mongo", {
    db: testDb.db,
  });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,
    composition: {
      BetterSelf: {
        verification: {
          ReviewProof,
        },
      },
    },
  });
}

async function createSession(
  app: ReturnType<typeof assembleTestApplication>,
  subject: string,
) {
  const started =
    await app.concepts.Sessioning.start({
      subject,
    });

  if (
    typeof started !== "object" ||
    started === null ||
    !("session" in started) ||
    typeof started.session !== "string"
  ) {
    throw new Error("Could not create session.");
  }

  return started.session;
}

async function createGroup(
  app: ReturnType<typeof assembleTestApplication>,
) {
  const created =
    await app.concepts.AccountabilityGrouping.createGroup({
      owner: "maya",
      name: "Career Accountability",
      topic: "career",
    });

  if (
    typeof created !== "object" ||
    created === null ||
    !("group" in created) ||
    typeof created.group !== "string"
  ) {
    throw new Error("Could not create group.");
  }

  return created.group;
}

async function createProof(
  app: ReturnType<typeof assembleTestApplication>,
) {
  const submitted =
    await app.concepts.ProofVerifying.submitProof({
      submitter: "maya",
      goal: "goal-1",
      commitment: "commitment-1",
      occurrence: new Date("2026-10-12T17:00:00Z"),
      evidence: ["Screenshot showing completed work"],
    });

  if (
    typeof submitted !== "object" ||
    submitted === null ||
    !("proof" in submitted) ||
    typeof submitted.proof !== "string"
  ) {
    throw new Error("Could not submit proof.");
  }

  return submitted.proof;
}

test("authenticated group member can review proof", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await app.concepts.AccountabilityGrouping.joinGroup({
    group,
    user: "alex",
  });

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const proof = await createProof(app);
  const session = await createSession(app, "alex");

  await app.invoker.invoke("/proofs/review", {
    session,
    proof,
    decision: "verified",
    note: "Evidence supports the completion.",
  });

  await app.whenIdle();

  const reviews =
    await app.concepts.ProofVerifying._verificationsByProof({
      proof,
    });

  expect(reviews).toHaveLength(1);

  expect(reviews[0]).toMatchObject({
    reviewer: "alex",
    decision: "verified",
    note: "Evidence supports the completion.",
  });
});

test("authenticated non-member cannot review proof", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const proof = await createProof(app);
  const session = await createSession(app, "sam");

  await app.invoker.invoke(
    "/proofs/review",
    {
      session,
      proof,
      decision: "verified",
      note: "Trying to review without membership.",
    },
    {
      timeoutMs: 1000,
    },
  );

  await app.whenIdle();

  const reviews =
    await app.concepts.ProofVerifying._verificationsByProof({
      proof,
    });

  expect(reviews).toEqual([]);
});

test("client cannot spoof reviewer identity", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await app.concepts.AccountabilityGrouping.joinGroup({
    group,
    user: "alex",
  });

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const proof = await createProof(app);
  const session = await createSession(app, "alex");

  await app.invoker.invoke("/proofs/review", {
    session,
    proof,
    decision: "verified",
    note: "Reviewed using authenticated identity",

    // The endpoint does not receive this field.
    reviewer: "sam",
  });

  await app.whenIdle();

  const reviews =
    await app.concepts.ProofVerifying._verificationsByProof({
      proof,
    });

  expect(reviews).toHaveLength(1);

  expect(reviews[0]).toMatchObject({
    reviewer: "alex",
    decision: "verified",
  });
});

test("invalid session cannot create a verification", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await app.concepts.AccountabilityGrouping.joinGroup({
    group,
    user: "alex",
  });

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const proof = await createProof(app);

  await app.invoker.invoke(
    "/proofs/review",
    {
      session: "invalid-session",
      proof,
      decision: "verified",
      note: "Should not be recorded.",
    },
    {
      timeoutMs: 1000,
    },
  );

  await app.whenIdle();

  const reviews =
    await app.concepts.ProofVerifying._verificationsByProof({
      proof,
    });

  expect(reviews).toEqual([]);
});

test("missing proof does not create a verification", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "alex");

  await app.invoker.invoke("/proofs/review", {
    session,
    proof: "missing-proof",
    decision: "verified",
    note: "Should not be recorded.",
  });

  await app.whenIdle();

  const reviews =
    await app.concepts.ProofVerifying._verificationsByProof({
      proof: "missing-proof",
    });

  expect(reviews).toEqual([]);
});
