<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
  commitment: string;
  existingOccurrence?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const occurrence = ref("");
const evidence = ref("");
const loading = ref(false);
const error = ref("");
const success = ref("");

async function submitProof() {
  if (loading.value || props.disabled) return;

  error.value = "";
  success.value = "";

  const occurrenceValue =
    props.existingOccurrence ?? occurrence.value;

  const date = new Date(occurrenceValue);

  const items = evidence.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    !occurrenceValue ||
    !Number.isFinite(date.getTime())
  ) {
    error.value = "Choose when you completed this commitment.";
    return;
  }

  if (items.length === 0) {
    error.value = "Add at least one piece of evidence.";
    return;
  }

  loading.value = true;

  try {
    await api<{ proof: string }>("/proofs/submit", {
      session: props.session,
      goal: props.goal,
      commitment: props.commitment,
      occurrence: date.toISOString(),
      evidence: items,
    });

    success.value =
      "Proof submitted. Peer verification is a separate step.";
    evidence.value = "";

    emit("submitted");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "You do not have permission to submit proof for this goal."
            : cause.code === "NOT_FOUND"
              ? "The goal or commitment could not be found."
              : cause.code === "CONFLICT"
                ? "This commitment is already completed, or proof already exists for this occurrence."
                : cause.code === "INVALID_REQUEST"
                  ? "Please check the completion time and evidence."
                  : "Could not submit proof. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not submit proof. Please try again.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="submitProof">
    <fieldset :disabled="loading || props.disabled">
      <legend>Submit proof</legend>

      <p v-if="props.existingOccurrence" class="muted">
        Completed at:
        {{ new Date(props.existingOccurrence).toLocaleString() }}
      </p>

      <template v-else>
        <label :for="`occurrence-${props.commitment}`">
          Completed at (your local time)
        </label>

        <input
          :id="`occurrence-${props.commitment}`"
          v-model="occurrence"
          type="datetime-local"
          required
        />
      </template>

      <label :for="`evidence-${props.commitment}`">
        Evidence
      </label>

      <textarea
        :id="`evidence-${props.commitment}`"
        v-model="evidence"
        rows="3"
        placeholder="Add evidence text or a link, one item per line."
        required
      />

      <button
        class="primary"
        type="submit"
        :disabled="loading || props.disabled"
      >
        {{
          loading
            ? "Submitting..."
            : props.disabled
              ? "Proof already submitted"
              : "Submit proof"
        }}
      </button>
    </fieldset>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="success" role="status">
      {{ success }}
    </p>
  </form>
</template>

<style scoped>
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
