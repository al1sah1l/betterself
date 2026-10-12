import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";
import {
  no,
  where,
} from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const {
  ProofVerifying,
  AccountabilityGrouping,
} = concepts;

export const ReviewProof = endpoint(
  "/proofs/review",
  ({ reviewer, proof, decision, note, goal }) =>
    receive({
      reviewer,
      proof,
      decision,
      note,
    }).then(
      where(
        ProofVerifying._proof({
          proof,
        }).is({
          goal,
        }),
      )
        .then(
          AccountabilityGrouping.checkMember({
            goal,
            user: reviewer,
          }).responds({}),
        )
        .then(
          ProofVerifying.reviewProof({
            reviewer,
            proof,
            decision,
            note,
          }).responds({}),
        )
        .then(
          respond({
            proof,
          }),
        )
        .named("authorized"),

      where(
        no(
          ProofVerifying._proof({
            proof,
          }),
        ),
      )
        .then(
          respond({
            error: "PROOF_NOT_FOUND",
          }),
        )
        .named("missing"),
    ),
  {
    input: {
      required: [
        "reviewer",
        "proof",
        "decision",
        "note",
      ],
    },
  },
);
