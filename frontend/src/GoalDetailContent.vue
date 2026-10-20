<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { api, ApiError } from "./api";
import StrategyProposal from "./StrategyProposal.vue";
import CreateCommitment from "./CreateCommitment.vue";
import AttachGoal from "./AttachGoal.vue";
import SubmitProof from "./SubmitProof.vue";

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

const deletingProof = ref("");
const deleteError = ref("");
const deleteSuccess = ref("");

const commitmentDescription = ref("");
const commitmentSourceStep = ref("");
const commitmentFormKey = ref(0);
const commitmentDialog = ref<HTMLDialogElement | null>(null);
const commitmentSaving = ref(false);

async function openCommitment(
  description = "",
  sourceStep = "",
) {
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

function useStrategyStep(
  step: StrategyStep,
  index: number,
) {
  void openCommitment(
    step.description,
    sourceStepFor(index),
  );
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

function closeCommitment() {
  if (commitmentSaving.value) return;
  commitmentDialog.value?.close();
}

function cancelCommitment(event: Event) {
  if (commitmentSaving.value) {
    event.preventDefault();
  }
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

    strategyRevision.value =
      snapshot.state.revision;

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

function proofStatus(proof: SubmittedProof) {
  const verified = proof.verifications.some(
    (review) => review.decision === "verified",
  );

  const disputed = proof.verifications.some(
    (review) => review.decision === "disputed",
  );

  if (verified && disputed) {
    return {
      label: "Mixed reviews",
      tone: "mixed",
    };
  }

  if (disputed) {
    return {
      label: "Disputed",
      tone: "disputed",
    };
  }

  if (verified) {
    return {
      label: "Verified",
      tone: "verified",
    };
  }

  return {
    label: "Pending review",
    tone: "pending",
  };
}

async function deletePendingProof(
  proof: SubmittedProof,
) {
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
    <p v-if="loading && !detail" role="status">
      Loading goal...
    </p>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <template v-if="detail">
      <h2>{{ detail.outcome }}</h2>

      <dl>
        <dt>Starting point</dt>
        <dd>{{ detail.currentContext }}</dd>

        <dt>Constraints</dt>
        <dd>{{ detail.constraints }}</dd>

        <dt>Timeline</dt>
        <dd>{{ detail.timeline }}</dd>

        <dt>Success definition</dt>
        <dd>{{ detail.successDefinition }}</dd>
      </dl>

      <h3>Strategy</h3>

      <ol v-if="detail.currentStrategy">
        <li
          v-for="(step, index) in detail.currentStrategy"
          :key="`${strategyRevision}-${index}`"
        >
          <strong>{{ step.description }}</strong>
          <p class="muted">{{ step.successCriterion }}</p>

          <button
            v-if="!hasCommitmentForStep(index)"
            class="text-button"
            type="button"
            :disabled="loading"
            @click="useStrategyStep(step, index)"
          >
            Create commitment from this step
          </button>

          <p v-else class="muted">
            Active commitment created for this step.
          </p>
        </li>
      </ol>

      <StrategyProposal
        v-else
        :session="props.session"
        :goal="props.goal"
        @saved="loadDetail"
      />

      <section
        v-if="detail.group"
        aria-label="Goal accountability group"
      >
        <h3>Accountability group</h3>
        <p class="muted">
          Proof submissions for this goal are shared with this group.
        </p>
        <p>Group ID: {{ detail.group }}</p>
      </section>

      <AttachGoal
        v-else
        :session="props.session"
        :goal="props.goal"
        @attached="loadDetail"
      />

      <h3>Commitments</h3>

      <p v-if="deleteError" class="error" role="alert">
        {{ deleteError }}
      </p>

      <p v-if="deleteSuccess" role="status">
        {{ deleteSuccess }}
      </p>

      <button
        class="primary"
        type="button"
        :disabled="loading"
        @click="openCommitment()"
      >
        + Add commitment
      </button>

      <ul v-if="detail.commitments.length">
        <li
          v-for="commitment in detail.commitments"
          :key="commitment.commitment"
        >
          <strong>{{ commitment.description }}</strong>

          <p class="muted">
            {{ commitment.schedule }}
            · {{ commitment.recurring ? "Recurring" : "One-time" }}
            · {{ commitment.active ? "Active" : "Retired" }}
          </p>

          <div>
            <h4>Submitted proofs</h4>

            <ul v-if="commitment.proofs.length">
              <li
                v-for="proof in commitment.proofs"
                :key="proof.proof"
              >
                <p>
                  Occurrence:
                  {{ new Date(proof.occurrence).toLocaleString() }}
                </p>

                <ul>
                  <li
                    v-for="(item, index) in proof.evidence"
                    :key="index"
                  >
                    {{ item }}
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

                    <ul v-else>
                      <li
                        v-for="review in proof.verifications"
                        :key="review.reviewer"
                      >
                        <strong>{{ review.reviewer }}</strong>
                        · {{ review.decision }}

                        <p v-if="review.note">
                          {{ review.note }}
                        </p>
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
              </li>
            </ul>

            <p v-else class="muted">
              No proofs submitted yet.
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

      <p v-else class="muted">
        No commitments yet.
      </p>
    </template>

    <button
      class="text-button"
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
        <h3 id="commitment-dialog-title">
          Create commitment
        </h3>

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
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow-wrap: anywhere;
}

dt {
  margin-top: 16px;
  font-weight: 600;
}

dd {
  margin: 6px 0 0;
  color: var(--muted);
  white-space: pre-wrap;
}

li {
  margin-bottom: 16px;
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
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.dialog-header h3,
.dialog-header button {
  margin: 0;
}

.claim-review {
  margin-top: 8px;
}

.review-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
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

.review-badge:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.review-badge--pending {
  background: #eeedf1;
  color: #5d5869;
}

.review-badge--verified {
  background: #eee8fb;
  color: #6041b1;
}

.review-badge--disputed {
  background: #fff0f0;
  color: #a32939;
}

.review-badge--mixed {
  background: #fff3d6;
  color: #805b13;
}

.review-info {
  margin-top: 10px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.review-info p {
  margin: 6px 0;
}

.delete-proof-button {
  color: #a32939;
}

.proof-submission {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.proof-submission > summary {
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}

.proof-submission > summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
</style>
