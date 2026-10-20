import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import { applicationConceptSet } from "../../src/concepts.ts";

import {
  SubmitProof,
  DeletePendingProof,
} from "../../src/compositions/proofs.ts";

import {
  RecordCompletionFromProof,
} from "../../src/compositions/completion.ts";

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
  const instances = applicationConceptSet.implementations("mongo", {
    db: testDb.db,
  });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,
    composition: {
      BetterSelf: {
        proofs: {
          SubmitProof,
          DeletePendingProof,
        },
        completion: {
          RecordCompletionFromProof,
        },
      },
    },
  });
}

type TestApplication = ReturnType<typeof assembleTestApplication>;

async function createSession(
  app: TestApplication,
  subject: string,
) {
  const result = await app.concepts.Sessioning.start({ subject });

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
  app: TestApplication,
  owner: string,
) {
  const result = await app.concepts.GoalPlanning.createGoal({
    owner,
    outcome: "Get a software engineering internship",
    currentContext: "Preparing for software engineering recruiting.",
    constraints: "Five hours per week.",
    timeline: "By summer 2027",
    successDefinition: "Receive and accept an internship offer.",
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
  app: TestApplication,
  goal: string,
  recurring = true,
) {
  const result =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      description: recurring
        ? "Apply to five internships"
        : "Update my resume",
      recurring,
      schedule: recurring ? "Every Monday" : "By Friday",
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

const occurrence = new Date("2026-10-12T17:00:00.000Z");

const evidence = [
  "Screenshot of submitted application",
  "Confirmation email",
];

async function createPendingProof(app: TestApplication) {
  const goal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, goal);

  const submitted = await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (
    typeof submitted !== "object" ||
    submitted === null ||
    !("proof" in submitted) ||
    typeof submitted.proof !== "string"
  ) {
    throw new Error("Could not submit proof.");
  }

  await app.whenIdle();

  return {
    goal,
    commitment,
    proof: submitted.proof,
  };
}

test("goal owner can submit proof for their commitment", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, goal);
  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  const value = result.value as SubmitProofResponse;

  expect(typeof value.proof).toBe("string");

  const proofs = await app.concepts.ProofVerifying._proof({
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
  const goal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, goal);
  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke("/proofs/submit", {
    session,
    submitter: "alex",
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  const value = result.value as SubmitProofResponse;

  const proofs = await app.concepts.ProofVerifying._proof({
    proof: value.proof,
  });

  expect(proofs).toHaveLength(1);
  expect(proofs[0].submitter).toBe("maya");
});

test("successful proof submission automatically records completion", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, goal);
  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  await app.whenIdle();

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(1);
  expect(completions[0].occurrence).toEqual(occurrence);
  expect(typeof completions[0].completion).toBe("string");
});

test("user cannot submit proof for another user's goal", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, goal);
  const session = await createSession(app, "alex");

  const result = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence,
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected proof submission to be forbidden.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });

  expect(
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    }),
  ).toEqual([]);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual([]);
});

test("missing commitment returns COMMITMENT_NOT_FOUND", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment: "missing-commitment",
    occurrence,
    evidence,
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected missing commitment to return an error.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "COMMITMENT_NOT_FOUND",
  });
});

test("commitment from another goal returns COMMITMENT_GOAL_MISMATCH", async () => {
  const app = assembleTestApplication();
  const firstGoal = await createGoal(app, "maya");
  const secondGoal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, firstGoal);
  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke("/proofs/submit", {
    session,
    goal: secondGoal,
    commitment,
    occurrence,
    evidence,
  });

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected commitment-goal mismatch.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "COMMITMENT_GOAL_MISMATCH",
  });

  expect(
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    }),
  ).toEqual([]);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual([]);
});

test("invalid session does not create proof or completion", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const commitment = await createCommitment(app, goal);

  const result = await app.invoker.invoke(
    "/proofs/submit",
    {
      session: "invalid-session",
      goal,
      commitment,
      occurrence,
      evidence,
    },
    { timeoutMs: 1000 },
  );

  expect(result.ok).toBe(false);

  await app.whenIdle();

  expect(
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    }),
  ).toEqual([]);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual([]);
});

