import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import {
  handleResourceManagementRequest,
} from "../../src/http/resource-management.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

import {
  GridFSBucket,
  ObjectId,
} from "mongodb";

import {
  cleanupPendingGoalImages,
} from "../../src/http/resource-management.ts";

let testDb: TestDb;

const sessions: Record<string, string> = {
  "maya-session": "maya",
  "alex-session": "alex",
  "charlie-session": "charlie",
};

type StringIdDocument = {
  _id: string;
  [key: string]: unknown;
};

const collections = {
  groups: "accountabilityGrouping.groups",
  members: "accountabilityGrouping.memberships",
  attachments: "accountabilityGrouping.goalAttachments",
  shared: "accountabilityGrouping.sharedProofs",
  goals: "goalPlanning.goals",
  commitments: "commitmentTracking.commitments",
  completions: "commitmentTracking.completions",
  proofs: "proofVerifying.proofs",
  attempts: "proofVerifying.attempts",
  reviews: "proofVerifying.verifications",
  results: "resultTracking.results",
} as const;

async function invoke(
  path: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (path !== "/auth/current") {
    return { ok: false };
  }

  const user =
    typeof input.session === "string"
      ? sessions[input.session]
      : undefined;

  if (!user) {
    return { ok: false };
  }

  return {
    ok: true,
    value: { account: user },
  };
}

async function request(
  path: "groups/leave" | "goals/delete",
  session: string,
  data: Record<string, unknown>,
): Promise<Response> {
  return handleResourceManagementRequest(
    new Request(
      `http://localhost/api/${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session,
          ...data,
        }),
      },
    ),
    invoke,
    testDb.db,
  );
}

async function addGoal(
  goal: string,
  owner: string,
): Promise<void> {
  await testDb.db
    .collection<StringIdDocument>(collections.goals)
    .insertOne({
      _id: goal,
      owner,
      outcome: `${owner}'s goal`,
      currentContext: "Starting point",
      constraints: "Limited time",
      timeline: "This semester",
      successDefinition: "Done",
      createdAt: new Date(),
    });
}

async function addGroup(
  group: string,
  owner: string,
): Promise<void> {
  await testDb.db
    .collection<StringIdDocument>(collections.groups)
    .insertOne({
      _id: group,
      owner,
      name: `${owner}'s group`,
      topic: "Accountability",
      visibility: "private",
      createdAt: new Date(),
    });

  await addMembership(group, owner);
}

async function addMembership(
  group: string,
  user: string,
): Promise<void> {
  await testDb.db
    .collection(collections.members)
    .insertOne({
      group,
      user,
      createdAt: new Date(),
    });
}

async function attachGoal(
  group: string,
  goal: string,
): Promise<void> {
  await testDb.db
    .collection(collections.attachments)
    .insertOne({
      group,
      goal,
      createdAt: new Date(),
    });
}

async function addCommitment(
  commitment: string,
  goal: string,
): Promise<void> {
  await testDb.db
    .collection<StringIdDocument>(collections.commitments)
    .insertOne({
      _id: commitment,
      goal,
      description: "Finish my project",
      recurring: false,
      schedule: "This week",
      active: true,
      createdAt: new Date(),
    });

  await testDb.db
    .collection(collections.completions)
    .insertOne({
      commitment,
      occurrence: new Date(),
      claimKey: "one-time",
    });
}

async function addProof(
  proof: string,
  goal: string,
  commitment: string,
  submitter: string,
): Promise<void> {
  await testDb.db
    .collection<StringIdDocument>(collections.proofs)
    .insertOne({
      _id: proof,
      goal,
      commitment,
      submitter,
      occurrence: new Date(),
      evidence: ["Test evidence"],
      createdAt: new Date(),
    });

  await testDb.db
    .collection(collections.reviews)
    .insertOne({
      proof,
      reviewer: "alex",
      decision: "verified",
      note: "Looks good",
      createdAt: new Date(),
    });
}

async function shareProof(
  group: string,
  proof: string,
): Promise<void> {
  await testDb.db
    .collection(collections.shared)
    .insertOne({
      group,
      proof,
      createdAt: new Date(),
    });
}

