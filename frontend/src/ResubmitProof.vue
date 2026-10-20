<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  proof: string;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const evidence = ref("");
const loading = ref(false);
const submitted = ref(false);
const error = ref("");

async function resubmit() {
  if (loading.value || submitted.value) return;

  error.value = "";

  const items = evidence.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.length) {
    error.value = "Add at least one piece of evidence.";
    return;
  }

  loading.value = true;

  try {
    await api<{ proof: string }>("/proofs/resubmit", {
      session: props.session,
      previousProof: props.proof,
      evidence: items,
    });

    submitted.value = true;
    evidence.value = "";
    emit("submitted");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign in again."
          : cause.code === "FORBIDDEN"
            ? "Only the author can submit new evidence."
            : cause.code === "NOT_FOUND"
              ? "The proof or commitment no longer exists."
              : cause.code === "CONFLICT"
                ? "This proof is no longer eligible for resubmission, or the commitment is retired. Reload the goal."
                : cause.code === "INVALID_REQUEST"
                  ? "Please check your evidence."
                  : "Could not submit new evidence. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not submit new evidence.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <details class="resubmission">
    <summary>Submit new evidence</summary>

    <p class="muted explanation">
      Address the feedback with clearer evidence for the same completion.
      Your previous proof and reviews will stay in the history.
    </p>

    <form @submit.prevent="resubmit">
      <fieldset :disabled="loading || submitted">
        <label :for="`resubmit-evidence-${props.proof}`">
          New evidence
        </label>

        <textarea
          :id="`resubmit-evidence-${props.proof}`"
          v-model="evidence"
          rows="4"
          required
          placeholder="Add clearer evidence text or links, one item per line."
        />

        <button
          class="primary"
          type="submit"
          :disabled="loading || submitted"
        >
          {{
            loading
              ? "Submitting..."
              : submitted
                ? "New evidence submitted"
                : "Submit new evidence"
          }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="submitted" class="muted" role="status">
      New evidence submitted. Reload the goal if the new attempt is not visible.
    </p>
  </details>
</template>

<style scoped>
.resubmission {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

summary {
  color: var(--accent);
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}

summary:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.explanation {
  font-size: 13px;
  line-height: 1.6;
}

fieldset {
  min-width: 0;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.6;
  resize: vertical;
}
</style>
