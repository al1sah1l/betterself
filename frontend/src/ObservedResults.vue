<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
}>();

type Observation = {
  result: string;
  description: string;
  observedOn: string;
};

const results = ref<Observation[]>([]);
const description = ref("");

const today = new Date();

const observedOn = ref(
  `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`,
);

const busy = ref(false);
const error = ref("");
const success = ref("");

function message(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "UNAUTHORIZED") {
      return "Your session has expired. Please sign in again.";
    }

    if (cause.code === "FORBIDDEN") {
      return "You do not have access to these results.";
    }

    if (cause.code === "INVALID_REQUEST") {
      return "Enter a valid date and a result of 1–2000 characters.";
    }

    if (cause.code === "NOT_FOUND") {
      return "The goal or result could not be found.";
    }

    return "Could not update results. Please try again.";
  }

  return cause instanceof Error
    ? cause.message
    : "Could not update results.";
}

async function refresh() {
  const response = await api<{
    results: Observation[];
  }>("/dashboard/results", {
    session: props.session,
    goal: props.goal,
  });

  results.value = response.results;
}

async function load() {
  if (busy.value) return;

  busy.value = true;
  error.value = "";

  try {
    await refresh();
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}

async function record() {
  if (busy.value) return;

  error.value = "";
  success.value = "";

  const text = description.value.trim();

  if (
    !text ||
    text.length > 2000 ||
    !observedOn.value
  ) {
    error.value =
      "Enter a date and a result of 1–2000 characters.";
    return;
  }

  busy.value = true;
  let saved = false;

  try {
    await api<{ result: string }>("/results/record", {
      session: props.session,
      goal: props.goal,
      description: text,
      observedOn: observedOn.value,
    });

    saved = true;
    description.value = "";
    success.value = "Result recorded.";

    await refresh();
  } catch (cause) {
    error.value = saved
      ? "Result saved, but the list could not refresh. Use Reload results."
      : message(cause);
  } finally {
    busy.value = false;
  }
}

async function remove(result: string) {
  if (
    busy.value ||
    !window.confirm("Delete this observed result?")
  ) {
    return;
  }

  busy.value = true;
  error.value = "";
  success.value = "";

  try {
    await api<{ result: string }>("/results/remove", {
      session: props.session,
      goal: props.goal,
      result,
    });

    results.value = results.value.filter(
      (item) => item.result !== result,
    );

    success.value = "Result deleted.";
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section
    class="observed-results"
    aria-label="Observed results"
    :aria-busy="busy"
  >
    <h3>Observed results</h3>

    <p class="muted">
      What changed because of your efforts? Record outcomes
      separately from actions completed and peer verification.
    </p>

    <form @submit.prevent="record">
      <fieldset :disabled="busy">
        <label :for="`result-date-${props.goal}`">
          Observed on
        </label>

        <input
          :id="`result-date-${props.goal}`"
          v-model="observedOn"
          type="date"
          required
        />

        <label :for="`result-text-${props.goal}`">
          What happened?
        </label>

        <textarea
          :id="`result-text-${props.goal}`"
          v-model="description"
          rows="3"
          maxlength="2000"
          required
          placeholder="For example: Received two interview invitations this week."
        />

        <button class="primary" type="submit">
          {{ busy ? "Please wait..." : "Record result" }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="success" role="status">
      {{ success }}
    </p>

    <p v-if="busy" role="status">
      Updating results...
    </p>

    <ul v-if="results.length">
      <li
        v-for="item in results"
        :key="item.result"
      >
        <time :datetime="item.observedOn">
          {{ item.observedOn }}
        </time>

        <p class="observation">
          {{ item.description }}
        </p>

        <button
          class="text-button"
          type="button"
          :disabled="busy"
          @click="remove(item.result)"
        >
          Delete result
        </button>
      </li>
    </ul>

    <p
      v-else-if="!busy && !error"
      class="muted"
    >
      No observed results yet.
    </p>

    <button
      class="text-button"
      type="button"
      :disabled="busy"
      @click="load"
    >
      Reload results
    </button>
  </section>
</template>

<style scoped>
.observed-results {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
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

li {
  margin-top: 20px;
}

time {
  color: var(--muted);
  font-size: 14px;
}

.observation {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
