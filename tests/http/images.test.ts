
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
  handleImageRequest,
  imageEvidenceIsOwned,
  imageMimeType,
} from "../../src/http/images.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;

const owner = "maya";
const member = "alex";
const outsider = "charlie";

const ownerSession = "session-maya";
const memberSession = "session-alex";
const outsiderSession = "session-charlie";

const sessions: Record<string, string> = {
  [ownerSession]: owner,
  [memberSession]: member,
  [outsiderSession]: outsider,
};

type ProofDocument = {
  _id: string;
  submitter: string;
  goal: string;
  commitment: string;
  occurrence: Date;
  evidence: string[];
  createdAt: Date;
};

type AttemptDocument = ProofDocument & {
  previousProof: string;
};

async function invoke(
  path: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (path !== "/auth/current") {
    return { ok: false };
  }

  const account =
    typeof input.session === "string"
      ? sessions[input.session]
      : undefined;

  if (!account) {
    return {
      ok: false,
      error: "UNAUTHORIZED",
    };
  }

  return {
    ok: true,
    value: { account },
  };
}

const pngBytes = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 0,
]);

async function upload(
  session: string,
  bytes: Uint8Array = pngBytes,
  filename = "proof.png",
): Promise<Response> {
  const form = new FormData();

  form.set("session", session);

  form.set(
    "image",
    new File(
      [new Uint8Array(bytes)],
      filename,
      { type: "image/png" },
    ),
  );

  return handleImageRequest(
    new Request(
      "http://localhost/api/images/upload",
      {
        method: "POST",
        body: form,
      },
    ),
    invoke,
    testDb.db,
  );
}

async function uploadedToken(): Promise<string> {
  const response = await upload(ownerSession);

  expect(response.status).toBe(200);

  const body = await response.json() as {
    evidence: string;
  };

  expect(body.evidence).toMatch(
    /^image:[0-9a-f]{24}$/,
  );

  return body.evidence;
}

async function view(
  session: string,
  evidence: string,
): Promise<Response> {
  return handleImageRequest(
    new Request(
      "http://localhost/api/images/view",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session,
          evidence,
        }),
      },
    ),
    invoke,
    testDb.db,
  );
}

async function shareProof(
  proof: string,
  evidence: string[],
): Promise<void> {
  await testDb.db
    .collection<ProofDocument>(
      "proofVerifying.proofs",
    )
    .insertOne({
      _id: proof,
      submitter: owner,
      goal: "goal-1",
      commitment: "commitment-1",
      occurrence: new Date(),
      evidence,
      createdAt: new Date(),
    });

  await testDb.db
    .collection(
      "accountabilityGrouping.sharedProofs",
    )
    .insertOne({
      group: "group-1",
      proof,
      createdAt: new Date(),
    });
}