test("one-time commitment rejects another proof after completion", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const session = await createSession(app, "maya");
  const commitment = await createCommitment(app, goal, false);

  const firstResult = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (!firstResult.ok) {
    throw new Error(JSON.stringify(firstResult.error));
  }

  const firstValue = firstResult.value as SubmitProofResponse;

  await app.whenIdle();

  const originalCompletions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(originalCompletions).toHaveLength(1);
  expect(originalCompletions[0].occurrence).toEqual(occurrence);

  const secondOccurrence = new Date("2026-10-13T17:00:00.000Z");

  const secondResult = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence: secondOccurrence,
    evidence: ["Another screenshot"],
  });

  if (secondResult.ok) {
    throw new Error("Expected another proof to be rejected.");
  }

  expect(secondResult.error).toEqual({
    kind: "domain",
    value: "ONE_TIME_ALREADY_COMPLETED",
  });

  await app.whenIdle();

  expect(
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence: secondOccurrence,
    }),
  ).toEqual([]);

  const firstProofs =
    await app.concepts.ProofVerifying._proofForOccurrence({
      commitment,
      occurrence,
    });

  expect(firstProofs).toHaveLength(1);
  expect(firstProofs[0].proof).toBe(firstValue.proof);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual(originalCompletions);
});

test("another user cannot delete pending proof", async () => {
  const app = assembleTestApplication();
  const { proof } = await createPendingProof(app);

  const result = await app.concepts.ProofVerifying.deletePendingProof({
    submitter: "alex",
    proof,
  });

  expect(result).toEqual({
    error: "NOT_PROOF_SUBMITTER",
    detail: "Only the submitter can delete this proof.",
  });

  expect(
    await app.concepts.ProofVerifying._proof({ proof }),
  ).toHaveLength(1);
});

test("proof with any peer review cannot be deleted", async () => {
  const app = assembleTestApplication();

  for (const decision of ["verified", "disputed"] as const) {
    const { proof } = await createPendingProof(app);

    const reviewed = await app.concepts.ProofVerifying.reviewProof({
      reviewer: "alex",
      proof,
      decision,
      note: "Peer review.",
    });

    expect(reviewed).toEqual({ proof });

    const result = await app.concepts.ProofVerifying.deletePendingProof({
      submitter: "maya",
      proof,
    });

    expect(result).toEqual({
      error: "PROOF_HAS_REVIEWS",
      detail: "A proof with peer reviews cannot be deleted.",
    });

    expect(
      await app.concepts.ProofVerifying._proof({ proof }),
    ).toHaveLength(1);

    expect(
      await app.concepts.ProofVerifying._verificationsByProof({ proof }),
    ).toEqual([{
      reviewer: "alex",
      decision,
      note: "Peer review.",
    }]);
  }
});

test("deleting missing proof returns an error", async () => {
  const app = assembleTestApplication();

  const result = await app.concepts.ProofVerifying.deletePendingProof({
    submitter: "maya",
    proof: "missing-proof",
  });

  expect(result).toEqual({
    error: "PROOF_NOT_FOUND",
    detail: "There is no such proof.",
  });
});

