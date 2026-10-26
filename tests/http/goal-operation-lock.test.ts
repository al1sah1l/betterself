
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import {
  guardedGoalId,
  withExistingGoal,
  withGoalLock,
} from "../../src/http/goal-operation-lock.ts";

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

/* ------------------------------------------
   Same-goal serialization
------------------------------------------ */

test(
  "operations on the same goal execute sequentially",
  async () => {
    const events: string[] = [];

    let releaseFirst!: () => void;
    let signalStarted!: () => void;

    const started = new Promise<void>(
      (resolve) => {
        signalStarted = resolve;
      },
    );

    const holdFirst = new Promise<void>(
      (resolve) => {
        releaseFirst = resolve;
      },
    );

    const first = withGoalLock(
      "goal-1",
      async () => {
        events.push("first-start");
        signalStarted();

        await holdFirst;

        events.push("first-end");
      },
    );

    await started;

    const second = withGoalLock(
      "goal-1",
      async () => {
        events.push("second-start");
      },
    );

    expect(events).toEqual([
      "first-start",
    ]);

    releaseFirst();

    await Promise.all([
      first,
      second,
    ]);

    expect(events).toEqual([
      "first-start",
      "first-end",
      "second-start",
    ]);
  },
);

/* ------------------------------------------
   Different-goal concurrency
------------------------------------------ */

test(
  "operations on different goals can overlap",
  async () => {
    const events: string[] = [];

    let releaseFirst!: () => void;
    let signalStarted!: () => void;

    const started = new Promise<void>(
      (resolve) => {
        signalStarted = resolve;
      },
    );

    const holdFirst = new Promise<void>(
      (resolve) => {
        releaseFirst = resolve;
      },
    );

    const first = withGoalLock(
      "goal-a",
      async () => {
        events.push("a-start");
        signalStarted();

        await holdFirst;

        events.push("a-end");
      },
    );

    await started;

    await withGoalLock(
      "goal-b",
      async () => {
        events.push("b-start");
      },
    );

    expect(events).toEqual([
      "a-start",
      "b-start",
    ]);

    releaseFirst();
    await first;

    expect(events).toEqual([
      "a-start",
      "b-start",
      "a-end",
    ]);
  },
);

/* ------------------------------------------
   Deleted goal protection
------------------------------------------ */

test(
  "deleted goals reject new mutations",
  async () => {
    await testDb.db
      .collection<{ _id: string }>(
        "goalPlanning.goals",
      )
      .insertOne({
        _id: "goal-delete",
      });

    await withGoalLock(
      "goal-delete",
      async () => {
        await testDb.db
          .collection<{ _id: string }>(
            "goalPlanning.goals",
          )
          .deleteOne({
            _id: "goal-delete",
          });
      },
    );

    let executed = false;

    const result = await withExistingGoal(
      testDb.db,
      "goal-delete",
      async () => {
        executed = true;
        return "mutated";
      },
      () => "GOAL_NOT_FOUND",
    );

    expect(result).toBe("GOAL_NOT_FOUND");
    expect(executed).toBe(false);
  },
);

/* ------------------------------------------
   Deletion race
------------------------------------------ */

test(
  "an operation queued behind deletion cannot mutate the deleted goal",
  async () => {
    await testDb.db
      .collection<{ _id: string }>(
        "goalPlanning.goals",
      )
      .insertOne({
        _id: "goal-race",
      });

    let releaseDeletion!: () => void;
    let signalDeletionStarted!: () => void;

    const deletionStarted =
      new Promise<void>((resolve) => {
        signalDeletionStarted = resolve;
      });

    const holdDeletion =
      new Promise<void>((resolve) => {
        releaseDeletion = resolve;
      });

    const deletion = withGoalLock(
      "goal-race",
      async () => {
        signalDeletionStarted();

        await holdDeletion;

        await testDb.db
          .collection<{ _id: string }>(
            "goalPlanning.goals",
          )
          .deleteOne({
            _id: "goal-race",
          });
      },
    );

    // Ensure the deletion acquired its lock
    // before the mutation is requested.
    await deletionStarted;

    let mutated = false;

    const mutation = withExistingGoal(
      testDb.db,
      "goal-race",
      async () => {
        mutated = true;
        return "SUCCESS";
      },
      () => "GOAL_NOT_FOUND",
    );

    releaseDeletion();

    await deletion;

    expect(await mutation).toBe(
      "GOAL_NOT_FOUND",
    );

    expect(mutated).toBe(false);

    expect(
      await testDb.db
        .collection<{ _id: string }>(
          "goalPlanning.goals",
        )
        .countDocuments({
          _id: "goal-race",
        }),
    ).toBe(0);
  },
);

/* ------------------------------------------
   Error recovery
------------------------------------------ */

test(
  "a failed operation releases its goal lock",
  async () => {
    await expect(
      withGoalLock(
        "goal-error",
        async () => {
          throw new Error(
            "Simulated error",
          );
        },
      ),
    ).rejects.toThrow(
      "Simulated error",
    );

    const result = await withGoalLock(
      "goal-error",
      async () => "recovered",
    );

    expect(result).toBe("recovered");
  },
);

/* ------------------------------------------
   Endpoint coverage
------------------------------------------ */

test(
  "only known goal-scoped endpoints are guarded",
  () => {
    const protectedPaths = [
      "/goals/set-strategy",
      "/goals/update",
      "/commitments/create",
      "/commitments/retire",
      "/proofs/submit",
      "/groups/attach-goal",
      "/results/record",
      "/results/remove",
      "/reviews/apply",
    ];

    for (const path of protectedPaths) {
      expect(
        guardedGoalId(
          path,
          { goal: "goal-1" },
        ),
      ).toBe("goal-1");
    }

    expect(
      guardedGoalId(
        "/auth/sign-in",
        { goal: "goal-1" },
      ),
    ).toBeNull();

    expect(
      guardedGoalId(
        "/proofs/submit",
        {},
      ),
    ).toBeNull();

    expect(
      guardedGoalId(
        "/proofs/submit",
        { goal: "" },
      ),
    ).toBeNull();

    expect(
      guardedGoalId(
        "/proofs/submit",
        { goal: 123 },
      ),
    ).toBeNull();

    expect(
      guardedGoalId(
        "/proofs/submit",
        null,
      ),
    ).toBeNull();
  },
);
