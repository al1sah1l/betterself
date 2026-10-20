import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";

import {
  Register,
  SignIn,
  CurrentUser,
  SignOut,
} from "./compositions/authentication.ts";

import {
  CreateGoal,
  SetStrategy,
} from "./compositions/goals.ts";

import {
  CreateCommitment,
} from "./compositions/comitments.ts";

import {
  SubmitProof,
  DeletePendingProof,
} from "./compositions/proofs.ts";

import {
  CreateGroup,
  JoinGroup,
  AttachGoal,
} from "./compositions/groups.ts";

import {
  RecordCompletionFromProof,
} from "./compositions/completion.ts";

import {
  ShareProofWithGroup,
  UnshareDeletedProof,
} from "./compositions/proof-sharing.ts";

import {
  ReviewProof,
} from "./compositions/verification.ts";

import {
  ProposeStrategy,
} from "./compositions/strategy-proposal.ts";

import {
  ListMyGoals,
  MyGoals,
} from "./compositions/dashboard.ts";

import {
  GetGoalDetail,
  GoalDetail,
} from "./compositions/goal-detail.ts";

import {
  ListMyGroups,
  MyGroups,
} from "./compositions/my-groups.ts";

import {
  GroupMember,
  GroupProofs,
  ListGroupProofs,
} from "./compositions/group-proofs.ts";

import {
  GoalResults,
  RecordResult,
  ListGoalResults,
  RemoveResult,
} from "./compositions/results.ts";

import {
  UpdateGoal,
  RetireCommitment,
} from "./compositions/plan-management.ts";

import {
  StrategyState,
  GetStrategyState,
} from "./compositions/strategy-state.ts";

import { db } from "./db.ts";

export function assembleApplication() {
  const instances =
    applicationConceptSet.implementations("mongo", {
      db,
    });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,

    composition: {
      BetterSelf: {
        authentication: {
          Register,
          SignIn,
          CurrentUser,
          SignOut,
        },

        goals: {
          CreateGoal,
          SetStrategy,
        },

        commitments: {
          CreateCommitment,
        },

        proofs: {
          SubmitProof,
          DeletePendingProof,
        },

        completion: {
          RecordCompletionFromProof,
        },

        proofSharing: {
          ShareProofWithGroup,
          UnshareDeletedProof,
        },

        verification: {
          ReviewProof,
        },

        groups: {
          CreateGroup,
          JoinGroup,
          AttachGoal,
        },

        strategyProposal: {
          ProposeStrategy,
        },

        results: {
          GoalResults,
          RecordResult,
          ListGoalResults,
          RemoveResult,
        },

        planManagement: {
          UpdateGoal,
          RetireCommitment,
        },

        strategyState: {
          StrategyState,
          GetStrategyState,
        },

        dashboard: {
          ListMyGoals,
          MyGoals,
          GetGoalDetail,
          GoalDetail,
          ListMyGroups,
          MyGroups,
          GroupMember,
          GroupProofs,
          ListGroupProofs,
        },
      },
    },
  });
}
