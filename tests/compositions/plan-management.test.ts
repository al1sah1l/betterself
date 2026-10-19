import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import {
  applicationConceptSet,
} from "../../src/concepts.ts";

import {
  UpdateGoal,
  RetireCommitment,
} from "../../src/compositions/plan-management.ts";

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

const context = {
  outcome: "Find an internship",
  currentContext: "Applying",
  constraints: "Five hours weekly",
  timeline: "Summer",
  successDefinition: "Accept an offer",
};

async function setup() {
  const app = assemble({
    conceptSet: applicationConceptSet,

    instances:
      applicationConceptSet.implementations("mongo", {
        db: testDb.db,
      }),

    composition: {
      BetterSelf: {
        planManagement: {
          UpdateGoal,
          RetireCommitment,
        },
      },
    },
  });

  const goalResult =
    await app.concepts.GoalPlanning.createGoal({
      owner: "maya",
      ...context,
    });

  const otherResult =
    await app.concepts.GoalPlanning.createGoal({
      owner: "maya",
      ...context,
    });

  const maya =
    await app.concepts.Sessioning.start({
      subject: "maya",
    });

  const alex =
    await app.concepts.Sessioning.start({
      subject: "alex",
    });

  if (
    !("goal" in goalResult) ||
    typeof goalResult.goal !== "string" ||
    !("goal" in otherResult) ||
    typeof otherResult.goal !== "string" ||
    !("session" in maya) ||
    typeof maya.session !== "string" ||
    !("session" in alex) ||
    typeof alex.session !== "string"
  ) {
    throw new Error("Setup failed.");
  }

  const goal = goalResult.goal;

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      description: "Apply",
      recurring: true,
      schedule: "Monday",
    });

  if (
    !("commitment" in created) ||
    typeof created.commitment !== "string"
  ) {
    throw new Error("Setup failed.");
  }

  return {
    app,
    goal,
    otherGoal: otherResult.goal,
    commitment: created.commitment,
    session: maya.session,
    otherSession: alex.session,
  };
}

test("owner updates context without replacing strategy or owner", async () => {
  const { app, goal, session } = await setup();

  const strategy = [
    {
      description: "Apply weekly",
      successCriterion: "Five applications",
    },
  ];

  await app.concepts.GoalPlanning.setStrategy({
    goal,
    strategy,
  });

  const response = await app.invoker.invoke(
    "/goals/update",
    {
      session,
      goal,
      ...context,
      outcome: "Find a research internship",
      owner: "alex",
      user: "alex",
    },
  );

  expect(response).toEqual({
    ok: true,
    value: { goal },
  });

  expect(
    await app.concepts.GoalPlanning._goal({ goal }),
  ).toEqual([
    {
      owner: "maya",
      ...context,
      outcome: "Find a research internship",
      currentStrategy: strategy,
    },
  ]);
});

test("retirement preserves execution and proof history and refuses repetition", async () => {
  const {
    app,
    goal,
    session,
    commitment,
  } = await setup();

  const occurrence =
    new Date("2026-10-19T12:00:00.000Z");

  await app.concepts.CommitmentTracking.claimComplete({
    commitment,
    occurrence,
  });

  await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal,
    commitment,
    occurrence,
    evidence: ["Application confirmation"],
  });

  const claims =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  const proofs =
    await app.concepts.ProofVerifying._proofsByCommitment({
      commitment,
    });

  expect(
    await app.invoker.invoke(
      "/commitments/retire",
      { session, goal, commitment },
    ),
  ).toEqual({
    ok: true,
    value: { commitment },
  });

  expect(
    (
      await app.concepts.CommitmentTracking._commitment({
        commitment,
      })
    )[0]?.active,
  ).toBe(false);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual(claims);

  expect(
    await app.concepts.ProofVerifying._proofsByCommitment({
      commitment,
    }),
  ).toEqual(proofs);

  expect(
    await app.invoker.invoke(
      "/commitments/retire",
      { session, goal, commitment },
    ),
  ).toEqual({
    ok: false,
    error: {
      kind: "domain",
      value: "COMMITMENT_ALREADY_RETIRED",
    },
  });
});

test("another user and invalid sessions cannot change the plan", async () => {
  const {
    app,
    goal,
    commitment,
    otherSession,
  } = await setup();

  const before =
    await app.concepts.GoalPlanning._goal({ goal });

  for (const path of [
    "/goals/update",
    "/commitments/retire",
  ]) {
    const payload = {
      ...context,
      goal,
      commitment,
      user: "maya",
      outcome: "Spoofed",
    };

    expect(
      await app.invoker.invoke(path, {
        ...payload,
        session: otherSession,
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: "FORBIDDEN",
      },
    });

    const invalid = await app.invoker.invoke(
      path,
      {
        ...payload,
        session: "invalid",
      },
      {
        timeoutMs: 1000,
      },
    );

    expect(invalid.ok).toBe(false);
  }

  expect(
    await app.concepts.GoalPlanning._goal({ goal }),
  ).toEqual(before);

  expect(
    (
      await app.concepts.CommitmentTracking._commitment({
        commitment,
      })
    )[0]?.active,
  ).toBe(true);
});

test("missing records and a mismatched goal are refused without retiring commitment", async () => {
  const {
    app,
    goal,
    otherGoal,
    commitment,
    session,
  } = await setup();

  const cases = [
    [
      "/goals/update",
      { goal: "missing" },
      "GOAL_NOT_FOUND",
    ],
    [
      "/commitments/retire",
      { goal: "missing", commitment },
      "GOAL_NOT_FOUND",
    ],
    [
      "/commitments/retire",
      { goal, commitment: "missing" },
      "COMMITMENT_NOT_FOUND",
    ],
    [
      "/commitments/retire",
      { goal: otherGoal, commitment },
      "COMMITMENT_GOAL_MISMATCH",
    ],
  ] as const;

  for (const [path, input, code] of cases) {
    expect(
      await app.invoker.invoke(path, {
        ...context,
        session,
        ...input,
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: code,
      },
    });
  }

  expect(
    (
      await app.concepts.CommitmentTracking._commitment({
        commitment,
      })
    )[0]?.active,
  ).toBe(true);
});
