<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, ApiError } from "./api";
import ReviewProof from "./ReviewProof.vue";
import EvidenceText from "./EvidenceText.vue";

const props = defineProps<{
  session: string;
  group: string;
  account: string;
}>();

type Verification = {
  reviewer: string;
  decision: "verified" | "disputed";
  note: string;
};

type StrategyStep = {
  description: string;
  successCriterion: string;
};

type SharedProof = {
  proof: string;
  submitter: string;
  goal: string;
  commitment: string;
  occurrence: string;
  evidence: string[];
  verifications: Verification[];
  outcome: string | null;
  successDefinition: string | null;
  description: string | null;
  recurring: boolean | null;
  schedule: string | null;
  sourceStep: string | null;
  strategy: StrategyStep[] | null;
  strategyRevision: string | null;
  attempt: number;
  current: boolean;
};

type ProofFilter = "to-review" | "all" | "mine";

const proofs = ref<SharedProof[]>([]);
const loading = ref(false);
const error = ref("");
const filter = ref<ProofFilter>("to-review");

let reloadRequested = false;

function canReview(proof: SharedProof): boolean {
  return (
    proof.current &&
    proof.submitter !== props.account &&
    !proof.verifications.some(
      (review) => review.reviewer === props.account,
    )
  );
}

const filteredProofs = computed(() => {
  if (filter.value === "mine") {
    return proofs.value.filter(
      (proof) => proof.submitter === props.account,
    );
  }

  if (filter.value === "to-review") {
    return proofs.value.filter(canReview);
  }

  return proofs.value;
});

const counts = computed(() => ({
  all: proofs.value.length,
  mine: proofs.value.filter(
    (proof) => proof.submitter === props.account,
  ).length,
  toReview: proofs.value.filter(canReview).length,
}));

function linkedStep(proof: SharedProof): StrategyStep | null {
  if (
    !proof.sourceStep ||
    !proof.strategy ||
    !proof.strategyRevision
  ) {
    return null;
  }

  const prefix =
    proof.strategyRevision === "initial"
      ? "step:"
      : `strategy:${proof.strategyRevision}:step:`;

  if (!proof.sourceStep.startsWith(prefix)) return null;

  const indexText = proof.sourceStep.slice(prefix.length);

  if (!/^\d+$/.test(indexText)) return null;

  const index = Number(indexText);

  if (!Number.isSafeInteger(index)) return null;

  return proof.strategy[index] ?? null;
}

function proofStatus(proof: SharedProof) {
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

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : value;
}

async function loadProofs() {
  if (loading.value) {
    reloadRequested = true;
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ proofs: SharedProof[] }>(
      "/dashboard/group-proofs",
      {
        session: props.session,
        group: props.group,
      },
    );

    proofs.value = result.proofs;
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "Only group members can view these proofs."
            : cause.code === "NOT_FOUND"
              ? "This group could not be found."
              : "Could not load proofs. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not load proofs. Please try again.";
  } finally {
    loading.value = false;

    if (reloadRequested) {
      reloadRequested = false;
      void loadProofs();
    }
  }
}

onMounted(loadProofs);
</script>