async function addMember(
  user: string,
): Promise<void> {
  await testDb.db
    .collection(
      "accountabilityGrouping.memberships",
    )
    .insertOne({
      group: "group-1",
      user,
      createdAt: new Date(),
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
  "recognizes image signatures and rejects non-images",
  () => {
    expect(
      imageMimeType(pngBytes),
    ).toBe("image/png");

    expect(
      imageMimeType(
        new TextEncoder().encode(
          "not an image",
        ),
      ),
    ).toBeNull();

    expect(
      imageMimeType(
        Uint8Array.from([
          255, 216, 255, 0,
        ]),
      ),
    ).toBe("image/jpeg");
  },
);

test(
  "requires authentication for upload",
  async () => {
    const response = await upload(
      "invalid-session",
    );

    expect(response.status).toBe(401);
  },
);

test(
  "rejects unsupported files",
  async () => {
    const response = await upload(
      ownerSession,
      new TextEncoder().encode(
        "PDF contents",
      ),
      "document.pdf",
    );

    expect(response.status).toBe(400);
  },
);

test(
  "rejects images larger than 5 MB",
  async () => {
    const oversized = new Uint8Array(
      5 * 1024 * 1024 + 1,
    );

    oversized.set(pngBytes, 0);

    const response = await upload(
      ownerSession,
      oversized,
    );

    expect(response.status).toBe(413);
  },
);

test(
  "upload is saved in GridFS and owner can view it",
  async () => {
    const token = await uploadedToken();

    const response = await view(
      ownerSession,
      token,
    );

    expect(response.status).toBe(200);

    expect(
      response.headers.get("Content-Type"),
    ).toBe("image/png");

    expect(
      new Uint8Array(
        await response.arrayBuffer(),
      ),
    ).toEqual(pngBytes);

    expect(
      response.headers.get("Cache-Control"),
    ).toBe("private, no-store");

    const id = new ObjectId(
      token.slice(6),
    );

    const stored = await testDb.db
      .collection("proofImages.files")
      .findOne({
        _id: id,
      });

    expect(stored).not.toBeNull();
  },
);

test(
  "an outsider cannot view an unshared image",
  async () => {
    const token = await uploadedToken();

    const response = await view(
      outsiderSession,
      token,
    );

    expect(response.status).toBe(403);
  },
);

test(
  "only current group members can view shared images",
  async () => {
    const token = await uploadedToken();

    await shareProof(
      "proof-1",
      [token],
    );

    await addMember(member);

    expect(
      (
        await view(
          memberSession,
          token,
        )
      ).status,
    ).toBe(200);

    expect(
      (
        await view(
          outsiderSession,
          token,
        )
      ).status,
    ).toBe(403);

    await testDb.db
      .collection(
        "accountabilityGrouping.memberships",
      )
      .deleteOne({
        group: "group-1",
        user: member,
      });

    expect(
      (
        await view(
          memberSession,
          token,
        )
      ).status,
    ).toBe(403);
  },
);

test(
  "deleted sharing references revoke group access",
  async () => {
    const token = await uploadedToken();

    await shareProof(
      "proof-1",
      [token],
    );

    await addMember(member);

    expect(
      await canViewImage(
        testDb.db,
        member,
        token,
      ),
    ).toBe(true);

    await testDb.db
      .collection(
        "accountabilityGrouping.sharedProofs",
      )
      .deleteMany({
        proof: "proof-1",
      });

    expect(
      await canViewImage(
        testDb.db,
        member,
        token,
      ),
    ).toBe(false);
  },
);

test(
  "a user cannot attach another user's image",
  async () => {
    const token = await uploadedToken();

    expect(
      await imageEvidenceIsOwned(
        invoke,
        outsiderSession,
        [token],
        testDb.db,
      ),
    ).toBe(false);

    expect(
      await imageEvidenceIsOwned(
        invoke,
        ownerSession,
        [token],
        testDb.db,
      ),
    ).toBe(true);
  },
);

test(
  "multiple images belong to the same owner",
  async () => {
    const tokens = [
      await uploadedToken(),
      await uploadedToken(),
      await uploadedToken(),
    ];

    expect(
      await imageEvidenceIsOwned(
        invoke,
        ownerSession,
        tokens,
        testDb.db,
      ),
    ).toBe(true);

    expect(
      await imageEvidenceIsOwned(
        invoke,
        outsiderSession,
        tokens,
        testDb.db,
      ),
    ).toBe(false);
  },
);

test(
  "rejects more than six image references",
  async () => {
    const tokens: string[] = [];

    for (let i = 0; i < 7; i++) {
      tokens.push(
        await uploadedToken(),
      );
    }

    expect(
      await imageEvidenceIsOwned(
        invoke,
        ownerSession,
        tokens,
        testDb.db,
      ),
    ).toBe(false);
  },
);

test(
  "rejects malformed image references",
  async () => {
    expect(
      await imageEvidenceIsOwned(
        invoke,
        ownerSession,
        ["image:not-an-object-id"],
        testDb.db,
      ),
    ).toBe(false);
  },
);

test(
  "a resubmitted proof image is visible to group members",
  async () => {
    const token = await uploadedToken();

    await testDb.db
      .collection<AttemptDocument>(
        "proofVerifying.attempts",
      )
      .insertOne({
        _id: "attempt-2",
        previousProof: "proof-1",
        submitter: owner,
        goal: "goal-1",
        commitment: "commitment-1",
        occurrence: new Date(),
        evidence: [token],
        createdAt: new Date(),
      });

    await testDb.db
      .collection(
        "accountabilityGrouping.sharedProofs",
      )
      .insertOne({
        group: "group-1",
        proof: "attempt-2",
        createdAt: new Date(),
      });

    await addMember(member);

    expect(
      (
        await view(
          memberSession,
          token,
        )
      ).status,
    ).toBe(200);
  },
);
