<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
  outcome: string;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

const busy = ref(false);
const error = ref("");

async function removeGoal() {
  if (busy.value) return;

  if (
    !window.confirm(
      `Permanently delete "${props.outcome}"?\n\n` +
      "Its commitments, completion claims, proofs, " +
      "peer reviews and observed results will be removed.",
    )
  ) {
    return;
  }

  const confirmation = window.prompt(
    "Type DELETE to confirm:",
  );

  if (confirmation !== "DELETE") return;

  busy.value = true;
  error.value = "";

  try {
    await api<{ deleted: boolean }>(
      "/goals/delete",
      {
        session: props.session,
        goal: props.goal,
      },
    );

    emit("deleted");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "FORBIDDEN"
          ? "Only the owner can delete this goal."
          : cause.code === "NOT_FOUND"
            ? "This goal no longer exists."
            : "Could not delete this goal. Please retry."
        : "Could not delete this goal. Please retry.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="delete-goal-action">
    <button
      type="button"
      class="delete-button"
      :disabled="busy"
      @click="removeGoal"
    >
      {{ busy ? "Deleting..." : "Delete goal" }}
    </button>

    <p
      v-if="error"
      class="delete-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.delete-goal-action {
  margin-top: 14px;
}

.delete-button {
  padding: 9px 12px;
  border: 1px solid #efc9d0;
  border-radius: 10px;
  background: #fff8f9;
  color: #a32939;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.delete-button:hover:not(:disabled) {
  background: #fdebef;
}

.delete-error {
  color: #a32939;
  font-size: 12px;
  line-height: 1.5;
}
</style>