async function count(
  collection: string,
  query: Record<string, unknown> = {},
): Promise<number> {
  return testDb.db
    .collection(collection)
    .countDocuments(query);
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

/* ------------------------------------------
   Authentication and validation
------------------------------------------ */

test(
  "unauthenticated users cannot leave groups",
  async () => {
    await addGroup("group-1", "maya");
    await addMembership("group-1", "alex");

    const response = await request(
      "groups/leave",
      "invalid-session",
      { group: "group-1" },
    );

    expect(response.status).toBe(401);

    expect(
      await count(collections.members, {
        group: "group-1",
        user: "alex",
      }),
    ).toBe(1);
  },
);

test(
  "unauthenticated users cannot delete goals",
  async () => {
    await addGoal("goal-1", "maya");

    const response = await request(
      "goals/delete",
      "invalid-session",
      { goal: "goal-1" },
    );

    expect(response.status).toBe(401);

    expect(
      await count(collections.goals, {
        _id: "goal-1",
      }),
    ).toBe(1);
  },
);

/* ------------------------------------------
   Leave group
------------------------------------------ */

test(
  "a regular member can leave a group",
  async () => {
    await addGroup("group-1", "maya");
    await addMembership("group-1", "alex");

    const response = await request(
      "groups/leave",
      "alex-session",
      { group: "group-1" },
    );

    expect(response.status).toBe(200);

    expect(
      await count(collections.members, {
        group: "group-1",
        user: "alex",
      }),
    ).toBe(0);

    expect(
      await count(collections.members, {
        group: "group-1",
        user: "maya",
      }),
    ).toBe(1);

    expect(
      await count(collections.groups, {
        _id: "group-1",
      }),
    ).toBe(1);
  },
);

test(
  "group owner cannot leave their own group",
  async () => {
    await addGroup("group-1", "maya");

    const response = await request(
      "groups/leave",
      "maya-session",
      { group: "group-1" },
    );

    expect(response.status).toBe(409);

    expect(
      await count(collections.members, {
        group: "group-1",
        user: "maya",
      }),
    ).toBe(1);
  },
);

test(
  "a nonmember cannot leave another group",
  async () => {
    await addGroup("group-1", "maya");

    const response = await request(
      "groups/leave",
      "charlie-session",
      { group: "group-1" },
    );

    expect(response.status).toBe(403);

    expect(
      await count(collections.groups, {
        _id: "group-1",
      }),
    ).toBe(1);
  },
);

test(
  "leaving detaches own goals but preserves their data",
  async () => {
    await addGroup("group-1", "maya");
    await addMembership("group-1", "alex");

    await addGoal("goal-alex", "alex");

    await addCommitment(
      "commitment-alex",
      "goal-alex",
    );

    await addProof(
      "proof-alex",
      "goal-alex",
      "commitment-alex",
      "alex",
    );

    await attachGoal(
      "group-1",
      "goal-alex",
    );

    await shareProof(
      "group-1",
      "proof-alex",
    );

    const response = await request(
      "groups/leave",
      "alex-session",
      { group: "group-1" },
    );

    expect(response.status).toBe(200);

    expect(
      await count(collections.attachments, {
        goal: "goal-alex",
      }),
    ).toBe(0);

    expect(
      await count(collections.shared, {
        proof: "proof-alex",
      }),
    ).toBe(0);

    // Personal goal data remains intact.
    expect(
      await count(collections.goals, {
        _id: "goal-alex",
      }),
    ).toBe(1);

    expect(
      await count(collections.commitments, {
        _id: "commitment-alex",
      }),
    ).toBe(1);

    expect(
      await count(collections.proofs, {
        _id: "proof-alex",
      }),
    ).toBe(1);

    expect(
      await count(collections.completions, {
        commitment: "commitment-alex",
      }),
    ).toBe(1);
  },
);

test(
  "leaving one group does not affect another group",
  async () => {
    await addGroup("group-1", "maya");
    await addGroup("group-2", "charlie");

    await addMembership("group-1", "alex");
    await addMembership("group-2", "alex");

    const response = await request(
      "groups/leave",
      "alex-session",
      { group: "group-1" },
    );

    expect(response.status).toBe(200);

    expect(
      await count(collections.members, {
        group: "group-1",
        user: "alex",
      }),
    ).toBe(0);

    expect(
      await count(collections.members, {
        group: "group-2",
        user: "alex",
      }),
    ).toBe(1);
  },
);

/* ------------------------------------------
   Delete goal
------------------------------------------ */

test(
  "only the goal owner can delete it",
  async () => {
    await addGoal("goal-maya", "maya");

    const response = await request(
      "goals/delete",
      "alex-session",
      { goal: "goal-maya" },
    );

    expect(response.status).toBe(403);

    expect(
      await count(collections.goals, {
        _id: "goal-maya",
      }),
    ).toBe(1);
  },
);

test(
  "deleting a nonexistent goal returns 404",
  async () => {
    const response = await request(
      "goals/delete",
      "maya-session",
      { goal: "does-not-exist" },
    );

    expect(response.status).toBe(404);
  },
);

test(
  "deleting a goal removes its associated records",
  async () => {
    await addGoal("goal-1", "maya");
    await addGroup("group-1", "maya");

    await addCommitment(
      "commitment-1",
      "goal-1",
    );

    await addProof(
      "proof-1",
      "goal-1",
      "commitment-1",
      "maya",
    );

    await testDb.db
      .collection<StringIdDocument>(collections.attempts)
      .insertOne({
        _id: "attempt-1",
        previousProof: "proof-1",
        goal: "goal-1",
        commitment: "commitment-1",
        submitter: "maya",
        occurrence: new Date(),
        evidence: ["New evidence"],
        createdAt: new Date(),
      });

    await testDb.db
      .collection(collections.reviews)
      .insertOne({
        proof: "attempt-1",
        reviewer: "alex",
        decision: "disputed",
        note: "Need clearer evidence",
        createdAt: new Date(),
      });

    await testDb.db
      .collection(collections.results)
      .insertOne({
        goal: "goal-1",
        description: "Portfolio published",
        observedOn: "2026-10-26",
        createdAt: new Date(),
      });

    await attachGoal("group-1", "goal-1");

    await shareProof("group-1", "proof-1");
    await shareProof("group-1", "attempt-1");

    const response = await request(
      "goals/delete",
      "maya-session",
      { goal: "goal-1" },
    );

    expect(response.status).toBe(200);

    expect(
      await count(collections.goals, {
        _id: "goal-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.commitments, {
        goal: "goal-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.completions, {
        commitment: "commitment-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.proofs, {
        goal: "goal-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.attempts, {
        goal: "goal-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.reviews, {
        proof: {
          $in: ["proof-1", "attempt-1"],
        },
      }),
    ).toBe(0);

    expect(
      await count(collections.results, {
        goal: "goal-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.attachments, {
        goal: "goal-1",
      }),
    ).toBe(0);

    expect(
      await count(collections.shared, {
        proof: {
          $in: ["proof-1", "attempt-1"],
        },
      }),
    ).toBe(0);

    // Deleting a goal must not delete the group itself.
    expect(
      await count(collections.groups, {
        _id: "group-1",
      }),
    ).toBe(1);
  },
);

test(
  "deleting one goal preserves another user's goal",
  async () => {
    await addGoal("goal-maya", "maya");
    await addGoal("goal-alex", "alex");

    await addCommitment(
      "commitment-maya",
      "goal-maya",
    );

    await addCommitment(
      "commitment-alex",
      "goal-alex",
    );

    const response = await request(
      "goals/delete",
      "maya-session",
      { goal: "goal-maya" },
    );

    expect(response.status).toBe(200);

    expect(
      await count(collections.goals, {
        _id: "goal-alex",
      }),
    ).toBe(1);

    expect(
      await count(collections.commitments, {
        _id: "commitment-alex",
      }),
    ).toBe(1);

    expect(
      await count(collections.completions, {
        commitment: "commitment-alex",
      }),
    ).toBe(1);
  },
);


/* ------------------------------------------
   GridFS cleanup
------------------------------------------ */

async function storeTestImage(): Promise<{
  id: ObjectId;
  token: string;
}> {
  const id = new ObjectId();

  const bucket = new GridFSBucket(
    testDb.db,
    { bucketName: "proofImages" },
  );

  const bytes = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 0,
  ]);

  const stream = bucket.openUploadStreamWithId(
    id,
    "proof.png",
    {
      metadata: {
        owner: "maya",
        contentType: "image/png",
      },
    },
  );

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.end(bytes);
  });

  await testDb.db
    .collection("proofImageOwners")
    .insertOne({
      _id: id,
      owner: "maya",
      contentType: "image/png",
    });

  return {
    id,
    token: `image:${id.toHexString()}`,
  };
}

