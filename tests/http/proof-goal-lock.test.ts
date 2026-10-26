
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import {
  goalForProof,
  isProofScopedMutation,
  proofStillBelongsToGoal,
  withExistingGoal,
  withGoalLock,
} from "../../src/http/goal-operation-lock.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;

type StringId = {
  _id: string;
  [key: string]: unknown;
};

async function seed(): Promise<void> {
  await testDb.db
    .collection<StringId>("goalPlanning.goals")
    .insertOne({
      _id: "goal-1",
      owner: "maya",
    });

  await testDb.db
    .collection<StringId>("proofVerifying.proofs")
    .insertOne({
      _id: "proof-1",
      goal: "goal-1",
      submitter: "maya",
    });

  await testDb.db
    .collection<StringId>("proofVerifying.attempts")
    .insertOne({
      _id: "attempt-1",
      goal: "goal-1",
      previousProof: "proof-1",
      submitter: "maya",
    });
}

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
});

afterAll(async () => {
  await testDb.close();
});

test(
  "original proofs resolve to their goal",
  async () => {
    await seed();

    expect(
      await goalForProof(testDb.db, "proof-1"),
    ).toBe("goal-1");
  },
);

test(
  "resubmitted proof attempts resolve to their goal",
  async () => {
    await seed();

    expect(
      await goalForProof(testDb.db, "attempt-1"),
    ).toBe("goal-1");
  },
);

test(
  "unknown proofs cannot resolve a goal",
  async () => {
    expect(
      await goalForProof(testDb.db, "unknown"),
    ).toBeNull();
  },
);

test(
  "proof relationships are revalidated",
  async () => {
    await seed();

    expect(
      await proofStillBelongsToGoal(
        testDb.db,
        "proof-1",
        "goal-1",
      ),
    ).toBe(true);

    expect(
      await proofStillBelongsToGoal(
        testDb.db,
        "proof-1",
        "another-goal",
      ),
    ).toBe(false);
  },
);

test(
  "proof mutations use goal-scoped coordination",
  () => {
    expect(
      isProofScopedMutation("/proofs/resubmit"),
    ).toBe(true);

    expect(
      isProofScopedMutation("/proofs/delete"),
    ).toBe(true);

    expect(
      isProofScopedMutation("/auth/sign-in"),
    ).toBe(false);
  },
);

test(
  "proof mutation queued behind deletion cannot proceed",
  async () => {
    await seed();

    const proofGoal = await goalForProof(
      testDb.db,
      "proof-1",
    );

    expect(proofGoal).toBe("goal-1");

    let beginDeletion!: () => void;
    let finishDeletion!: () => void;

    const started = new Promise<void>((resolve) => {
      beginDeletion = resolve;
    });

    const hold = new Promise<void>((resolve) => {
      finishDeletion = resolve;
    });

    const deletion = withGoalLock(
      "goal-1",
      async () => {
        beginDeletion();
        await hold;

        await testDb.db
          .collection<StringId>("goalPlanning.goals")
          .deleteOne({ _id: "goal-1" });

        await testDb.db
          .collection<StringId>("proofVerifying.proofs")
          .deleteOne({ _id: "proof-1" });
      },
    );

    await started;

    let invoked = false;

    const mutation = withExistingGoal(
      testDb.db,
      proofGoal!,
      async () => {
        const valid =
          await proofStillBelongsToGoal(
            testDb.db,
            "proof-1",
            proofGoal!,
          );

        if (!valid) return "PROOF_NOT_FOUND";

        invoked = true;
        return "SUCCESS";
      },
      () => "GOAL_NOT_FOUND",
    );

    finishDeletion();

    await deletion;

    expect(await mutation).toBe("GOAL_NOT_FOUND");
    expect(invoked).toBe(false);
  },
);
