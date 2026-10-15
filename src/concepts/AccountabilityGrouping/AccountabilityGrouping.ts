import { MongoServerError, type Collection, type Db } from "mongodb";

export class GroupNotFound extends Error {}
export class AlreadyMember extends Error {}
export class NotGroupMember extends Error {}
export class GoalAlreadyAttached extends Error {}
export class GoalNotAttached extends Error {}
export class ProofAlreadyShared extends Error {}

interface GroupDocument {
  _id: string;
  name: string;
  topic: string;
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

function ensureReady<User extends string, Goal extends string, Proof extends string>(
  memberships: Collection<MembershipDocument<User>>,
  goalAttachments: Collection<GoalAttachmentDocument<Goal>>,
  sharedProofs: Collection<SharedProofDocument<Proof>>,
) {
  let ready = readiness.get(memberships);

  if (!ready) {
    ready = Promise.all([
      memberships.createIndex({ group: 1, user: 1 }, { unique: true }),
      goalAttachments.createIndex({ goal: 1 }, { unique: true }),
      sharedProofs.createIndex({ group: 1, proof: 1 }, { unique: true }),
    ]).then(() => undefined);

    readiness.set(memberships, ready);
  }

  return ready;
}

export class AccountabilityGroupingConcept<
  User extends string,
  Goal extends string,
  Proof extends string
> {
  private readonly groups: Collection<GroupDocument>;
  private readonly memberships: Collection<MembershipDocument<User>>;
  private readonly goalAttachments: Collection<GoalAttachmentDocument<Goal>>;
  private readonly sharedProofs: Collection<SharedProofDocument<Proof>>;

  constructor(db: Db) {
    this.groups = db.collection<GroupDocument>("accountabilityGrouping.groups");
    this.memberships = db.collection<MembershipDocument<User>>("accountabilityGrouping.memberships");
    this.goalAttachments = db.collection<GoalAttachmentDocument<Goal>>("accountabilityGrouping.goalAttachments");
    this.sharedProofs = db.collection<SharedProofDocument<Proof>>("accountabilityGrouping.sharedProofs");
  }

  async createGroup({ owner, name, topic }: { owner: User; name: string; topic: string }) {
    await ensureReady(this.memberships, this.goalAttachments, this.sharedProofs);

    const group = crypto.randomUUID();
    const createdAt = new Date();

    await this.groups.insertOne({ _id: group, name, topic, createdAt });
    await this.memberships.insertOne({ _id: crypto.randomUUID(), group, user: owner, createdAt });

    return { group };
  }

  async joinGroup({ group, user }: { group: string; user: User }) {
    await ensureReady(this.memberships, this.goalAttachments, this.sharedProofs);

    const existingGroup = await this.groups.findOne({ _id: group });
    if (!existingGroup) throw new GroupNotFound("There is no such group.");

    try {
      await this.memberships.insertOne({ _id: crypto.randomUUID(), group, user, createdAt: new Date() });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AlreadyMember("This user is already a member of this group.");
      }
      throw error;
    }

    return { group };
  }

  async attachGoal({ group, user, goal }: { group: string; user: User; goal: Goal }) {
    await ensureReady(this.memberships, this.goalAttachments, this.sharedProofs);

    const existingGroup = await this.groups.findOne({ _id: group });
    if (!existingGroup) throw new GroupNotFound("There is no such group.");

    const membership = await this.memberships.findOne({ group, user });
    if (!membership) throw new NotGroupMember("This user is not a member of this group.");

    try {
      await this.goalAttachments.insertOne({ _id: crypto.randomUUID(), group, goal, createdAt: new Date() });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new GoalAlreadyAttached("This goal is already attached to an accountability group.");
      }
      throw error;
    }

    return { group };
  }

  async shareProof({ goal, proof }: { goal: Goal; proof: Proof }) {
    await ensureReady(this.memberships, this.goalAttachments, this.sharedProofs);

    const attachment = await this.goalAttachments.findOne({ goal });
    if (!attachment) throw new GoalNotAttached("This goal is not attached to an accountability group.");

    try {
      await this.sharedProofs.insertOne({
        _id: crypto.randomUUID(),
        group: attachment.group,
        proof,
        createdAt: new Date(),
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ProofAlreadyShared("This proof has already been shared with this group.");
      }
      throw error;
    }

    return { group: attachment.group };
  }

  async unshareProof({ proof }: { proof: Proof }) {
    await this.sharedProofs.deleteMany({ proof });

    return { proof };
  }

  async checkMember({ goal, user }: { goal: Goal; user: User }) {
    const attachment = await this.goalAttachments.findOne({ goal });
    if (!attachment) throw new GoalNotAttached("This goal is not attached to an accountability group.");

    const membership = await this.memberships.findOne({ group: attachment.group, user });
    if (!membership) throw new NotGroupMember("This user is not a member of this group.");

    return { group: attachment.group };
  }

  async _group({ group }: { group: string }) {
    const found = await this.groups.findOne({ _id: group });
    if (!found) return [];

    return [{ name: found.name, topic: found.topic }];
  }

  async _groupsForUser({ user }: { user: User }) {
    const memberships = await this.memberships.find({ user }).sort({ createdAt: 1 }).toArray();
    const rows = [];

    for (const membership of memberships) {
      const group = await this.groups.findOne({ _id: membership.group });

      if (group) {
        rows.push({ group: group._id, name: group.name, topic: group.topic });
      }
    }

    return rows;
  }

  async _members({ group }: { group: string }) {
    const memberships = await this.memberships.find({ group }).sort({ createdAt: 1 }).toArray();
    return memberships.map((membership) => ({ user: membership.user }));
  }

  async _groupForGoal({ goal }: { goal: Goal }) {
    const attachment = await this.goalAttachments.findOne({ goal });
    if (!attachment) return [];

    return [{ group: attachment.group }];
  }

  async _sharedProofs({ group }: { group: string }) {
    const proofs = await this.sharedProofs.find({ group }).sort({ createdAt: 1 }).toArray();
    return proofs.map((proof) => ({ proof: proof.proof }));
  }
}
