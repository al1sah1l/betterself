<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  proof: string;
}>();

const emit = defineEmits<{
  reviewed: [];
}>();

const decision = ref<"verified" | "disputed">("verified");
const note = ref("");
const loading = ref(false);
const error = ref("");

async function reviewProof() {
  if (loading.value) return;

  error.value = "";
  loading.value = true;

  try {
    await api<{ proof: string }>("/proofs/review", {
      session: props.session,
      proof: props.proof,
      decision: decision.value,
      note: note.value.trim(),
    });

    emit("reviewed");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "You must be a group member reviewing someone else's proof."
            : cause.code === "CONFLICT"
              ? "You have already reviewed this proof."
              : cause.code === "NOT_FOUND"
                ? "This proof could not be found."
                : cause.code === "INVALID_REQUEST"
                  ? "Please check your review."
                  : "Could not save your review. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not save your review. Please try again.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="reviewProof">
    <fieldset :disabled="loading">
      <legend>Review this proof</legend>

      <label :for="`decision-${props.proof}`">Decision</label>
      <select
        :id="`decision-${props.proof}`"
        v-model="decision"
      >
        <option value="verified">Verified — evidence supports completion</option>
        <option value="disputed">Disputed — evidence is insufficient</option>
      </select>

      <label :for="`review-note-${props.proof}`">
        Note (optional)
      </label>
      <textarea
        :id="`review-note-${props.proof}`"
        v-model="note"
        rows="2"
        placeholder="Explain your decision."
      />

      <button class="primary" type="submit">
        {{ loading ? "Saving..." : "Save review" }}
      </button>
    </fieldset>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>

<style scoped>
select,
textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

textarea {
  resize: vertical;
}

select:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>