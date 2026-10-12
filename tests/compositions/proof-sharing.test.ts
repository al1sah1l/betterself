import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "../../src/concepts.ts";
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
  const instances = applicationConceptSet.implementations("mongo", {
    db: testDb.db,
  });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,
    composition: {
      BetterSelf: {
        proofSharing: {
          ShareProofWithGroup,
        },
      },
    },
  });
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

async function submitProof(
  app: ReturnType<typeof assembleTestApplication>,
  {
    goal,
    commitment,
    occurrence,
  }: {
    goal: string;
    commitment: string;
    occurrence: Date;
  },
) {
  const submitted =
    await app.concepts.ProofVerifying.submitProof({
      submitter: "maya",
      goal,
      commitment,
      occurrence,
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

test("proof is automatically shared when goal is attached to a group", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const proof = await submitProof(app, {
    goal: "goal-1",
    commitment: "commitment-1",
    occurrence: new Date("2026-10-12T17:00:00Z"),
  });

  await app.whenIdle();

  const sharedProofs =
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    });

  expect(sharedProofs).toHaveLength(1);
  expect(sharedProofs[0]).toMatchObject({
    proof,
  });
});

test("proof is not shared when goal is not attached to a group", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await submitProof(app, {
    goal: "goal-1",
    commitment: "commitment-1",
    occurrence: new Date("2026-10-12T17:00:00Z"),
  });

  await app.whenIdle();

  const sharedProofs =
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    });

  expect(sharedProofs).toEqual([]);
});

test("duplicate proof submission does not create another shared proof", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app);

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const occurrence = new Date("2026-10-12T17:00:00Z");

  const proof = await submitProof(app, {
    goal: "goal-1",
    commitment: "commitment-1",
    occurrence,
  });

  await app.whenIdle();

  const duplicate =
    await app.concepts.ProofVerifying.submitProof({
      submitter: "maya",
      goal: "goal-1",
      commitment: "commitment-1",
      occurrence,
      evidence: ["Different screenshot"],
    });

  expect(duplicate).toMatchObject({
    error: "PROOF_ALREADY_SUBMITTED",
  });

  await app.whenIdle();

  const sharedProofs =
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    });

  expect(sharedProofs).toHaveLength(1);
  expect(sharedProofs[0]).toMatchObject({
    proof,
  });
});