test("concurrent review and deletion preserve consistent proof state", async () => {
  const app = assembleTestApplication();

  for (const reviewFirst of [true, false]) {
    const { proof } = await createPendingProof(app);

    const review = () =>
      app.concepts.ProofVerifying.reviewProof({
        reviewer: "alex",
        proof,
        decision: "verified",
        note: "Reviewed concurrently.",
      });

    const remove = () =>
      app.concepts.ProofVerifying.deletePendingProof({
        submitter: "maya",
        proof,
      });

    const results = await Promise.all(
      reviewFirst
        ? [review(), remove()]
        : [remove(), review()],
    );

    const proofs = await app.concepts.ProofVerifying._proof({ proof });

    const reviews =
      await app.concepts.ProofVerifying._verificationsByProof({ proof });

    if (proofs.length === 0) {
      expect(results).toContainEqual({ proof });
      expect(results).toContainEqual({
        error: "PROOF_NOT_FOUND",
        detail: "There is no such proof.",
      });
      expect(reviews).toEqual([]);
    } else {
      expect(results).toContainEqual({ proof });
      expect(results).toContainEqual({
        error: "PROOF_HAS_REVIEWS",
        detail: "A proof with peer reviews cannot be deleted.",
      });

      expect(proofs).toHaveLength(1);
      expect(reviews).toEqual([{
        reviewer: "alex",
        decision: "verified",
        note: "Reviewed concurrently.",
      }]);
    }
  }
});

test("owner can delete pending proof through the endpoint", async () => {
  const app = assembleTestApplication();
  const { proof } = await createPendingProof(app);
  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke(
    "/proofs/delete",
    { session, proof },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({ proof });

  expect(
    await app.concepts.ProofVerifying._proof({ proof }),
  ).toEqual([]);
});

test("client cannot spoof the submitter when deleting proof", async () => {
  const app = assembleTestApplication();
  const { proof } = await createPendingProof(app);
  const session = await createSession(app, "alex");

  const result = await app.invoker.invoke("/proofs/delete", {
    session,
    proof,
    submitter: "maya",
  });

  if (result.ok) {
    throw new Error("Expected deletion to be forbidden.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "NOT_PROOF_SUBMITTER",
  });

  expect(
    await app.concepts.ProofVerifying._proof({ proof }),
  ).toHaveLength(1);
});

test("invalid session cannot delete proof", async () => {
  const app = assembleTestApplication();
  const { proof } = await createPendingProof(app);

  const result = await app.invoker.invoke("/proofs/delete", {
    session: "invalid-session",
    proof,
  });

  expect(result.ok).toBe(false);

  expect(
    await app.concepts.ProofVerifying._proof({ proof }),
  ).toHaveLength(1);
});

test("deleted proof can be replaced for the same one-time completion claim", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const session = await createSession(app, "maya");
  const commitment = await createCommitment(app, goal, false);

  const first = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (!first.ok) {
    throw new Error(JSON.stringify(first.error));
  }

  const firstValue = first.value as SubmitProofResponse;

  await app.whenIdle();

  const originalClaims =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(originalClaims).toHaveLength(1);

  const deleted = await app.invoker.invoke("/proofs/delete", {
    session,
    proof: firstValue.proof,
  });

  if (!deleted.ok) {
    throw new Error(JSON.stringify(deleted.error));
  }

  await app.whenIdle();

  expect(
    await app.concepts.ProofVerifying._proof({
      proof: firstValue.proof,
    }),
  ).toEqual([]);

  const replacementEvidence = ["Corrected resume link"];

  const replacement = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence: replacementEvidence,
  });

  if (!replacement.ok) {
    throw new Error(JSON.stringify(replacement.error));
  }

  const replacementValue = replacement.value as SubmitProofResponse;

  expect(replacementValue.proof).not.toBe(firstValue.proof);

  await app.whenIdle();

  const proofs =
    await app.concepts.ProofVerifying._proofsByCommitment({
      commitment,
    });

  expect(proofs).toEqual([{
    proof: replacementValue.proof,
    submitter: "maya",
    goal,
    occurrence,
    evidence: replacementEvidence,
  }]);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual(originalClaims);

  const duplicate = await app.invoker.invoke("/proofs/submit", {
    session,
    goal,
    commitment,
    occurrence,
    evidence: ["Another proof"],
  });

  if (duplicate.ok) {
    throw new Error("Expected duplicate proof to be rejected.");
  }

  expect(duplicate.error).toEqual({
    kind: "domain",
    value: "PROOF_ALREADY_SUBMITTED",
  });

  expect(
    await app.concepts.ProofVerifying._proofsByCommitment({
      commitment,
    }),
  ).toEqual(proofs);
});

