<script setup lang="ts">
import { nextTick, onMounted, ref, computed } from "vue";
import { api, ApiError } from "./api";
import StrategyProposal from "./StrategyProposal.vue";
import CreateCommitment from "./CreateCommitment.vue";
import AttachGoal from "./AttachGoal.vue";
import SubmitProof from "./SubmitProof.vue";
import ResubmitProof from "./ResubmitProof.vue";
import EvidenceText from "./EvidenceText.vue";

const props = defineProps<{
  session: string;
  goal: string;
}>();

type StrategyStep = {
  description: string;
  successCriterion: string;
};

type Verification = {
  reviewer: string;
  decision: "verified" | "disputed";
  note: string;
};

type CompletionClaim = {
  completion: string;
  occurrence: string;
  proofs: {
    proof: string;
    verifications: Verification[];
  }[];
};

type SubmittedProof = {
  proof: string;
  occurrence: string;
  evidence: string[];
  attempt: number;
  current: boolean;
  verifications: Verification[];
};

type Commitment = {
  commitment: string;
  description: string;
  recurring: boolean;
  schedule: string;
  active: boolean;
  completions: CompletionClaim[];
  proofs: SubmittedProof[];
  sourceStep: string | null;
};

type GoalData = {
  goal: string;
  outcome: string;
  currentContext: string;
  constraints: string;
  timeline: string;
  successDefinition: string;
  currentStrategy: StrategyStep[] | null;
  group: string | null;
  commitments: Commitment[];
};

const detail = ref<GoalData | null>(null);
const strategyRevision = ref("initial");
const loading = ref(false);
const error = ref("");

type CommitmentFilter = "all" | "active" | "retired";

const commitmentFilter = ref<CommitmentFilter>("all");

const filteredCommitments = computed(() => {
  const commitments = detail.value?.commitments ?? [];

  if (commitmentFilter.value === "active") {
    return commitments.filter((commitment) => commitment.active);
  }

  if (commitmentFilter.value === "retired") {
    return commitments.filter((commitment) => !commitment.active);
  }

  return commitments;
});

const commitmentCounts = computed(() => {
  const commitments = detail.value?.commitments ?? [];
  const active = commitments.filter(
    (commitment) => commitment.active,
  ).length;

  return {
    all: commitments.length,
    active,
    retired: commitments.length - active,
  };
});

const deletingProof = ref("");
const deleteError = ref("");
const deleteSuccess = ref("");

const commitmentDescription = ref("");
const commitmentSourceStep = ref("");
const commitmentFormKey = ref(0);
const commitmentDialog = ref<HTMLDialogElement | null>(null);
const commitmentSaving = ref(false);

async function openCommitment(description = "", sourceStep = "") {
  commitmentDescription.value = description;
  commitmentSourceStep.value = sourceStep;
  commitmentFormKey.value += 1;

  await nextTick();
  commitmentDialog.value?.showModal();
}

function sourceStepFor(index: number): string {
  return strategyRevision.value === "initial"
    ? `step:${index}`
    : `strategy:${strategyRevision.value}:step:${index}`;
}

function useStrategyStep(step: StrategyStep, index: number) {
  void openCommitment(step.description, sourceStepFor(index));
}

function hasCommitmentForStep(index: number): boolean {
  return (
    detail.value?.commitments.some(
      (commitment) =>
        commitment.active &&
        commitment.sourceStep === sourceStepFor(index),
    ) ?? false
  );
}

async function viewCommitmentForStep(index: number) {
  const commitment = detail.value?.commitments.find(
    (item) =>
      item.active &&
      item.sourceStep === sourceStepFor(index),
  );

  if (!commitment) return;

  commitmentFilter.value = "active";
  await nextTick();

  const card = document.getElementById(
    `commitment-${commitment.commitment}`,
  );

  if (!card) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  card.focus({ preventScroll: true });
  card.scrollIntoView({
    behavior: reducedMotion ? "instant" : "smooth",
    block: "center",
  });
}

function closeCommitment() {
  if (commitmentSaving.value) return;
  commitmentDialog.value?.close();
}

