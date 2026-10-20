import {
  MongoServerError,
  type Collection,
  type Db,
} from "mongodb";

export class GroupNotFound extends Error {}
export class AlreadyMember extends Error {}
export class NotGroupMember extends Error {}
export class GoalAlreadyAttached extends Error {}
export class GoalNotAttached extends Error {}
export class ProofAlreadyShared extends Error {}
export class NotGroupOwner extends Error {}
export class InvalidGroupDetails extends Error {}

interface GroupDocument {
  _id: string;
  owner?: string;
  name: string;
  topic: string;
  visibility?: string;
  createdAt: Date;
}

interface MembershipDocument<User extends string> {
  _id: string;
  group: string;
  user: User;
  createdAt: Date;
}

interface GoalAttachmentDocument<Goal extends string> {
  _id: string;
  group: string;
  goal: Goal;
  createdAt: Date;
}

interface SharedProofDocument<Proof extends string> {
  _id: string;
  group: string;
  proof: Proof;
  createdAt: Date;
}

const readiness = new WeakMap<object, Promise<void>>();

// Serialize group mutations across instances using the same Db object.
// This protects the current single-process application from actions
// inserting memberships or sharing references during group deletion.
const mutationTails = new WeakMap<object, Promise<void>>();

async function withMutationLock<T>(
  db: Db,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = mutationTails.get(db) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  const tail = previous.then(() => current);
  mutationTails.set(db, tail);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (mutationTails.get(db) === tail) {
      mutationTails.delete(db);
    }
  }
}

function validateDetails(
  name: string,
  topic: string,
  visibility: string,
) {
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 100 ||
    typeof topic !== "string" ||
    topic.trim().length === 0 ||
    topic.trim().length > 500 ||
    (visibility !== "public" && visibility !== "private")
  ) {
    throw new InvalidGroupDetails(
      "Enter a name of 1–100 characters, a topic of 1–500 characters, and public or private visibility.",
    );
  }
}

function ensureReady<
  User extends string,
  Goal extends string,
  Proof extends string,
>(
  memberships: Collection<MembershipDocument<User>>,
  goalAttachments: Collection<GoalAttachmentDocument<Goal>>,
  sharedProofs: Collection<SharedProofDocument<Proof>>,
) {
  let ready = readiness.get(memberships);

  if (!ready) {
    ready = Promise.all([
      memberships.createIndex(
        { group: 1, user: 1 },
        { unique: true },
      ),
      goalAttachments.createIndex(
        { goal: 1 },
        { unique: true },
      ),
      sharedProofs.createIndex(
        { group: 1, proof: 1 },
        { unique: true },
      ),
    ]).then(() => undefined);

    readiness.set(memberships, ready);
  }

  return ready;
}

export class AccountabilityGroupingConcept<
  User extends string,
  Goal extends string,
  Proof extends string,