test(
  "deleting a goal removes its GridFS image",
  async () => {
    await addGoal("goal-image", "maya");
    await addCommitment(
      "commitment-image",
      "goal-image",
    );

    const image = await storeTestImage();

    await testDb.db
      .collection<StringIdDocument>(collections.proofs)
      .insertOne({
        _id: "proof-image",
        goal: "goal-image",
        commitment: "commitment-image",
        submitter: "maya",
        occurrence: new Date(),
        evidence: [image.token],
        createdAt: new Date(),
      });

    const response = await request(
      "goals/delete",
      "maya-session",
      { goal: "goal-image" },
    );

    expect(response.status).toBe(200);

    expect(
      await count("proofImages.files", {
        _id: image.id,
      }),
    ).toBe(0);

    expect(
      await count("proofImageOwners", {
        _id: image.id,
      }),
    ).toBe(0);

    expect(
      await count("maintenance.imageCleanup", {
        imageId: image.id,
      }),
    ).toBe(0);
  },
);

test(
  "deleting a goal removes images from previous attempts",
  async () => {
    await addGoal("goal-retry", "maya");
    await addCommitment(
      "commitment-retry",
      "goal-retry",
    );

    const first = await storeTestImage();
    const second = await storeTestImage();

    await testDb.db
      .collection<StringIdDocument>(collections.proofs)
      .insertOne({
        _id: "proof-first",
        goal: "goal-retry",
        commitment: "commitment-retry",
        submitter: "maya",
        occurrence: new Date(),
        evidence: [first.token],
        createdAt: new Date(),
      });

    await testDb.db
      .collection<StringIdDocument>(collections.attempts)
      .insertOne({
        _id: "proof-second",
        previousProof: "proof-first",
        goal: "goal-retry",
        commitment: "commitment-retry",
        submitter: "maya",
        occurrence: new Date(),
        evidence: [second.token],
        createdAt: new Date(),
      });

    const response = await request(
      "goals/delete",
      "maya-session",
      { goal: "goal-retry" },
    );

    expect(response.status).toBe(200);

    expect(
      await count("proofImages.files", {
        _id: { $in: [first.id, second.id] },
      }),
    ).toBe(0);

    expect(
      await count("proofImageOwners", {
        _id: { $in: [first.id, second.id] },
      }),
    ).toBe(0);
  },
);

