
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import {
  GridFSBucket,
  ObjectId,
} from "mongodb";

import {
  cleanupOrphanImages,
} from "../../src/http/orphan-image-cleanup.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;

const NOW = new Date("2026-10-26T18:00:00.000Z");

const OLD_DATE =
  new Date("2026-10-24T18:00:00.000Z");

const RECENT_DATE =
  new Date("2026-10-26T17:00:00.000Z");

async function upload(
  uploadDate: Date,
): Promise<{
  id: ObjectId;
  token: string;
}> {
  const bucket = new GridFSBucket(
    testDb.db,
    { bucketName: "proofImages" },
  );

  const id = new ObjectId();

  const stream = bucket.openUploadStreamWithId(
    id,
    "test-image.png",
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
    stream.end(Buffer.from("test-image"));
  });

  await testDb.db
    .collection("proofImages.files")
    .updateOne(
      { _id: id },
      { $set: { uploadDate } },
    );

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

async function fileExists(
  id: ObjectId,
): Promise<boolean> {
  const file = await testDb.db
    .collection("proofImages.files")
    .findOne({ _id: id });

  return file !== null;
}

async function ownerExists(
  id: ObjectId,
): Promise<boolean> {
  const owner = await testDb.db
    .collection("proofImageOwners")
    .findOne({ _id: id });

  return owner !== null;
}

async function addProof(
  token: string,
  collectionName:
    | "proofVerifying.proofs"
    | "proofVerifying.attempts",
): Promise<void> {
  await testDb.db
    .collection<{
      _id: string;
      goal: string;
      submitter: string;
      evidence: string[];
    }>(collectionName)
    .insertOne({
      _id: `proof-${new ObjectId().toHexString()}`,
      goal: "goal-1",
      submitter: "maya",
      evidence: [token],
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
  "removes old unreferenced images",
  async () => {
    const image = await upload(OLD_DATE);

    const result = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    expect(result.removed).toBe(1);
    expect(result.failed).toBe(0);

    expect(await fileExists(image.id)).toBe(false);
    expect(await ownerExists(image.id)).toBe(false);

    expect(
      await testDb.db
        .collection("proofImages.chunks")
        .countDocuments({
          files_id: image.id,
        }),
    ).toBe(0);
  },
);

test(
  "keeps recently uploaded images",
  async () => {
    const image = await upload(RECENT_DATE);

    const result = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    expect(result.removed).toBe(0);
    expect(await fileExists(image.id)).toBe(true);
    expect(await ownerExists(image.id)).toBe(true);
  },
);

test(
  "keeps images referenced by original proofs",
  async () => {
    const image = await upload(OLD_DATE);

    await addProof(
      image.token,
      "proofVerifying.proofs",
    );

    const result = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    expect(result.removed).toBe(0);
    expect(result.retained).toBe(1);

    expect(await fileExists(image.id)).toBe(true);
    expect(await ownerExists(image.id)).toBe(true);
  },
);

test(
  "keeps images referenced by resubmissions",
  async () => {
    const image = await upload(OLD_DATE);

    await addProof(
      image.token,
      "proofVerifying.attempts",
    );

    const result = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    expect(result.removed).toBe(0);
    expect(await fileExists(image.id)).toBe(true);
  },
);

test(
  "deletes only abandoned images from a mixed batch",
  async () => {
    const abandoned = await upload(OLD_DATE);
    const referenced = await upload(OLD_DATE);
    const recent = await upload(RECENT_DATE);

    await addProof(
      referenced.token,
      "proofVerifying.proofs",
    );

    const result = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    expect(result.removed).toBe(1);
    expect(result.failed).toBe(0);

    expect(await fileExists(abandoned.id)).toBe(false);
    expect(await fileExists(referenced.id)).toBe(true);
    expect(await fileExists(recent.id)).toBe(true);
  },
);

test(
  "cleanup is idempotent",
  async () => {
    const image = await upload(OLD_DATE);

    const first = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    const second = await cleanupOrphanImages(
      testDb.db,
      { now: NOW },
    );

    expect(first.removed).toBe(1);
    expect(second.removed).toBe(0);
    expect(await fileExists(image.id)).toBe(false);
  },
);

test(
  "respects the maximum batch size",
  async () => {
    for (let i = 0; i < 3; i++) {
      await upload(OLD_DATE);
    }

    const first = await cleanupOrphanImages(
      testDb.db,
      {
        now: NOW,
        batchSize: 2,
      },
    );

    expect(first.scanned).toBe(2);
    expect(first.removed).toBe(2);

    const second = await cleanupOrphanImages(
      testDb.db,
      {
        now: NOW,
        batchSize: 2,
      },
    );

    expect(second.removed).toBe(1);
  },
);
