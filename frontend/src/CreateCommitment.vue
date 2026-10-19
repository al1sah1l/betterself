<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
  initialDescription?: string;
  sourceStep?: string;
}>();

const emit = defineEmits<{
  created: [commitment: string];
  busy: [value: boolean];
}>();

const description = ref(props.initialDescription ?? "");
const recurring = ref(false);
const schedule = ref("");
const loading = ref(false);
const error = ref("");

async function createCommitment() {
  if (loading.value) return;

  error.value = "";

  if (!description.value.trim() || !schedule.value.trim()) {
    error.value = "Enter an action and its schedule.";
    return;
  }

  loading.value = true;
  emit("busy", true);

  try {
    const result = await api<{ commitment: string }>(
      "/commitments/create",
      {
        session: props.session,
        goal: props.goal,
        description: description.value.trim(),
        recurring: recurring.value,
        schedule: schedule.value.trim(),
        sourceStep: props.sourceStep ?? "",
      },
    );

    description.value = "";
    recurring.value = false;
    schedule.value = "";

    emit("created", result.commitment);
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value =
        cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "You do not have access to this goal."
            : cause.code === "NOT_FOUND"
              ? "This goal could not be found."
              : cause.code === "INVALID_REQUEST"
                ? "Please check the commitment details."
                : "Could not create the commitment. Please try again.";
    } else {
      error.value =
        cause instanceof Error
          ? cause.message
          : "Could not create the commitment. Please try again.";
    }
  } finally {
    loading.value = false;
    emit("busy", false);
  }
}
</script>

<template>
  <section aria-label="Create commitment">
    <h4>Add a commitment</h4>

    <form @submit.prevent="createCommitment">
      <fieldset :disabled="loading">
        <label for="commitment-description">What will you do?</label>
        <input
          id="commitment-description"
          v-model="description"
          placeholder="Read for twenty minutes"
          required
        />

        <label for="commitment-schedule">Schedule</label>
        <input
          id="commitment-schedule"
          v-model="schedule"
          placeholder="Every evening, or by Friday"
          required
        />

        <label class="checkbox-label">
          <input v-model="recurring" type="checkbox" />
          This commitment repeats
        </label>

        <button class="primary" type="submit">
          {{ loading ? "Creating..." : "Add commitment" }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.checkbox-label input {
  width: auto;
  margin: 0;
}
</style>