> {
  private readonly groups: Collection<GroupDocument>;
  private readonly memberships: Collection<MembershipDocument<User>>;
  private readonly goalAttachments: Collection<GoalAttachmentDocument<Goal>>;
  private readonly sharedProofs: Collection<SharedProofDocument<Proof>>;

  constructor(private readonly db: Db) {
    this.groups = db.collection<GroupDocument>(
      "accountabilityGrouping.groups",
    );

    this.memberships = db.collection<MembershipDocument<User>>(
      "accountabilityGrouping.memberships",
    );

    this.goalAttachments =
      db.collection<GoalAttachmentDocument<Goal>>(
        "accountabilityGrouping.goalAttachments",
      );

    this.sharedProofs = db.collection<SharedProofDocument<Proof>>(
      "accountabilityGrouping.sharedProofs",
    );
  }

  #ready() {
    return ensureReady(
      this.memberships,
      this.goalAttachments,
      this.sharedProofs,
    );
  }

  async #ownerOf(group: GroupDocument): Promise<string> {
    if (group.owner !== undefined) return group.owner;

    // Compatibility with groups created before ownership was stored.
    // The old createGroup action inserted the creator's membership first.
    const firstMember = await this.memberships.findOne(
      { group: group._id },
      { sort: { createdAt: 1 } },
    );

    return firstMember?.user ?? "";
  }

  async createGroup({
    owner,
    name,
    topic,
    visibility = "private",
  }: {
    owner: User;
    name: string;
    topic: string;
    visibility?: string;
  }) {
    validateDetails(name, topic, visibility);

    return withMutationLock(this.db, async () => {
      await this.#ready();

      const group = crypto.randomUUID();
      const createdAt = new Date();

      await this.groups.insertOne({
        _id: group,
        owner,
        name: name.trim(),
        topic: topic.trim(),
        visibility,
        createdAt,
      });

      await this.memberships.insertOne({
        _id: crypto.randomUUID(),
        group,
        user: owner,
        createdAt,
      });

      return { group };
    });
  }

  async updateGroup({
    group,
    owner,
    name,
    topic,
    visibility,
  }: {
    group: string;
    owner: User;
    name: string;
    topic: string;
    visibility: string;
  }) {
    return withMutationLock(this.db, async () => {
      const found = await this.groups.findOne({ _id: group });

      if (!found) {
        throw new GroupNotFound("There is no such group.");
      }

      if ((await this.#ownerOf(found)) !== owner) {
        throw new NotGroupOwner(
          "Only the group owner can change or delete this group.",
        );
      }

      validateDetails(name, topic, visibility);

      await this.groups.updateOne(
        { _id: group },
        {
          $set: {
            owner,
            name: name.trim(),
            topic: topic.trim(),
            visibility,
          },
        },
      );

      return { group };
    });
  }

  async deleteGroup({
    group,
    owner,
  }: {
    group: string;
    owner: User;
  }) {
    return withMutationLock(this.db, async () => {
      const found = await this.groups.findOne({ _id: group });

      if (!found) {
        throw new GroupNotFound("There is no such group.");
      }

      if ((await this.#ownerOf(found)) !== owner) {
        throw new NotGroupOwner(
          "Only the group owner can change or delete this group.",
        );
      }

      // Only data owned by AccountabilityGrouping is removed.
      await this.sharedProofs.deleteMany({ group });
      await this.goalAttachments.deleteMany({ group });
      await this.memberships.deleteMany({ group });
      await this.groups.deleteOne({ _id: group });

      return { group };
    });
  }

  async joinGroup({
    group,
    user,
  }: {
    group: string;
    user: User;
  }) {
    return withMutationLock(this.db, async () => {
      await this.#ready();

      const found = await this.groups.findOne({ _id: group });

      if (!found) {
        throw new GroupNotFound("There is no such group.");
      }

      try {
        await this.memberships.insertOne({
          _id: crypto.randomUUID(),
          group,
          user,
          createdAt: new Date(),
        });
      } catch (error) {
        if (
          error instanceof MongoServerError &&
          error.code === 11000
        ) {
          throw new AlreadyMember(
            "This user is already a member of this group.",
          );
        }

        throw error;
      }

      return { group };
    });
  }

  async attachGoal({
    group,
    user,
    goal,
  }: {
    group: string;
    user: User;
    goal: Goal;
  }) {
    return withMutationLock(this.db, async () => {
      await this.#ready();

      const found = await this.groups.findOne({ _id: group });

      if (!found) {
        throw new GroupNotFound("There is no such group.");
      }

      const membership = await this.memberships.findOne({
        group,
        user,
      });

      if (!membership) {
        throw new NotGroupMember(
          "This user is not a member of this group.",
        );
      }

      try {
        await this.goalAttachments.insertOne({
          _id: crypto.randomUUID(),
          group,
          goal,
          createdAt: new Date(),
        });
      } catch (error) {
        if (
          error instanceof MongoServerError &&
          error.code === 11000
        ) {
          throw new GoalAlreadyAttached(
            "This goal is already attached to an accountability group.",
          );
        }

        throw error;
      }

      return { group };
    });
  }

  async shareProof({
    goal,
    proof,
  }: {
    goal: Goal;
    proof: Proof;
  }) {
    return withMutationLock(this.db, async () => {
      await this.#ready();

      const attachment = await this.goalAttachments.findOne({
        goal,
      });

      if (!attachment) {
        throw new GoalNotAttached(
          "This goal is not attached to an accountability group.",
        );
      }

      try {
        await this.sharedProofs.insertOne({
          _id: crypto.randomUUID(),
          group: attachment.group,
          proof,
          createdAt: new Date(),
        });
      } catch (error) {
        if (
          error instanceof MongoServerError &&
          error.code === 11000
        ) {
          throw new ProofAlreadyShared(
            "This proof has already been shared with this group.",
          );
        }

        throw error;
      }

      return { group: attachment.group };
    });
  }

  async unshareProof({ proof }: { proof: Proof }) {
    return withMutationLock(this.db, async () => {
      await this.sharedProofs.deleteMany({ proof });
      return { proof };
    });
  }

  async checkMember({
    goal,
    user,
  }: {
    goal: Goal;
    user: User;
  }) {
    const attachment = await this.goalAttachments.findOne({
      goal,
    });

    if (!attachment) {
      throw new GoalNotAttached(
        "This goal is not attached to an accountability group.",
      );
    }

    const membership = await this.memberships.findOne({
      group: attachment.group,
      user,
    });

    if (!membership) {
      throw new NotGroupMember(
        "This user is not a member of this group.",
      );
    }

    return { group: attachment.group };
  }

  async _group({ group }: { group: string }) {
    const found = await this.groups.findOne({ _id: group });

    if (!found) return [];

    return [{
      name: found.name,
      topic: found.topic,
    }];
  }

  async _groupSettings({ group }: { group: string }) {
    const found = await this.groups.findOne({ _id: group });

    if (!found) return [];

    return [{
      owner: await this.#ownerOf(found),
      name: found.name,
      topic: found.topic,
      visibility:
        found.visibility === "public" ? "public" : "private",
    }];
  }

  async _publicGroups({ search }: { search: string }) {
    const text =
      typeof search === "string"
        ? search.trim().slice(0, 100)
        : "";

    // Escape regular expression syntax: search is literal text.
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");

    const groups = await this.groups
      .find({
        visibility: "public",
        $or: [
          { name: pattern },
          { topic: pattern },
        ],
      })
      .sort({ createdAt: -1, _id: 1 })
      .limit(50)
      .toArray();

    return groups.map((group) => ({
      group: group._id,
      name: group.name,
      topic: group.topic,
    }));
  }

  async _groupsForUser({ user }: { user: User }) {
    const memberships = await this.memberships
      .find({ user })
      .sort({ createdAt: 1 })
      .toArray();

    const rows = [];

    for (const membership of memberships) {
      const group = await this.groups.findOne({
        _id: membership.group,
      });

      if (group) {
        rows.push({
          group: group._id,
          name: group.name,
          topic: group.topic,
        });
      }
    }

    return rows;
  }

  async _members({ group }: { group: string }) {
    const memberships = await this.memberships
      .find({ group })
      .sort({ createdAt: 1 })
      .toArray();

    return memberships.map((membership) => ({
      user: membership.user,
    }));
  }

  async _groupForGoal({ goal }: { goal: Goal }) {
    const attachment = await this.goalAttachments.findOne({
      goal,
    });

    if (!attachment) return [];

    return [{ group: attachment.group }];
  }

  async _sharedProofs({ group }: { group: string }) {
    const proofs = await this.sharedProofs
      .find({ group })
      .sort({ createdAt: 1 })
      .toArray();

    return proofs.map((proof) => ({
      proof: proof.proof,
    }));
  }
}
