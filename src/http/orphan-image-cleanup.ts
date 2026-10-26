
import {
  GridFSBucket,
  ObjectId,
  type Db,
} from "mongodb";

const MAX_BATCH = 100;
const DEFAULT_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

type GridFSFile = {
  _id: ObjectId;
  uploadDate: Date;
};

type ImageOwner = {
  _id: ObjectId;
  owner: string;
  contentType: string;
};

export type OrphanCleanupResult = {
  scanned: number;
  removed: number;
  retained: number;
  failed: number;
};

export async function cleanupOrphanImages(
  database: Db,
  options: {
    now?: Date;
    maxAgeMs?: number;
    batchSize?: number;
  } = {},
): Promise<OrphanCleanupResult> {
  const now = options.now ?? new Date();

  const maxAgeMs =
    options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  const batchSize = Math.min(
    Math.max(options.batchSize ?? MAX_BATCH, 1),
    MAX_BATCH,
  );

  if (
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs < 0
  ) {
    throw new Error("Invalid image cleanup age");
  }

  const cutoff = new Date(
    now.getTime() - maxAgeMs,
  );

  const files = database.collection<GridFSFile>(
    "proofImages.files",
  );

  const owners = database.collection<ImageOwner>(
    "proofImageOwners",
  );

  const proofs = database.collection(
    "proofVerifying.proofs",
  );

  const attempts = database.collection(
    "proofVerifying.attempts",
  );

  const bucket = new GridFSBucket(database, {
    bucketName: "proofImages",
  });

  const candidates = await files
    .find({
      uploadDate: { $lt: cutoff },
    })
    .sort({ uploadDate: 1 })
    .limit(batchSize)
    .toArray();

  const result: OrphanCleanupResult = {
    scanned: candidates.length,
    removed: 0,
    retained: 0,
    failed: 0,
  };

  for (const file of candidates) {
    const id = file._id;
    const token = `image:${id.toHexString()}`;

    try {
      // Never clean up an untracked GridFS file
      // through this maintenance routine.
      const owner = await owners.findOne({
        _id: id,
      });

      if (!owner) {
        result.retained += 1;
        continue;
      }

      const original = await proofs.findOne({
        evidence: token,
      });

      const attempt = await attempts.findOne({
        evidence: token,
      });

      if (original || attempt) {
        result.retained += 1;
        continue;
      }

      // Recheck before deletion in case the proof
      // was attached during the earlier queries.
      const stillReferenced =
        (await proofs.findOne({
          evidence: token,
        })) !== null ||
        (await attempts.findOne({
          evidence: token,
        })) !== null;

      if (stillReferenced) {
        result.retained += 1;
        continue;
      }

      await bucket.delete(id);

      await owners.deleteOne({
        _id: id,
      });

      result.removed += 1;
    } catch (error) {
      result.failed += 1;

      console.error(
        "[image-cleanup] Failed:",
        id.toHexString(),
        error,
      );
    }
  }

  return result;
}