test("retired commitment refuses proof without storing proof or completion", async () => {
  const app = assembleTestApplication();
  const goal = await createGoal(app, "maya");
  const session = await createSession(app, "maya");

  for (const recurring of [false, true]) {
    const created =
      await app.concepts.CommitmentTracking.createCommitment({
        goal,
        description: "An action that has been retired",
        recurring,
        schedule: "Every Monday",
      });

    if (
      typeof created !== "object" ||
      created === null ||
      !("commitment" in created) ||
      typeof created.commitment !== "string"
    ) {
      throw new Error("Could not create commitment.");
    }

    const commitment = created.commitment;

    await app.concepts.CommitmentTracking.retireCommitment({
      commitment,
    });

    const result = await app.invoker.invoke("/proofs/submit", {
      session,
      goal,
      commitment,
      occurrence,
      evidence,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: "COMMITMENT_RETIRED",
      },
    });

    await app.whenIdle();

    expect(
      await app.concepts.ProofVerifying._proofsByCommitment({
        commitment,
      }),
    ).toEqual([]);

    expect(
      await app.concepts.CommitmentTracking._completionsByCommitment({
        commitment,
      }),
    ).toEqual([]);
  }
});

test("concurrent proofs for different occurrences of a one-time commitment store only one proof and completion", async () => {
  const app = assembleTestApplication();
  const session = await createSession(app, "maya");

  // Try both request orders with fresh commitments.
  for (const reverse of [false, true]) {
    const goal = await createGoal(app, "maya");
    const commitment = await createCommitment(app, goal, false);

    const submissions = [
      {
        occurrence: new Date("2026-10-12T17:00:00.000Z"),
        evidence: ["First concurrent submission"],
      },
      {
        occurrence: new Date("2026-10-13T17:00:00.000Z"),
        evidence: ["Second concurrent submission"],
      },
    ];

    if (reverse) submissions.reverse();

    const results = await Promise.all(
      submissions.map((submission) =>
        app.invoker.invoke("/proofs/submit", {
          session,
          goal,
          commitment,
          ...submission,
        }),
      ),
    );

    await app.whenIdle();

    const storedProofs =
      await app.concepts.ProofVerifying._proofsByCommitment({
        commitment,
      });

    const completions =
      await app.concepts.CommitmentTracking._completionsByCommitment({
        commitment,
      });

    expect(storedProofs).toHaveLength(1);
    expect(completions).toHaveLength(1);

    const successful = results.filter((result) => result.ok);
    const refused = results.filter((result) => !result.ok);

    expect(successful).toHaveLength(1);
    expect(refused).toHaveLength(1);

    const success = successful[0];
    const failure = refused[0];

    if (!success?.ok) {
      throw new Error("Expected exactly one successful submission.");
    }

    if (!failure || failure.ok) {
      throw new Error("Expected exactly one refused submission.");
    }

    expect(failure.error).toEqual({
      kind: "domain",
      value: "ONE_TIME_ALREADY_COMPLETED",
    });

    const value = success.value as SubmitProofResponse;

    expect(storedProofs[0].proof).toBe(value.proof);
    expect(completions[0].occurrence).toEqual(
      storedProofs[0].occurrence,
    );

    const winner = submissions.find(
      (submission) =>
        submission.occurrence.getTime() ===
        storedProofs[0].occurrence.getTime(),
    );

    if (!winner) {
      throw new Error("Stored proof does not match either submission.");
    }

    expect(storedProofs[0].evidence).toEqual(winner.evidence);

    const loser = submissions.find(
      (submission) =>
        submission.occurrence.getTime() !==
        storedProofs[0].occurrence.getTime(),
    );

    if (!loser) {
      throw new Error("Could not identify the refused occurrence.");
    }

    expect(
      await app.concepts.ProofVerifying._proofForOccurrence({
        commitment,
        occurrence: loser.occurrence,
      }),
    ).toEqual([]);
  }
});
