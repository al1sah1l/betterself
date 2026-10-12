import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "../../src/concepts.ts";
import { RecordCompletionFromProof } from "../../src/compositions/completion.ts";
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
        completion: {
          RecordCompletionFromProof,
        },
      },
    },
  });
}

async function createCommitment(
  app: ReturnType<typeof assembleTestApplication>,
  {
    recurring = false,
    description = "Send five networking emails",
    schedule = "once",
  }: {
    recurring?: boolean;
    description?: string;
    schedule?: string;
  } = {},
) {
  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal: "goal-1",
      description,
      recurring,
      schedule,
    });

  if (
    typeof created !== "object" ||
    created === null ||
    !("commitment" in created) ||
    typeof created.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  return created.commitment;
}

test("submitting proof automatically records completion", async () => {
  const app = assembleTestApplication();
  const commitment = await createCommitment(app);
  const occurrence = new Date("2026-10-12T17:00:00Z");

  await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence,
    evidence: ["Screenshot showing completed outreach"],
  });

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(1);
  expect(completions[0]?.occurrence).toEqual(occurrence);
});

test("multiple evidence items still create exactly one completion", async () => {
  const app = assembleTestApplication();
  const commitment = await createCommitment(app);
  const occurrence = new Date("2026-10-12T17:00:00Z");

  await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence,
    evidence: [
      "Screenshot of email 1",
      "Screenshot of email 2",
      "Screenshot of email 3",
      "Screenshot of email 4",
      "Screenshot of email 5",
    ],
  });

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(1);
  expect(completions[0]?.occurrence).toEqual(occurrence);
});

test("proofs for different recurring occurrences create separate completions", async () => {
  const app = assembleTestApplication();

  const commitment = await createCommitment(app, {
    recurring: true,
    description: "Send five networking emails each week",
    schedule: "weekly",
  });

  const firstOccurrence =
    new Date("2026-10-12T17:00:00Z");

  const secondOccurrence =
    new Date("2026-10-19T17:00:00Z");

  await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence: firstOccurrence,
    evidence: ["Week 1 outreach screenshots"],
  });

  await app.whenIdle();

  await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence: secondOccurrence,
    evidence: ["Week 2 outreach screenshots"],
  });

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(2);

  expect(
    completions.map((completion) => completion.occurrence),
  ).toEqual([
    firstOccurrence,
    secondOccurrence,
  ]);
});

test("rejected proof submission does not record completion", async () => {
  const app = assembleTestApplication();
  const commitment = await createCommitment(app);
  const occurrence = new Date("2026-10-12T17:00:00Z");

  const result = await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence,
    evidence: [],
  });

  expect(result).toMatchObject({
    error: "EVIDENCE_REQUIRED",
  });

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toEqual([]);
});

test("duplicate proof submission does not create a second completion", async () => {
  const app = assembleTestApplication();
  const commitment = await createCommitment(app);
  const occurrence = new Date("2026-10-12T17:00:00Z");

  await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence,
    evidence: ["First proof"],
  });

  await app.whenIdle();

  const result = await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment,
    occurrence,
    evidence: ["Second proof"],
  });

  expect(result).toMatchObject({
    error: "PROOF_ALREADY_SUBMITTED",
  });

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(1);
});
