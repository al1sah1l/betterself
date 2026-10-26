
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { ObjectId } from "mongodb";

import {
  canViewImage,
} from "../../src/http/images.ts";

import {
  handleResourceManagementRequest,
} from "../../src/http/resource-management.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;

type StringIdDocument = {
  _id: string;
  [key: string]: unknown;
};

const sessions: Record<string, string> = {
  "maya-session": "maya",
  "alex-session": "alex",
  "charlie-session": "charlie",
};

async function invoke(
  path: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (path !== "/auth/current") {
    return { ok: false };
  }

  const session =
    typeof input.session === "string"
      ? input.session
      : "";

  const account = sessions[session];

  return account
    ? {
        ok: true,
        value: { account },
      }
    : { ok: false };
}

async function leave(
  session: string,
  group: string,
): Promise<Response> {
  return handleResourceManagementRequest(
    new Request(
      "http://localhost/api/groups/leave",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session,
          group,
        }),
      },
    ),
    invoke,
    testDb.db,
  );
}

async function setupGroupImage(): Promise<{
  imageId: ObjectId;
  token: string;
}> {
  const imageId = new ObjectId();
  const token = `image:${imageId.toHexString()}`;

  await testDb.db
    .collection<StringIdDocument>(
      "accountabilityGrouping.groups",
    )
    .insertOne({
      _id: "group-1",
      owner: "maya",
      name: "Accountability group",
      topic: "Learning",
      visibility: "private",
      createdAt: new Date(),
    });

  for (const user of ["maya", "alex"]) {
    await testDb.db
      .collection<StringIdDocument>(
        "accountabilityGrouping.memberships",
      )
      .insertOne({
        _id: `membership-${user}`,
        group: "group-1",
        user,
        createdAt: new Date(),
      });
  }

  await testDb.db
    .collection<StringIdDocument>(
      "goalPlanning.goals",
    )
    .insertOne({
      _id: "goal-maya",
      owner: "maya",
      outcome: "Finish course project",
      currentContext: "Starting",
      constraints: "Limited time",
      timeline: "October",
      successDefinition: "Submitted",
      createdAt: new Date(),
    });

  await testDb.db
    .collection<StringIdDocument>(
      "accountabilityGrouping.goalAttachments",
    )
    .insertOne({
      _id: "attachment-1",
      group: "group-1",
      goal: "goal-maya",
      createdAt: new Date(),
    });

  await testDb.db
    .collection<StringIdDocument>(
      "proofVerifying.proofs",
    )
    .insertOne({
      _id: "proof-maya",
      submitter: "maya",
      goal: "goal-maya",
      commitment: "commitment-1",
      evidence: [
        "Finished my work",
        token,
      ],
      occurrence: new Date(),
      createdAt: new Date(),
    });

  await testDb.db
    .collection<StringIdDocument>(
      "accountabilityGrouping.sharedProofs",
    )
    .insertOne({
      _id: "share-1",
      group: "group-1",
      proof: "proof-maya",
      createdAt: new Date(),
    });

  await testDb.db
    .collection("proofImageOwners")
    .insertOne({
      _id: imageId,
      owner: "maya",
      contentType: "image/png",
    });

  return { imageId, token };
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
  "the image owner can view their own evidence",
  async () => {
    const { token } = await setupGroupImage();

    expect(
      await canViewImage(
        testDb.db,
        "maya",
        token,
      ),
    ).toBe(true);
  },
);

test(
  "a member can view an image shared with their group",
  async () => {
    const { token } = await setupGroupImage();

    expect(
      await canViewImage(
        testDb.db,
        "alex",
        token,
      ),
    ).toBe(true);
  },
);

test(
  "a nonmember cannot view group evidence",
  async () => {
    const { token } = await setupGroupImage();

    expect(
      await canViewImage(
        testDb.db,
        "charlie",
        token,
      ),
    ).toBe(false);
  },
);

test(
  "leaving a group immediately revokes image access",
  async () => {
    const { token } = await setupGroupImage();

    expect(
      await canViewImage(
        testDb.db,
        "alex",
        token,
      ),
    ).toBe(true);

    const response = await leave(
      "alex-session",
      "group-1",
    );

    expect(response.status).toBe(200);

    expect(
      await canViewImage(
        testDb.db,
        "alex",
        token,
      ),
    ).toBe(false);

    // The owner must retain access.
    expect(
      await canViewImage(
        testDb.db,
        "maya",
        token,
      ),
    ).toBe(true);
  },
);

test(
  "unsharing a proof revokes member access",
  async () => {
    const { token } = await setupGroupImage();

    await testDb.db
      .collection(
        "accountabilityGrouping.sharedProofs",
      )
      .deleteMany({
        proof: "proof-maya",
      });

    expect(
      await canViewImage(
        testDb.db,
        "alex",
        token,
      ),
    ).toBe(false);

    expect(
      await canViewImage(
        testDb.db,
        "maya",
        token,
      ),
    ).toBe(true);
  },
);

test(
  "image access is denied after removing ownership metadata",
  async () => {
    const { imageId, token } =
      await setupGroupImage();

    await testDb.db
      .collection("proofImageOwners")
      .deleteOne({
        _id: imageId,
      });

    expect(
      await canViewImage(
        testDb.db,
        "maya",
        token,
      ),
    ).toBe(false);

    expect(
      await canViewImage(
        testDb.db,
        "alex",
        token,
      ),
    ).toBe(false);
  },
);

test(
  "invalid image tokens are rejected",
  async () => {
    await setupGroupImage();

    for (const token of [
      "",
      "image:invalid",
      "image:123",
      "image:../../secret",
      "https://example.com/image.png",
    ]) {
      expect(
        await canViewImage(
          testDb.db,
          "maya",
          token,
        ),
      ).toBe(false);
    }
  },
);

test(
  "a guessed image token does not grant access",
  async () => {
    await setupGroupImage();

    const nonexistentToken =
      `image:${new ObjectId().toHexString()}`;

    expect(
      await canViewImage(
        testDb.db,
        "alex",
        nonexistentToken,
      ),
    ).toBe(false);
  },
);
