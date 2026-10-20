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
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
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

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
}

async function refresh() {
  const response = await api<{ results: Observation[] }>(
    "/dashboard/results",
    {
      session: props.session,
      goal: props.goal,
    },
  );

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

  if (!text || text.length > 2000 || !observedOn.value) {
    error.value = "Enter a date and a result of 1–2000 characters.";
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
  if (busy.value) return;
  if (!window.confirm("Delete this observed result?")) return;

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
    <header class="results-heading">
      <p class="eyebrow">Beyond checking boxes</p>
      <h3>Observed results</h3>
      <p class="muted">
        What changed because of your efforts? Record outcomes
        separately from completed actions and peer verification.
      </p>
    </header>

    <div class="record-panel">
      <h4>Record an outcome</h4>
      <p class="panel-description">
        Capture an improvement, a setback, or something you learned.
      </p>

      <form @submit.prevent="record">
        <fieldset :disabled="busy">
          <div class="date-field">
            <label :for="`result-date-${props.goal}`">
              Observed on
            </label>
            <input
              :id="`result-date-${props.goal}`"
              v-model="observedOn"
              type="date"
              required
            />
          </div>

          <label :for="`result-text-${props.goal}`">
            What happened?
          </label>
          <textarea
            :id="`result-text-${props.goal}`"
            v-model="description"
            :aria-describedby="`result-hint-${props.goal}`"
            rows="4"
            maxlength="2000"
            required
            placeholder="For example: Received two interview invitations this week."
          />

          <div class="form-footer">
            <span
              :id="`result-hint-${props.goal}`"
              class="character-count"
            >
              {{ description.length }} / 2000 characters
            </span>

            <button class="primary" type="submit">
              {{ busy ? "Please wait..." : "Record result" }}
            </button>
          </div>
        </fieldset>
      </form>
    </div>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
    <p v-if="success" class="success-message" role="status">
      {{ success }}
    </p>
    <p v-if="busy" class="muted" role="status">
      Updating results...
    </p>

    <header class="history-heading">
      <h4>Result history</h4>
      <span class="result-count">
        {{ results.length }}
      </span>
    </header>

    <ul v-if="results.length" class="result-list">
      <li
        v-for="item in results"
        :key="item.result"
        class="result-card"
      >
        <header class="result-card-header">
          <time :datetime="item.observedOn">
            {{ formatDate(item.observedOn) }}
          </time>

          <button
            class="text-button delete-button"
            type="button"
            :disabled="busy"
            @click="remove(item.result)"
          >
            Delete result
          </button>
        </header>

        <p class="observation">{{ item.description }}</p>
      </li>
    </ul>

    <div
      v-else-if="!busy && !error"
      class="empty-state"
    >
      <strong>Your results will appear here</strong>
      <p>
        Your first observation gives you a starting point for
        understanding whether your strategy is working.
      </p>
    </div>

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
  margin-top: 24px;
  overflow-wrap: anywhere;
}

.results-heading {
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.results-heading h3 {
  margin: 0;
  font-size: 26px;
  line-height: 1.3;
}

.results-heading .muted {
  max-width: 65ch;
  margin: 12px 0 0;
}

.record-panel {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--background);
}

.record-panel h4 {
  margin: 0;
  font-size: 18px;
}

.panel-description {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

fieldset {
  min-width: 0;
  margin-top: 20px;
}

.date-field {
  display: grid;
  gap: 8px;
  max-width: 240px;
}

input,
textarea {
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.date-field input {
  margin-bottom: 0;
}

textarea {
  line-height: 1.6;
  resize: vertical;
}

input:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 4px;
}

.character-count {
  color: var(--muted);
  font-size: 12px;
}

.success-message {
  padding: 12px 16px;
  border-radius: 10px;
  background: #eee8fb;
  color: #6041b1;
  line-height: 1.6;
}

.history-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 32px 0 16px;
}

.history-heading h4 {
  margin: 0;
  font-size: 18px;
}

.result-count {
  min-width: 26px;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--background);
  color: var(--muted);
  text-align: center;
  font-size: 12px;
  font-weight: 650;
}

.result-list {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-card {
  padding: 22px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 3px 12px rgb(41 36 59 / 4%);
}

.result-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

time {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.delete-button {
  margin: 0;
  color: #a32939;
  font-size: 12px;
}

.observation {
  margin: 16px 0 0;
  line-height: 1.7;
  white-space: pre-wrap;
}

.empty-state {
  padding: 28px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  color: var(--muted);
  text-align: center;
}

.empty-state strong {
  color: var(--text);
}

.empty-state p {
  max-width: 50ch;
  margin: 10px auto 0;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .record-panel,
  .result-card {
    padding: 18px;
  }

  .date-field {
    max-width: none;
  }

  .form-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
