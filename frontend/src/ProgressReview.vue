<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
}>();

const emit = defineEmits<{
  saved: [];
}>();

type Step = {
  description: string;
  successCriterion: string;
};

type Proposal = {
  analysis: string;
  strategy: Step[];
  revision: string;
};

const proposal = ref<Proposal | null>(null);
const busy = ref(false);
const error = ref("");
const success = ref("");

function message(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "UNAUTHORIZED") {
      return "Your session expired. Please sign in again.";
    }

    if (cause.code === "FORBIDDEN") {
      return "You cannot review this goal.";
    }

    if (cause.code === "NOT_FOUND") {
      return "This goal could not be found.";
    }

    if (cause.code === "CONFLICT") {
      return "The strategy changed, or no initial strategy is saved. Reload the goal and generate a new review.";
    }

    if (cause.code === "INVALID_REQUEST") {
      return "Save an initial strategy first and make sure every proposed step has an action and success criterion.";
    }

    return "AI review could not finish. Please try again.";
  }

  return cause instanceof Error
    ? cause.message
    : "Could not finish the review.";
}

async function generate() {
  if (busy.value) return;

  if (
    proposal.value &&
    !window.confirm(
      "Discard this draft and generate a new review?",
    )
  ) {
    return;
  }

  busy.value = true;
  error.value = "";
  success.value = "";

  try {
    proposal.value = await api<Proposal>(
      "/reviews/propose",
      {
        session: props.session,
        goal: props.goal,
      },
    );
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}

async function apply() {
  if (busy.value || !proposal.value) return;

  if (
    !proposal.value.strategy.length ||
    proposal.value.strategy.some(
      (step) =>
        !step.description.trim() ||
        !step.successCriterion.trim(),
    )
  ) {
    error.value =
      "Complete every strategy step and success criterion.";
    return;
  }

  if (
    !window.confirm(
      "Replace your current strategy with these steps? Existing commitments and history will remain.",
    )
  ) {
    return;
  }

  busy.value = true;
  error.value = "";
  success.value = "";

  try {
    await api("/reviews/apply", {
      session: props.session,
      goal: props.goal,
      strategy: proposal.value.strategy,
      expectedRevision: proposal.value.revision,
    });

    proposal.value = null;

    success.value =
      "Strategy updated. Retire obsolete commitments and create new commitments where needed.";

    emit("saved");
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}

function reject() {
  if (busy.value) return;

  proposal.value = null;
  error.value = "";
  success.value =
    "Proposal rejected. Your strategy has not changed.";
}
</script>

<template>
  <section
    class="progress-review"
    aria-label="Progress review"
    :aria-busy="busy"
  >
    <h3>Review your progress</h3>

    <p class="muted">
      AI compares your saved strategy, reported execution,
      evidence, peer reviews, and observed results.
      You decide whether to change the plan.
    </p>

    <p class="muted">
      Save an initial strategy before requesting a review.
      Review drafts are not saved after leaving this page.
    </p>

    <button
      class="primary"
      type="button"
      :disabled="busy"
      @click="generate"
    >
      {{
        busy
          ? "Please wait..."
          : proposal
            ? "Generate another review"
            : "Generate AI review"
      }}
    </button>

    <p v-if="busy" role="status">
      Working on your review...
    </p>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="success" role="status">
      {{ success }}
    </p>

    <template v-if="proposal">
      <h4>Analysis</h4>

      <p class="analysis">
        {{ proposal.analysis }}
      </p>

      <h4>Proposed strategy</h4>

      <p class="muted">
        Edit the steps before accepting.
        Existing commitments will remain active
        until you retire them.
      </p>

      <form @submit.prevent="apply">
        <fieldset :disabled="busy">
          <div
            v-for="(step, index) in proposal.strategy"
            :key="index"
            class="step"
          >
            <label
              :for="`review-action-${props.goal}-${index}`"
            >
              Step {{ index + 1 }}
            </label>

            <textarea
              :id="`review-action-${props.goal}-${index}`"
              v-model="step.description"
              rows="2"
              required
            />

            <label
              :for="`review-success-${props.goal}-${index}`"
            >
              Success criterion
            </label>

            <textarea
              :id="`review-success-${props.goal}-${index}`"
              v-model="step.successCriterion"
              rows="2"
              required
            />
          </div>

          <button class="primary" type="submit">
            Accept edited strategy
          </button>

          <button
            class="text-button"
            type="button"
            @click="reject"
          >
            Reject proposal
          </button>
        </fieldset>
      </form>
    </template>
  </section>
</template>

<style scoped>
.progress-review {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.analysis {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.step {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}

textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