function cancelCommitment(event: Event) {
  if (commitmentSaving.value) event.preventDefault();
}

async function commitmentCreated() {
  commitmentDialog.value?.close();
  await loadDetail();
}

async function loadDetail() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ detail: GoalData }>(
      "/dashboard/goal",
      {
        session: props.session,
        goal: props.goal,
      },
    );

    const snapshot = await api<{
      state: {
        strategy: StrategyStep[];
        revision: string;
      };
    }>("/dashboard/strategy-state", {
      session: props.session,
      goal: props.goal,
    });

    strategyRevision.value = snapshot.state.revision;

    detail.value = {
      ...result.detail,
      currentStrategy: snapshot.state.strategy.length
        ? snapshot.state.strategy
        : null,
    };
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value =
        cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "You do not have access to this goal."
            : cause.code === "NOT_FOUND"
              ? "This goal could not be found."
              : "Could not load this goal. Please try again.";
    } else {
      error.value =
        cause instanceof Error
          ? cause.message
          : "Could not load this goal. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}

function canResubmit(proof: SubmittedProof): boolean {
  return (
    proof.current &&
    proof.verifications.some(
      (review) => review.decision === "disputed",
    ) &&
    !proof.verifications.some(
      (review) => review.decision === "verified",
    )
  );
}

function proofStatus(proof: SubmittedProof) {
  const verified = proof.verifications.some(
    (review) => review.decision === "verified",
  );
  const disputed = proof.verifications.some(
    (review) => review.decision === "disputed",
  );

  if (verified && disputed) {
    return { label: "Mixed reviews", tone: "mixed" };
  }
  if (disputed) {
    return { label: "Disputed", tone: "disputed" };
  }
  if (verified) {
    return { label: "Verified", tone: "verified" };
  }

  return { label: "Pending review", tone: "pending" };
}

async function deletePendingProof(proof: SubmittedProof) {
  if (deletingProof.value || loading.value) return;
  if (proof.verifications.length > 0) return;
  if (!window.confirm("Delete this proof?")) return;

  deletingProof.value = proof.proof;
  deleteError.value = "";
  deleteSuccess.value = "";

  try {
    await api<{ proof: string }>("/proofs/delete", {
      session: props.session,
      proof: proof.proof,
    });

    if (detail.value) {
      for (const commitment of detail.value.commitments) {
        commitment.proofs = commitment.proofs.filter(
          (item) => item.proof !== proof.proof,
        );

        for (const claim of commitment.completions) {
          claim.proofs = claim.proofs.filter(
            (item) => item.proof !== proof.proof,
          );
        }
      }
    }

    deleteSuccess.value = "Proof deleted.";
    await loadDetail();
  } catch (cause) {
    if (cause instanceof ApiError) {
      deleteError.value =
        cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign in again."
          : cause.code === "FORBIDDEN"
            ? "Only the submitter can delete this proof."
            : cause.code === "CONFLICT"
              ? "This proof has received a peer review and cannot be deleted. Reload the goal to see its status."
              : cause.code === "NOT_FOUND"
                ? "This proof no longer exists. Reload the goal."
                : "Could not delete the proof. Please try again.";
    } else {
      deleteError.value =
        cause instanceof Error
          ? cause.message
          : "Could not delete the proof. Please try again.";
    }
  } finally {
    deletingProof.value = "";
  }
}

onMounted(loadDetail);
</script>

<template>
  <section
    class="goal-detail"
    aria-label="Goal detail"
    :aria-busy="loading"
  >
    <p v-if="loading && !detail" role="status">Loading goal...</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <template v-if="detail">
      <header class="goal-heading">
        <p class="eyebrow">Your goal</p>
        <h2>{{ detail.outcome }}</h2>
      </header>

      <dl class="goal-context">
        <div>
          <dt>Starting point</dt>
          <dd>{{ detail.currentContext }}</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>{{ detail.constraints }}</dd>
        </div>
        <div>
          <dt>Timeline</dt>
          <dd>{{ detail.timeline }}</dd>
        </div>
        <div>
          <dt>Success definition</dt>
          <dd>{{ detail.successDefinition }}</dd>
        </div>
      </dl>

      <section class="content-section" aria-label="Strategy">
        <header class="section-heading">
          <div>
            <p class="eyebrow">The approach</p>
            <h3>Strategy</h3>
          </div>
        </header>

        <ol v-if="detail.currentStrategy" class="strategy-list">
          <li
            v-for="(step, index) in detail.currentStrategy"
            :key="`${strategyRevision}-${index}`"
          >
            <span class="step-number" aria-hidden="true">
              {{ index + 1 }}
            </span>

            <div class="step-content">
              <strong>{{ step.description }}</strong>
              <p class="muted">{{ step.successCriterion }}</p>

              <button
                v-if="!hasCommitmentForStep(index)"
                class="text-button"
                type="button"
                :disabled="loading"
                @click="useStrategyStep(step, index)"
              >
                + Create commitment
              </button>

              <button
                v-else
                class="text-button"
                type="button"
                @click="viewCommitmentForStep(index)"
              >
                View commitment ↓
              </button>
            </div>
          </li>
        </ol>

        <StrategyProposal
          v-else
          :session="props.session"
          :goal="props.goal"
          @saved="loadDetail"
        />
      </section>

      <section
        v-if="detail.group"
        class="accountability-panel"
        aria-label="Goal accountability group"
      >
        <h3>Accountability group</h3>
        <p class="muted">
          New proof submissions for this goal are shared with your group.
        </p>
        <p class="group-id">Group ID: {{ detail.group }}</p>
      </section>

      <AttachGoal
        v-else
        :session="props.session"
        :goal="props.goal"
        @attached="loadDetail"
      />

      <section class="content-section" aria-label="Commitments">
        <header class="section-heading">
          <div>
            <p class="eyebrow">Put it into practice</p>
            <h3>Commitments</h3>
          </div>

          <button
            class="primary"
            type="button"
            :disabled="loading"
            @click="openCommitment()"
          >
            + Add commitment
          </button>
        </header>

        <p v-if="deleteError" class="error" role="alert">
          {{ deleteError }}
        </p>
        <p v-if="deleteSuccess" class="feedback" role="status">
          {{ deleteSuccess }}
        </p>

        <div class="commitment-filters" role="group" aria-label="Filter commitments">
          <button
            type="button"
            :aria-pressed="commitmentFilter === 'all'"
            @click="commitmentFilter = 'all'"
          >
            All ({{ commitmentCounts.all }})
          </button>

          <button
            type="button"
            :aria-pressed="commitmentFilter === 'active'"
            @click="commitmentFilter = 'active'"
          >
            Active ({{ commitmentCounts.active }})
          </button>

          <button
            type="button"
            :aria-pressed="commitmentFilter === 'retired'"
            @click="commitmentFilter = 'retired'"
          >
            Retired ({{ commitmentCounts.retired }})
          </button>
        </div>

        <ul v-if="filteredCommitments.length" class="commitment-list">
          <li
            v-for="commitment in filteredCommitments"
            :key="commitment.commitment"
            :id="`commitment-${commitment.commitment}`"
            tabindex="-1"
            class="commitment-card"
            :class="{ 'commitment-card--retired': !commitment.active }"
          >
            <header class="commitment-header">
              <h4>{{ commitment.description }}</h4>

              <span
                class="state-badge"
                :class="{ 'state-badge--retired': !commitment.active }"
              >
                {{ commitment.active ? "Active" : "Retired" }}
              </span>
            </header>

            <div class="commitment-meta">
              <span>{{ commitment.recurring ? "Recurring" : "One-time" }}</span>
              <span>{{ commitment.schedule }}</span>
            </div>

            <div class="proofs-section">
              <h5>
                Submitted proofs
                <span class="proof-count">
                  {{ commitment.proofs.length }}
                </span>
              </h5>

              <ul v-if="commitment.proofs.length" class="proof-list">
                <li
                  v-for="proof in commitment.proofs"
                  :key="proof.proof"
                  class="proof-card"
                >
                  <p class="attempt-label">
                    Attempt {{ proof.attempt }}
                    · {{ proof.current ? "Current" : "Previous attempt" }}
                  </p>
                  <p class="proof-date">
                    Completed
                    <time :datetime="proof.occurrence">
                      {{ new Date(proof.occurrence).toLocaleString() }}
                    </time>
                  </p>

                  <ul class="evidence-list">
                    <li
                      v-for="(item, index) in proof.evidence"
                      :key="index"
                    >
                      <EvidenceText :text="item" />
                    </li>
                  </ul>

                  <details class="claim-review">
                    <summary
                      class="review-badge"
                      :class="`review-badge--${proofStatus(proof).tone}`"
                    >
                      {{ proofStatus(proof).label }}
                    </summary>

                    <div class="review-info">
                      <p v-if="proof.verifications.length === 0">
                        No peer reviews yet.
                      </p>

                      <ul v-else class="review-list">
                        <li
                          v-for="review in proof.verifications"
                          :key="review.reviewer"
                        >
                          <p>
                            <strong>{{ review.reviewer }}</strong>
                            · {{ review.decision }}
                          </p>
                          <p v-if="review.note">{{ review.note }}</p>
                        </li>
                      </ul>
                    </div>
                  </details>

                  <button
                    v-if="proof.verifications.length === 0"
                    class="text-button delete-proof-button"
                    type="button"
                    :disabled="Boolean(deletingProof) || loading"
                    @click="deletePendingProof(proof)"
                  >
                    {{
                      deletingProof === proof.proof
                        ? "Deleting..."
                        : "Delete pending proof"
                    }}
                  </button>
                  <ResubmitProof
                    v-if="commitment.active && canResubmit(proof)"
                    :session="props.session"
                    :proof="proof.proof"
                    @submitted="loadDetail"
                  />
                </li>
              </ul>

              <p v-else class="empty-state">
                No proofs yet. Submit evidence when you complete this commitment.
              </p>
            </div>

            <details
              v-if="commitment.active"
              class="proof-submission"
            >
              <summary>Submit proof</summary>

              <SubmitProof
                :session="props.session"
                :goal="props.goal"
                :commitment="commitment.commitment"
                :existing-occurrence="
                  !commitment.recurring
                    ? commitment.completions[0]?.occurrence
                    : undefined
                "
                :disabled="
                  !commitment.recurring &&
                  commitment.proofs.length > 0
                "
                @submitted="loadDetail"
              />
            </details>
          </li>
        </ul>

        <p v-else class="empty-state">
          {{
            commitmentCounts.all === 0
              ? "No commitments yet. Start with a strategy step or add your own."
              : commitmentFilter === "active"
                ? "No active commitments."
                : "No retired commitments."
          }}
        </p>
      </section>
    </template>

    <button
      class="text-button reload-button"
      type="button"
      :disabled="loading"
      @click="loadDetail"
    >
      {{ loading ? "Updating goal..." : "Reload goal" }}
    </button>

    <dialog
      ref="commitmentDialog"
      class="commitment-dialog"
      aria-labelledby="commitment-dialog-title"
      @cancel="cancelCommitment"
    >
      <header class="dialog-header">
        <h3 id="commitment-dialog-title">Create commitment</h3>
        <button
          class="text-button"
          type="button"
          :disabled="commitmentSaving"
          @click="closeCommitment"
        >
          Close
        </button>
      </header>

      <CreateCommitment
        :key="commitmentFormKey"
        :session="props.session"
        :goal="props.goal"
        :initial-description="commitmentDescription"
        :source-step="commitmentSourceStep"
        @busy="commitmentSaving = $event"
        @created="commitmentCreated"
      />
    </dialog>
  </section>
</template>

<style scoped>
.goal-detail {
  margin-top: 24px;
  overflow-wrap: anywhere;
}

.goal-heading {
  margin-bottom: 24px;
}

.goal-heading h2 {
  margin: 6px 0 0;
  font-size: clamp(24px, 4vw, 32px);
  line-height: 1.25;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.goal-context {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin: 0;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--background);
}

dt {
  font-size: 13px;
  font-weight: 650;
}

dd {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.6;
  white-space: pre-wrap;
}

.content-section {
  margin-top: 36px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.section-heading h3 {
  margin: 0;
  font-size: 22px;
}

.strategy-list,
.commitment-list,
.proof-list,
.review-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.strategy-list {
  display: grid;
  gap: 12px;
}

.strategy-list > li {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
}

.step-number {
  display: grid;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: #eee8fb;
  color: #6041b1;
  font-size: 14px;
  font-weight: 700;
}

.step-content {
  min-width: 0;
  line-height: 1.5;
}

.step-content .muted {
  margin: 8px 0;
}

.step-content .text-button {
  margin-top: 4px;
}

.accountability-panel {
  margin-top: 28px;
  padding: 20px 24px;
  border-left: 3px solid var(--accent);
  border-radius: 0 12px 12px 0;
  background: var(--background);
}

.accountability-panel h3 {
  margin: 0;
  font-size: 16px;
}

.accountability-panel .muted {
  margin: 8px 0;
}

.group-id {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.commitment-list {
  display: grid;
  gap: 20px;
}

.commitment-card {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 3px 12px rgb(41 36 59 / 4%);
  scroll-margin-block: 24px;
}

.commitment-card:focus {
  outline: 3px solid var(--accent);
  outline-offset: 4px;
}

.commitment-card--retired {
  border-style: dashed;
}

.commitment-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.commitment-header h4 {
  margin: 0;
  font-size: 18px;
  line-height: 1.5;
}

.state-badge {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: #eee8fb;
  color: #6041b1;
  font-size: 12px;
  font-weight: 650;
}

.state-badge--retired {
  background: #eeedf1;
  color: #5d5869;
}

.commitment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.proofs-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.proofs-section h5 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 14px;
}

.proof-count {
  min-width: 24px;
  padding: 3px 7px;
  border-radius: 8px;
  background: var(--background);
  color: var(--muted);
  text-align: center;
  font-size: 12px;
}

.proof-list {
  display: grid;
  gap: 12px;
}

.proof-card {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
}

.proof-date {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.evidence-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.evidence-list li + li {
  margin-top: 8px;
}

.empty-state {
  margin: 0;
  padding: 20px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.claim-review {
  margin-top: 16px;
}

.review-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  list-style: none;
}

.review-badge::-webkit-details-marker {
  display: none;
}

.review-badge::after {
  content: "+";
}

.claim-review[open] > .review-badge::after {
  content: "−";
}

.review-badge--pending {
  background: #e7e5ec;
  color: #514b60;
}

.review-badge--verified {
  background: #e9dffb;
  color: #58349f;
}

.review-badge--disputed {
  background: #fce4e7;
  color: #972438;
}

.review-badge--mixed {
  background: #fff0cc;
  color: #77500b;
}

.review-info {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.review-info p {
  margin: 0;
}

.review-info p + p {
  margin-top: 6px;
}

.review-list li + li {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.delete-proof-button {
  margin-top: 12px;
  color: #a32939;
  font-size: 12px;
}

.proof-submission {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.proof-submission > summary {
  color: var(--accent);
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}

.review-badge:focus-visible,
.proof-submission > summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.feedback {
  color: var(--accent);
  font-size: 14px;
}

.reload-button {
  margin-top: 24px;
}

.commitment-dialog {
  width: min(520px, calc(100% - 32px));
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 80px rgb(29 20 50 / 20%);
}

.commitment-dialog::backdrop {
  background: rgb(29 20 50 / 45%);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dialog-header h3,
.dialog-header button {
  margin: 0;
}

@media (max-width: 600px) {
  .goal-context {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .commitment-card {
    padding: 18px;
  }

  .commitment-header {
    flex-direction: column;
    gap: 10px;
  }

  .proof-card {
    padding: 14px;
  }

  .strategy-list > li {
    gap: 12px;
    padding: 16px;
  }

  .commitment-dialog {
    padding: 20px;
  }
}

.commitment-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.commitment-filters button {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.commitment-filters button[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.commitment-filters button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.attempt-label {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

</style>
