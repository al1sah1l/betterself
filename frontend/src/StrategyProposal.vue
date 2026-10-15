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

type StrategyStep = {
  description: string;
  successCriterion: string;
};

const proposal = ref<StrategyStep[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case "UNAUTHORIZED":
        return "Your session has expired. Please sign out and sign in again.";
      case "FORBIDDEN":
        return "You do not have access to this goal.";
      case "NOT_FOUND":
        return "This goal could not be found.";
      case "CONFLICT":
        return "This goal already has a saved strategy. Reload the goal to see it.";
      case "INVALID_REQUEST":
        return "Please check the strategy and try again.";
      default:
        return "Could not complete the request. Please try again.";
    }
  }

  return cause instanceof Error
    ? cause.message
    : "Could not complete the request. Please try again.";
}

async function requestProposal() {
  if (loading.value || saving.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ strategy: StrategyStep[] }>(
      "/strategies/propose",
      {
        session: props.session,
        goal: props.goal,
      },
    );

    proposal.value = result.strategy.map((step) => ({
      description: step.description,
      successCriterion: step.successCriterion,
    }));
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

async function saveStrategy() {
  if (loading.value || saving.value) return;

  error.value = "";

  const strategy = proposal.value.map((step) => ({
    description: step.description.trim(),
    successCriterion: step.successCriterion.trim(),
  }));

  if (
    strategy.length === 0 ||
    strategy.some(
      (step) => !step.description || !step.successCriterion,
    )
  ) {
    error.value = "Every step needs a description and success criterion.";
    return;
  }

  saving.value = true;

  try {
    await api<{ goal: string }>("/goals/set-strategy", {
      session: props.session,
      goal: props.goal,
      strategy,
    });

    proposal.value = [];
    emit("saved");
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section aria-label="Strategy proposal">
    <p class="muted">
      Get an AI starting point, then edit it to fit your goal.
      Your proposal is saved only when you choose Save strategy.
    </p>

    <button
      v-if="proposal.length === 0"
      class="primary"
      type="button"
      :disabled="loading || saving"
      @click="requestProposal"
    >
      {{ loading ? "Generating strategy..." : "Suggest a strategy" }}
    </button>

    <p v-if="loading" role="status">
      Preparing your proposal. This may take a moment.
    </p>

    <form v-if="proposal.length" @submit.prevent="saveStrategy">
      <fieldset :disabled="loading || saving">
        <div
          v-for="(step, index) in proposal"
          :key="index"
          class="strategy-step"
        >
          <h4>Step {{ index + 1 }}</h4>

          <label :for="`strategy-description-${index}`">
            Action
          </label>
          <textarea
            :id="`strategy-description-${index}`"
            v-model="step.description"
            rows="3"
            required
          />

          <label :for="`strategy-success-${index}`">
            Success criterion
          </label>
          <textarea
            :id="`strategy-success-${index}`"
            v-model="step.successCriterion"
            rows="2"
            required
          />
        </div>

        <button class="primary" type="submit">
          {{ saving ? "Saving..." : "Save strategy" }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.strategy-step {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

h4 {
  margin: 0;
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
