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
  ShareProofWithGroup,
  ShareExistingProofsOnAttach,
  UnshareDeletedProof,
} from "../../src/compositions/proof-sharing.ts";

import {
  DeletePendingProof,
} from "../../src/compositions/proofs.ts";

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
          ShareExistingProofsOnAttach,
          UnshareDeletedProof,
        },
        proofs: {
          DeletePendingProof,
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

test("deleting pending proof removes group reference and preserves completion claim", async () => {
  const app = assembleTestApplication();
  const group = await createGroup(app);

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal: "goal-1",
      description: "Update my resume",
      recurring: false,
      schedule: "By Friday",
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
  const occurrence = new Date("2026-10-12T17:00:00.000Z");

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const proof = await submitProof(app, {
    goal: "goal-1",
    commitment,
    occurrence,
  });

  // This assembly tests sharing and deletion, so create the claim directly.
  const claimed =
    await app.concepts.CommitmentTracking.claimComplete({
      commitment,
      occurrence,
    });

  if (
    typeof claimed !== "object" ||
    claimed === null ||
    !("completion" in claimed) ||
    typeof claimed.completion !== "string"
  ) {
    throw new Error("Could not create completion claim.");
  }

  await app.whenIdle();

  expect(
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    }),
  ).toEqual([{ proof }]);

  const started = await app.concepts.Sessioning.start({
    subject: "maya",
  });

  if (
    typeof started !== "object" ||
    started === null ||
    !("session" in started) ||
    typeof started.session !== "string"
  ) {
    throw new Error("Could not create session.");
  }

  const result = await app.invoker.invoke(
    "/proofs/delete",
    {
      session: started.session,
      proof,
    },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({ proof });

  await app.whenIdle();

  expect(
    await app.concepts.ProofVerifying._proof({ proof }),
  ).toEqual([]);

  expect(
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    }),
  ).toEqual([]);

  expect(
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    }),
  ).toEqual([
    {
      completion: claimed.completion,
      occurrence,
    },
  ]);

  // Repeating cleanup is safe.
  const cleaned =
    await app.concepts.AccountabilityGrouping.unshareProof({
      proof,
    });

  expect(cleaned).toEqual({ proof });
});

test("attaching a goal shares its existing proofs and excludes other goals", async () => {
  const app = assembleTestApplication();
  const group = await createGroup(app);

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal: "goal-1",
      description: "Apply to internships",
      recurring: true,
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

  const firstProof = await submitProof(app, {
    goal: "goal-1",
    commitment: created.commitment,
    occurrence: new Date("2026-10-12T17:00:00.000Z"),
  });

  const secondProof = await submitProof(app, {
    goal: "goal-1",
    commitment: created.commitment,
    occurrence: new Date("2026-10-19T17:00:00.000Z"),
  });

  const otherCreated =
    await app.concepts.CommitmentTracking.createCommitment({
      goal: "goal-2",
      description: "Read another book",
      recurring: false,
      schedule: "By Friday",
    });

  if (
    typeof otherCreated !== "object" ||
    otherCreated === null ||
    !("commitment" in otherCreated) ||
    typeof otherCreated.commitment !== "string"
  ) {
    throw new Error("Could not create another commitment.");
  }

  const otherProof = await submitProof(app, {
    goal: "goal-2",
    commitment: otherCreated.commitment,
    occurrence: new Date("2026-10-12T17:00:00.000Z"),
  });

  await app.whenIdle();

  expect(
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    }),
  ).toEqual([]);

  const attached =
    await app.concepts.AccountabilityGrouping.attachGoal({
      group,
      user: "maya",
      goal: "goal-1",
    });

  expect(attached).toMatchObject({ group });

  await app.whenIdle();

  const shared =
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    });

  expect(shared.map((item) => item.proof).sort()).toEqual(
    [firstProof, secondProof].sort(),
  );

  expect(
    shared.some((item) => item.proof === otherProof),
  ).toBe(false);

  expect(
    await app.concepts.ProofVerifying._proof({
      proof: firstProof,
    }),
  ).toHaveLength(1);

  expect(
    await app.concepts.ProofVerifying._proof({
      proof: secondProof,
    }),
  ).toHaveLength(1);
});
