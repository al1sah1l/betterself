# Progress Review

The owner can [request an AI review](reaction:BetterSelf.progressReview.ReviewProgress).

Session identity and goal ownership are checked before accessing data or invoking AI.

The [review context former](former:BetterSelf.progressReview.ReviewContext) assembles goal detail, commitments, completion claims, evidence and peer reviews, observed results, and the current strategy snapshot.

Client-supplied context is ignored. After ownership is checked, the action receives a goal reference. The injected server provider evaluates the context with application.form before AI generation.

The model is instructed to distinguish execution from observed outcomes and to acknowledge insufficient evidence.

Generation is advisory. Analysis and the editable proposal are temporary frontend state; they are not a persistent review log. Rejecting discards the local proposal without changing the strategy. This replaces the broader persistent ProgressReviewing workflow for this beta.

The owner can [explicitly apply an edited strategy proposal](reaction:BetterSelf.progressReview.ApplyReviewStrategy).

The concept atomically checks expectedRevision before changing the strategy. A stale or repeated application returns STRATEGY_CHANGED.

Existing commitments, proofs, reviews, and observed results remain unchanged. A revised strategy's steps use their own revision identity. The user can separately retire obsolete commitments and create new ones.

```endpoints
BetterSelf.progressReview.ReviewProgress at /reviews/propose
BetterSelf.progressReview.ApplyReviewStrategy at /reviews/apply
```
