# Plan Management

An authenticated user can [update their goal context](reaction:BetterSelf.planManagement.UpdateGoal).

The session determines the user. The endpoint checks ownership before updating outcome, current context, constraints, timeline, and success definition.

Updating context preserves the saved strategy and execution history. It does not automatically revise the strategy.

The owner can [retire a commitment](reaction:BetterSelf.planManagement.RetireCommitment) belonging to that exact goal.

Retirement preserves previous completion claims, proofs, and peer reviews.

Missing goals, unauthorized access, missing commitments, and commitments from another goal return GOAL_NOT_FOUND, FORBIDDEN, COMMITMENT_NOT_FOUND, and COMMITMENT_GOAL_MISMATCH respectively.

Retiring an already retired commitment returns COMMITMENT_ALREADY_RETIRED.

Retired commitments cannot receive new proof through SubmitProof.

```endpoints
BetterSelf.planManagement.UpdateGoal at /goals/update
BetterSelf.planManagement.RetireCommitment at /commitments/retire
```