<template>
  <section
    class="group-proofs"
    aria-label="Shared group proofs"
    :aria-busy="loading"
  >
    <header class="proofs-heading">
      <h3>Shared proofs</h3>
      <p class="muted">
        Review evidence against the commitment below.
        Verification confirms execution, not achievement of the whole goal.
      </p>
    </header>

    <div class="proof-filters" role="group" aria-label="Filter proofs">
      <button
        type="button"
        :aria-pressed="filter === 'to-review'"
        @click="filter = 'to-review'"
      >
        To review ({{ counts.toReview }})
      </button>

      <button
        type="button"
        :aria-pressed="filter === 'all'"
        @click="filter = 'all'"
      >
        All ({{ counts.all }})
      </button>

      <button
        type="button"
        :aria-pressed="filter === 'mine'"
        @click="filter = 'mine'"
      >
        My proofs ({{ counts.mine }})
      </button>
    </div>

    <p v-if="loading" class="muted" role="status">
      Loading proofs...
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p
      v-if="!loading && !error && !filteredProofs.length"
      class="empty-state"
    >
      {{
        !proofs.length
          ? "No proofs have been shared with this group yet."
          : filter === "to-review"
            ? "No proofs waiting for your review. See All for the group's history."
            : filter === "mine"
              ? "You have not shared any proofs with this group."
              : "No proofs to display."
      }}
    </p>

    <article
      v-for="proof in filteredProofs"
      :key="proof.proof"
      class="proof-card"
    >
      <header class="proof-header">
        <div>
          <h4>
            {{
              proof.submitter === props.account
                ? "Your proof"
                : `Proof from ${proof.submitter}`
            }}
          </h4>
          <p class="proof-date">
            Completed
            <time :datetime="proof.occurrence">
              {{ formatDate(proof.occurrence) }}
            </time>
          </p>
        </div>

        <span
          class="review-badge"
          :class="`review-badge--${proofStatus(proof).tone}`"
        >
          {{ proofStatus(proof).label }}
        </span>
      </header>

      <dl class="proof-context">
        <div>
          <dt>Goal</dt>
          <dd>{{ proof.outcome ?? "Goal context unavailable." }}</dd>
        </div>

        <div v-if="proof.successDefinition">
          <dt>Goal success definition</dt>
          <dd>{{ proof.successDefinition }}</dd>
        </div>

        <div>
          <dt>Commitment being verified</dt>
          <dd>
            {{ proof.description ?? "Commitment context unavailable." }}
          </dd>
        </div>

        <div v-if="proof.schedule">
          <dt>Schedule</dt>
          <dd>
            {{ proof.schedule }}
            <template v-if="proof.recurring !== null">
              · {{ proof.recurring ? "Recurring" : "One-time" }}
            </template>
          </dd>
        </div>

        <div v-if="linkedStep(proof)">
          <dt>Linked strategy step</dt>
          <dd>
            {{ linkedStep(proof)?.description }}
            <p class="step-criterion">
              Success criterion:
              {{ linkedStep(proof)?.successCriterion }}
            </p>
          </dd>
        </div>

        <div v-else-if="proof.sourceStep">
          <dt>Strategy link</dt>
          <dd>
            The linked step is no longer available in the current strategy.
            Use the commitment above to assess this evidence.
          </dd>
        </div>
      </dl>

      <h5>Evidence</h5>
      <ul class="evidence-list">
        <li
          v-for="(item, index) in proof.evidence"
          :key="index"
          class="evidence"
        >
          <EvidenceText :text="item" />
        </li>
      </ul>

      <details class="peer-reviews">
        <summary>
          Peer reviews ({{ proof.verifications.length }})
        </summary>

        <p v-if="!proof.verifications.length" class="muted">
          No peer reviews yet.
        </p>

        <ul v-else class="review-list">
          <li
            v-for="verification in proof.verifications"
            :key="verification.reviewer"
          >
            <strong>{{ verification.reviewer }}</strong>
            · {{ verification.decision }}
            <p v-if="verification.note" class="evidence">
              {{ verification.note }}
            </p>
          </li>
        </ul>
      </details>

      <p v-if="!proof.current" class="own-proof-note">
        A newer submission is available. This attempt is kept as history.
      </p>

      <p
        v-else-if="proof.submitter === props.account"
        class="own-proof-note"
        >
        This is your proof. Other group members can review it.
      </p>

      <details v-else-if="canReview(proof)" class="review-action">
        <summary>Review this proof</summary>

        <ReviewProof
            :session="props.session"
            :proof="proof.proof"
            @reviewed="loadProofs"
        />
      </details>

      <p v-else class="own-proof-note">
        You have already reviewed this proof.
      </p>
    </article>

    <button
      class="text-button"
      type="button"
      :disabled="loading"
      @click="loadProofs"
    >
      {{ loading ? "Updating proofs..." : "Reload proofs" }}
    </button>
  </section>
</template>

<style scoped>
.group-proofs {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.proofs-heading h3 {
  margin: 0;
  font-size: 18px;
}

.proofs-heading .muted {
  margin: 10px 0 20px;
  font-size: 14px;
}

.proof-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.proof-filters button {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.proof-filters button[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.proof-filters button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.proof-card {
  margin-top: 18px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  overflow-wrap: anywhere;
}

.proof-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

h4 {
  margin: 0;
  font-size: 17px;
}

.proof-date {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.review-badge {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
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

.proof-context {
  display: grid;
  gap: 16px;
  margin: 20px 0 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
}

dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

dd {
  margin: 6px 0 0;
  line-height: 1.6;
  white-space: pre-wrap;
}

.step-criterion {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
}

h5 {
  margin: 24px 0 10px;
  font-size: 14px;
}

.evidence-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.7;
}

.evidence-list li + li {
  margin-top: 8px;
}

.evidence {
  white-space: pre-wrap;
}

.peer-reviews,
.review-action {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

summary {
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.review-list {
  margin: 16px 0 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.6;
}

.review-list li + li {
  margin-top: 16px;
}

.review-list p {
  margin: 6px 0 0;
}

.own-proof-note {
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.empty-state {
  padding: 20px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .proof-card {
    padding: 18px;
  }

  .proof-header {
    flex-direction: column;
    gap: 12px;
  }

  .proof-context {
    padding: 14px;
  }
}

.attempt-label {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

</style>
