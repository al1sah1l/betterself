# BetterSelf - P4 Final Design Summary

## 1. From Initial Concept to Final Application

My original P1 design focused on a central problem in self-directed goal pursuit: people often struggle not only to execute plans, but also to determine whether they are working toward the right outcomes.

The initial concept proposed a cycle of **goal → strategy → commitments → execution and proof → observed results → review → revision**, supported by peer accountability.

The final application preserves this core structure. However, implementation and interface iterations made the experience more concrete, easier to navigate, and more realistic within the scope of a course project.

## 2. Significant Functional Design Decisions

**Separating completion, proof, verification, and results.** I kept these as distinct concepts rather than combining them into a single progress indicator. A completed commitment does not necessarily mean that the strategy is effective, and a submitted proof does not necessarily mean that another person has verified it. This separation supports more meaningful strategy reviews.

**Keeping AI recommendations under user control.** BetterSelf proposes initial strategies and revised plans, but users must explicitly accept or edit them. I chose this approach because the application cannot know all the personal circumstances that make a strategy realistic.

**Refining accountability.** The original design envisioned image evidence and group discussion. The final version supports text, links, image uploads, peer verification, disputed-proof resubmission, and preserved review history. Group chat and automated verification remain outside the implemented scope. This prioritizes a complete evidence-and-review workflow over additional social functionality.

**Adding explicit goal prioritization.** P1 identified competing goals as an important problem. During P4, I added a user-controlled priority goal that appears prominently in the Dashboard and influences the order of displayed goals and commitments. This addresses a problem that the original goal-management concepts did not sufficiently handle in the interface.

## 3. Evolution of the Interaction and Visual Design

My early P1 sketches organized the application around separate Dashboard, Goals, Commitments, and Groups views. The P3 visual design study focused on typography, readability, purple-based color hierarchy, and clearly distinguishable proof statuses.

In P4, I developed a more cohesive **Goal Workspace** with three sections:

- **Plan:** Strategy, commitments, evidence, and accountability.
- **Results:** Observed outcomes, independently of task completion.
- **Review:** Reflection, AI-assisted analysis, and strategy revision.

This structure follows the mental progression of planning, acting, measuring, and adapting.

I also redesigned goal creation into a structured form and added prominent actions for submitting proof and recording results. The goal description card now provides access to settings through a compact overflow menu, keeping editing and destructive operations available without crowding the primary workflow.

The purple palette, clearer typography, commitment cards, status indicators, and progress summaries aim to make complex information easier to scan.

## 4. Implementation and Reliability Tradeoffs

BetterSelf uses concept-based design with MIT Sync Engine, a Vue/TypeScript frontend, a Bun backend, and MongoDB.

Reactions connect concepts where actions in one part of the application should trigger consequences elsewhere. For example, submitting proof records a completion claim and shares evidence with an attached accountability group. Authentication and ownership checks are important because evidence and personal goals may be sensitive.

Adding image uploads required authenticated access control and MongoDB GridFS storage. Goal deletion and group leaving also required cleaning up references across several collections.

During deployment, I found that the managed MongoDB service does not provide replica-set transaction support. I therefore adapted the resource-management operations to sequential, retry-oriented database updates. This makes the application compatible with the course deployment environment, but it does not provide atomic rollback across multiple collections.

I also used process-local coordination for certain goal operations and retained recovery of pending image-cleanup jobs. These are practical prototype safeguards rather than a complete distributed concurrency solution.

## 5. Reflection and Remaining Limitations

The biggest change from P1 to P4 was moving from a broad feature proposal to a more focused and usable application. I learned that implementing features is only part of the challenge: deciding how users discover them, understanding where concept boundaries matter, and handling real deployment constraints are equally important.

The current application does not include group chat, real-time cross-browser updates, automated proof verification, or third-party integrations. More comprehensive crash recovery and distributed coordination would also be needed for a production-scale system.

The final design emphasizes a coherent goal-pursuit workflow: users choose meaningful goals, make actionable commitments, provide evidence, evaluate results, and revise their strategy deliberately.