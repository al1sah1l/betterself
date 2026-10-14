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

import {CreateCommitment} from "./compositions/comitments.ts";
import { SubmitProof } from "./compositions/proofs.ts";

import {
  CreateGroup,
  JoinGroup,
  AttachGoal,
} from "./compositions/groups.ts";

import { RecordCompletionFromProof } from "./compositions/completion.ts";
import { ShareProofWithGroup } from "./compositions/proof-sharing.ts";
import { ReviewProof } from "./compositions/verification.ts";
import { ProposeStrategy } from "./compositions/strategy-proposal.ts";

import {
  ListMyGoals,
  MyGoals,
} from "./compositions/dashboard.ts";

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
        },

        completion: {
          RecordCompletionFromProof,
        },

        proofSharing: {
          ShareProofWithGroup,
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

        dashboard: {
          ListMyGoals,
          MyGoals,
        },

      },
    },
  });
}
