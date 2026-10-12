import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import { applicationConceptSet } from "../../src/concepts.ts";

import { SubmitProof } from "../../src/compositions/proofs.ts";
import { RecordCompletionFromProof } from "../../src/compositions/completion.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

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
  const instances =
    applicationConceptSet.implementations("mongo", {
      db: testDb.db,
    });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,

    composition: {
      BetterSelf: {
        proofs: {
          SubmitProof,
        },

        completion: {
          RecordCompletionFromProof,
        },
      },
    },
  });
}

async function createSession(
  app: ReturnType<typeof assembleTestApplication>,
  subject: string,
) {
  const result =
    await app.concepts.Sessioning.start({
      subject,
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("session" in result) ||
    typeof result.session !== "string"
  ) {
    throw new Error("Could not create session.");
  }

  return result.session;
}

async function createGoal(
  app: ReturnType<typeof assembleTestApplication>,
  owner: string,
) {
  const result =
    await app.concepts.GoalPlanning.createGoal({
      owner,
      outcome: "Get a software engineering internship",
      currentContext:
        "Preparing for software engineering recruiting.",
      constraints:
        "Five hours per week.",
      timeline: "By summer 2027",
      successDefinition:
        "Receive and accept an internship offer.",
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("goal" in result) ||
    typeof result.goal !== "string"
  ) {
    throw new Error("Could not create goal.");
  }

  return result.goal;
}

async function createCommitment(
  app: ReturnType<typeof assembleTestApplication>,
  goal: string,
) {
  const result =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      description:
        "Apply to five internships",
      recurring: true,
      schedule: "Every Monday",
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("commitment" in result) ||
    typeof result.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  return result.commitment;
}

type SubmitProofResponse = {
  proof: string;
};

const occurrence =
  new Date("2026-10-12T17:00:00.000Z");

const evidence = [
  "Screenshot of submitted application",
  "Confirmation email",
];

test("goal owner can submit proof for their commitment", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    goal,
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session,
      goal,
      commitment,
      occurrence,
      evidence,
    },
  );

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  const value =
    result.value as SubmitProofResponse;

  expect(typeof value.proof).toBe("string");

  const proofs =
    await app.concepts.ProofVerifying._proof({
      proof: value.proof,
    });

  expect(proofs).toHaveLength(1);

  expect(proofs[0]).toMatchObject({
    submitter: "maya",
    goal,
    commitment,
    evidence,
  });
});

test("client cannot spoof proof submitter", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    goal,
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session,

      // Must be ignored by the endpoint.
      submitter: "alex",

      goal,
      commitment,
      occurrence,
      evidence,
    },
  );

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  const value =
    result.value as SubmitProofResponse;

  const proofs =
    await app.concepts.ProofVerifying._proof({
      proof: value.proof,
    });

  expect(proofs).toHaveLength(1);

  expect(proofs[0].submitter).toBe("maya");
});

test("successful proof submission automatically records completion", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    goal,
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session,
      goal,
      commitment,
      occurrence,
      evidence,
    },
  );

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(1);

  expect(completions[0].occurrence).toEqual(
    occurrence,
  );

  expect(
    typeof completions[0].completion,
  ).toBe("string");
});

test("user cannot submit proof for another user's goal", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    goal,
  );

  const alexSession = await createSession(
    app,
    "alex",
  );

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session: alexSession,
      goal,
      commitment,
      occurrence,
      evidence,
    },
  );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected proof submission to be forbidden.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });

  const proofs =
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    });

  expect(proofs).toEqual([]);

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toEqual([]);
});

test("missing commitment returns COMMITMENT_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session,
      goal,
      commitment: "missing-commitment",
      occurrence,
      evidence,
    },
  );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected missing commitment to return an error.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "COMMITMENT_NOT_FOUND",
  });
});

test("commitment from another goal returns COMMITMENT_GOAL_MISMATCH", async () => {
  const app = assembleTestApplication();

  const firstGoal = await createGoal(
    app,
    "maya",
  );

  const secondGoal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    firstGoal,
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session,
      goal: secondGoal,
      commitment,
      occurrence,
      evidence,
    },
  );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected commitment-goal mismatch.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "COMMITMENT_GOAL_MISMATCH",
  });

  const proofs =
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    });

  expect(proofs).toEqual([]);

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toEqual([]);
});

test("invalid session does not create proof or completion", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    goal,
  );

  await app.invoker.invoke(
    "/proofs/submit",
    {
      session: "invalid-session",
      goal,
      commitment,
      occurrence,
      evidence,
    },
    {
      timeoutMs: 1000,
    },
  );

  await app.whenIdle();

  const proofs =
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    });

  expect(proofs).toEqual([]);

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toEqual([]);
});