test(
  "an image still referenced by another goal is preserved",
  async () => {
    await addGoal("goal-delete", "maya");
    await addGoal("goal-keep", "maya");

    const image = await storeTestImage();

    for (const [proof, goal] of [
      ["proof-delete", "goal-delete"],
      ["proof-keep", "goal-keep"],
    ]) {
      await testDb.db
        .collection<StringIdDocument>(collections.proofs)
        .insertOne({
          _id: proof,
          goal,
          commitment: `commitment-${goal}`,
          submitter: "maya",
          occurrence: new Date(),
          evidence: [image.token],
          createdAt: new Date(),
        });
    }

    const response = await request(
      "goals/delete",
      "maya-session",
      { goal: "goal-delete" },
    );

    expect(response.status).toBe(200);

    expect(
      await count("proofImages.files", {
        _id: image.id,
      }),
    ).toBe(1);

    expect(
      await count("proofImageOwners", {
        _id: image.id,
      }),
    ).toBe(1);

    expect(
      await count(collections.proofs, {
        _id: "proof-keep",
      }),
    ).toBe(1);
  },
);


test(
  "startup recovery completes an interrupted GridFS cleanup",
  async () => {
    // Simulate an image originally uploaded by Maya.
    const image = await storeTestImage();

    // The goal's proof has already been deleted,
    // but the durable cleanup job was left behind.
    await testDb.db
      .collection("maintenance.imageCleanup")
      .insertOne({
        imageId: image.id,
        createdAt: new Date(),
      });

    expect(
      await count("proofImages.files", {
        _id: image.id,
      }),
    ).toBe(1);

    expect(
      await count("maintenance.imageCleanup", {
        imageId: image.id,
      }),
    ).toBe(1);

    // Run the same recovery function used by main.ts.
    const recovery =
      await cleanupPendingGoalImages(testDb.db);

    expect(recovery.removed).toBe(1);
    expect(recovery.pending).toBe(0);

    expect(
      await count("proofImages.files", {
        _id: image.id,
      }),
    ).toBe(0);

    expect(
      await count("proofImages.chunks", {
        files_id: image.id,
      }),
    ).toBe(0);

    expect(
      await count("proofImageOwners", {
        _id: image.id,
      }),
    ).toBe(0);

    expect(
      await count("maintenance.imageCleanup", {
        imageId: image.id,
      }),
    ).toBe(0);

    // Recovery is safe to run again.
    const secondRecovery =
      await cleanupPendingGoalImages(testDb.db);

    expect(secondRecovery.removed).toBe(0);
    expect(secondRecovery.pending).toBe(0);
  },
);
