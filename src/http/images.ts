
import {
  GridFSBucket,
  ObjectId,
  type Db,
} from "mongodb";

import { db as appDb } from "../db.ts";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES_PER_PROOF = 6;
const imagePattern = /^image:([0-9a-f]{24})$/;

type Invoker = (
  path: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

type StoredImage = {
  _id: ObjectId;
  owner: string;
  contentType: string;
};

type ProofRow = {
  _id: string;
  evidence: string[];
};

function failure(code: string, status: number): Response {
  return Response.json({ error: code }, { status });
}

function collection(database: Db) {
  return database.collection<StoredImage>(
    "proofImageOwners",
  );
}

async function currentAccount(
  invoke: Invoker,
  session: unknown,
): Promise<string | null> {
  if (typeof session !== "string" || !session) {
    return null;
  }

  try {
    const response = await invoke(
      "/auth/current",
      { session },
    ) as {
      ok?: boolean;
      value?: { account?: string };
    };

    return response.ok === true &&
      typeof response.value?.account === "string"
      ? response.value.account
      : null;
  } catch {
    return null;
  }
}

export function imageMimeType(
  bytes: Uint8Array,
): string | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10]
      .every((value, index) => bytes[index] === value)
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(
      String.fromCharCode(...bytes.subarray(0, 6)),
    )
  ) {
    return "image/gif";
  }

  return null;
}

/**
 * Used by the gateway before submitProof/resubmitProof.
 * Every image token must exist and belong to the submitter.
 */
export async function imageEvidenceIsOwned(
  invoke: Invoker,
  session: unknown,
  evidence: unknown,
  database: Db = appDb,
): Promise<boolean> {
  if (!Array.isArray(evidence)) {
    return false;
  }

  const tokens = evidence.filter(
    (item): item is string =>
      typeof item === "string" &&
      item.startsWith("image:"),
  );

  if (tokens.length > MAX_IMAGES_PER_PROOF) {
    return false;
  }

  if (tokens.length === 0) {
    return true;
  }

  const user = await currentAccount(invoke, session);

  if (!user) return false;

  for (const token of tokens) {
    const match = imagePattern.exec(token);

    if (!match) return false;

    const image = await collection(database).findOne({
      _id: new ObjectId(match[1]),
      owner: user,
    });

    if (!image) return false;
  }

  return true;
}

/**
 * An author may view their uploaded image.
 * Group members may view it only when the image
 * is referenced by a proof currently shared with them.
 */
export async function canViewImage(
  database: Db,
  user: string,
  token: string,
): Promise<boolean> {
  const match = imagePattern.exec(token);

  if (!match) return false;

  const stored = await collection(database).findOne({
    _id: new ObjectId(match[1]),
  });

  if (!stored) return false;

  if (stored.owner === user) return true;

  const proofs = database.collection<ProofRow>(
    "proofVerifying.proofs",
  );

  const attempts = database.collection<ProofRow>(
    "proofVerifying.attempts",
  );

  const [originals, retries] = await Promise.all([
    proofs.find({ evidence: token }).toArray(),
    attempts.find({ evidence: token }).toArray(),
  ]);

  const proofIds = [...originals, ...retries]
    .map((proof) => proof._id);

  if (!proofIds.length) return false;

  const shared = await database
    .collection<{
      group: string;
      proof: string;
    }>("accountabilityGrouping.sharedProofs")
    .find({
      proof: { $in: proofIds },
    })
    .toArray();

  const groups = shared.map((item) => item.group);

  if (!groups.length) return false;

  const membership = await database
    .collection<{
      user: string;
      group: string;
    }>("accountabilityGrouping.memberships")
    .findOne({
      user,
      group: { $in: groups },
    });

  return membership !== null;
}

export async function handleImageRequest(
  request: Request,
  invoke: Invoker,
  database: Db = appDb,
): Promise<Response> {
  if (request.method !== "POST") {
    return failure("METHOD_NOT_ALLOWED", 405);
  }

  const path = new URL(request.url).pathname;

  if (path === "/api/images/upload") {
    const lengthHeader =
      request.headers.get("content-length");

    if (
      lengthHeader &&
      Number(lengthHeader) > MAX_IMAGE_SIZE + 100_000
    ) {
      return failure("IMAGE_TOO_LARGE", 413);
    }

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      return failure("INVALID_REQUEST", 400);
    }

    const user = await currentAccount(
      invoke,
      form.get("session"),
    );

    if (!user) {
      return failure("UNAUTHORIZED", 401);
    }

    const file = form.get("image");

    if (!(file instanceof File)) {
      return failure("INVALID_REQUEST", 400);
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return failure("IMAGE_TOO_LARGE", 413);
    }

    const bytes = new Uint8Array(
      await file.arrayBuffer(),
    );

    const mime = imageMimeType(bytes);

    if (!mime) {
      return failure("UNSUPPORTED_IMAGE", 400);
    }

    const bucket = new GridFSBucket(database, {
      bucketName: "proofImages",
    });

    const id = new ObjectId();

    try {
      const stream = bucket.openUploadStreamWithId(
        id,
        "proof-image",
        {
          metadata: {
            owner: user,
            contentType: mime,
          },
        },
      );

      await new Promise<void>((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
        stream.end(Buffer.from(bytes));
      });

      await collection(database).insertOne({
        _id: id,
        owner: user,
        contentType: mime,
      });
    } catch {
      // Prevent retaining a completed GridFS file
      // if its ownership record could not be saved.
      try {
        await bucket.delete(id);
      } catch {
        // The upload may not have created a file.
      }

      return failure("UPLOAD_FAILED", 500);
    }

    return Response.json({
      evidence: `image:${id.toHexString()}`,
    });
  }

  if (path === "/api/images/view") {
    let input: {
      session?: unknown;
      evidence?: unknown;
    };

    try {
      input = await request.json();
    } catch {
      return failure("INVALID_REQUEST", 400);
    }

    const user = await currentAccount(
      invoke,
      input.session,
    );

    if (!user) {
      return failure("UNAUTHORIZED", 401);
    }

    const token = input.evidence;

    if (
      typeof token !== "string" ||
      !imagePattern.test(token)
    ) {
      return failure("INVALID_REQUEST", 400);
    }

    const allowed = await canViewImage(
      database,
      user,
      token,
    );

    if (!allowed) {
      return failure("FORBIDDEN", 403);
    }

    const id = new ObjectId(
      imagePattern.exec(token)![1],
    );

    const image = await collection(database).findOne({
      _id: id,
    });

    if (!image) {
      return failure("NOT_FOUND", 404);
    }

    const bucket = new GridFSBucket(database, {
      bucketName: "proofImages",
    });

    try {
      const chunks: Buffer[] = [];

      for await (
        const chunk of bucket.openDownloadStream(id)
      ) {
        chunks.push(Buffer.from(chunk));
      }

      return new Response(
        Buffer.concat(chunks),
        {
          headers: {
            "Content-Type": image.contentType,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy":
              "default-src 'none'; sandbox",
          },
        },
      );
    } catch {
      return failure("NOT_FOUND", 404);
    }
  }

  return failure("NOT_FOUND", 404);
}
