import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "../../src/concepts.ts";
import * as proofResubmission from "../../src/compositions/proof-resubmission.ts";
import { RecordCompletionFromProof } from "../../src/compositions/completion.ts";
import { ShareProofWithGroup } from "../../src/compositions/proof-sharing.ts";
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
  return assemble({
    conceptSet: applicationConceptSet,
    instances: applicationConceptSet.implementations("mongo", {
      db: testDb.db,
    }),
    composition: {
      BetterSelf: {
        proofResubmission,
        completion: { RecordCompletionFromProof },
        proofSharing: { ShareProofWithGroup },
      },
    },
  });
}

async function fixture() {
  const app = assembleTestApplication();

  const ownerSession = await app.concepts.Sessioning.start({
    subject: "maya",
  });

  const otherSession = await app.concepts.Sessioning.start({
    subject: "alex",
  });

  const createdGoal = await app.concepts.GoalPlanning.createGoal({
    owner: "maya",
    outcome: "Read a book",
    currentContext: "Starting chapter one",
    constraints: "Twenty minutes per day",
    timeline: "This month",
    successDefinition: "Finish the book",
  });

  const createdGroup =
    await app.concepts.AccountabilityGrouping.createGroup({
      owner: "maya",
      name: "Reading Circle",
      topic: "Books",
    });

  if (
    typeof ownerSession !== "object" ||
    ownerSession === null ||
    !("session" in ownerSession) ||
    typeof ownerSession.session !== "string"
  ) {
    throw new Error("Could not create owner session.");
  }

  if (
    typeof otherSession !== "object" ||
    otherSession === null ||
    !("session" in otherSession) ||
    typeof otherSession.session !== "string"
  ) {
    throw new Error("Could not create reviewer session.");
  }

  if (
    typeof createdGoal !== "object" ||
    createdGoal === null ||
    !("goal" in createdGoal) ||
    typeof createdGoal.goal !== "string"
  ) {
    throw new Error("Could not create goal.");
  }

  if (
    typeof createdGroup !== "object" ||
    createdGroup === null ||
    !("group" in createdGroup) ||
    typeof createdGroup.group !== "string"
  ) {
    throw new Error("Could not create group.");
  }

  const goal = createdGoal.goal;
  const group = createdGroup.group;

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal,
  });

  const createdCommitment =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      description: "Read chapter one",
      recurring: false,
      schedule: "By Friday",
    });

  if (
    typeof createdCommitment !== "object" ||
    createdCommitment === null ||
    !("commitment" in createdCommitment) ||
    typeof createdCommitment.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  const commitment = createdCommitment.commitment;
  const occurrence = new Date("2026-10-12T17:00:00.000Z");

  const submitted = await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal,
    commitment,
    occurrence,
    evidence: ["Original evidence"],
  });

  if (
    typeof submitted !== "object" ||
    submitted === null ||
    !("proof" in submitted) ||
    typeof submitted.proof !== "string"
  ) {
    throw new Error("Could not submit proof.");
  }

  const proof = submitted.proof;

  await app.whenIdle();

  await app.concepts.ProofVerifying.reviewProof({
    reviewer: "alex",
    proof,
    decision: "disputed",
    note: "Please provide clearer evidence.",
  });

  return {
    app,
    goal,
    group,
    commitment,
    occurrence,
    proof,
    ownerSession: ownerSession.session,
    otherSession: otherSession.session,
  };
}

test("resubmission preserves context, shares the attempt, and keeps one completion", async () => {
  const f = await fixture();

  const before =
    await f.app.concepts.CommitmentTracking._completionsByCommitment({
      commitment: f.commitment,
    });

  expect(before).toHaveLength(1);

  const result = await f.app.invoker.invoke("/proofs/resubmit", {
    session: f.ownerSession,
    previousProof: f.proof,
    evidence: ["Clearer evidence"],

    // These must not override the original context.
    submitter: "alex",
    goal: "another-goal",
    commitment: "another-commitment",
    occurrence: new Date("2030-01-01T00:00:00.000Z"),
  });

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  await f.app.whenIdle();

  const value = result.value as { proof: string };

  expect(
    await f.app.concepts.ProofVerifying._proof({
      proof: value.proof,
    }),
  ).toEqual([{
    submitter: "maya",
    goal: f.goal,
    commitment: f.commitment,
    occurrence: f.occurrence,
    evidence: ["Clearer evidence"],
  }]);

  expect(
    await f.app.concepts.CommitmentTracking._completionsByCommitment({
      commitment: f.commitment,
    }),
  ).toEqual(before);

  const shared =
    await f.app.concepts.AccountabilityGrouping._sharedProofs({
      group: f.group,
    });

  expect(shared.map((item) => item.proof).sort()).toEqual(
    [f.proof, value.proof].sort(),
  );

  expect(
    await f.app.concepts.ProofVerifying._verificationsByProof({
      proof: f.proof,
    }),
  ).toHaveLength(1);

  expect(
    await f.app.concepts.ProofVerifying._verificationsByProof({
      proof: value.proof,
    }),
  ).toEqual([]);
});

test("another user cannot resubmit someone else's proof", async () => {
  const f = await fixture();

  const result = await f.app.invoker.invoke("/proofs/resubmit", {
    session: f.otherSession,
    submitter: "maya",
    previousProof: f.proof,
    evidence: ["New evidence"],
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "domain", value: "FORBIDDEN" },
  });

  expect(
    await f.app.concepts.ProofVerifying._proofsByCommitment({
      commitment: f.commitment,
    }),
  ).toHaveLength(1);
});

test("retired commitments cannot receive resubmissions", async () => {
  const f = await fixture();

  await f.app.concepts.CommitmentTracking.retireCommitment({
    commitment: f.commitment,
  });

  const result = await f.app.invoker.invoke("/proofs/resubmit", {
    session: f.ownerSession,
    previousProof: f.proof,
    evidence: ["New evidence"],
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "domain", value: "COMMITMENT_RETIRED" },
  });

  expect(
    await f.app.concepts.ProofVerifying._proofsByCommitment({
      commitment: f.commitment,
    }),
  ).toHaveLength(1);
});

test("invalid session cannot create a new attempt", async () => {
  const f = await fixture();

  const result = await f.app.invoker.invoke(
    "/proofs/resubmit",
    {
      session: "invalid-session",
      previousProof: f.proof,
      evidence: ["New evidence"],
    },
    { timeoutMs: 1000 },
  );

  expect(result.ok).toBe(false);

  await f.app.whenIdle();

  expect(
    await f.app.concepts.ProofVerifying._proofsByCommitment({
      commitment: f.commitment,
    }),
  ).toHaveLength(1);
});

test("missing proof returns PROOF_NOT_FOUND", async () => {
  const f = await fixture();

  const result = await f.app.invoker.invoke("/proofs/resubmit", {
    session: f.ownerSession,
    previousProof: "missing-proof",
    evidence: ["New evidence"],
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "domain", value: "PROOF_NOT_FOUND" },
  });
});
