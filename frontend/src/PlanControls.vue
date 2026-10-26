
<script setup lang="ts">
import { reactive, ref } from "vue";
import { api, ApiError } from "./api";
import DeleteGoalButton from "./DeleteGoalButton.vue";

const props = defineProps<{
  session: string;
  goal: string;
}>();

const emit = defineEmits<{
  saved: [];
  deleted: [];
}>();

const fields = reactive({
  outcome: "",
  currentContext: "",
  constraints: "",
  timeline: "",
  successDefinition: "",
});

const labels = [
  { key: "outcome", label: "Desired outcome" },
  { key: "currentContext", label: "Starting point" },
  { key: "constraints", label: "Constraints" },
  { key: "timeline", label: "Timeline" },
  { key: "successDefinition", label: "Success definition" },
] as const;

type Commitment = {
  commitment: string;
  description: string;
  active: boolean;
};

const commitments = ref<Commitment[]>([]);
const selected = ref("");
const loading = ref(false);
const saving = ref(false);
const ready = ref(false);
const error = ref("");
const success = ref("");

function message(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "UNAUTHORIZED") {
      return "Your session has expired. Please sign in again.";
    }

    if (cause.code === "FORBIDDEN") {
      return "You do not have permission to change this plan.";
    }

    if (cause.code === "NOT_FOUND") {
      return "The goal or commitment could not be found.";
    }

    if (cause.code === "CONFLICT") {
      return "This commitment is already retired. Reload the plan.";
    }

    return "Could not save changes. Please try again.";
  }

  return cause instanceof Error
    ? cause.message
    : "Could not save changes.";
}

async function load() {
  if (loading.value || saving.value) return;

  loading.value = true;
  ready.value = false;
  error.value = "";

  try {
    const response = await api<{
      detail: typeof fields & {
        commitments: Commitment[];
      };
    }>("/dashboard/goal", {
      session: props.session,
      goal: props.goal,
    });

    for (const item of labels) {
      fields[item.key] = response.detail[item.key];
    }

    commitments.value = response.detail.commitments;
    selected.value = "";
    ready.value = true;
  } catch (cause) {
    error.value = message(cause);
  } finally {
    loading.value = false;
  }
}

function opened(event: Event) {
  const panel = event.currentTarget as HTMLDetailsElement;

  if (panel.open) {
    void load();
  }
}

async function updateGoal() {
  if (saving.value || loading.value || !ready.value) {
    return;
  }

  error.value = "";
  success.value = "";

  const values = Object.fromEntries(
    labels.map(({ key }) => [
      key,
      fields[key].trim(),
    ]),
  );

  if (Object.values(values).some((value) => !value)) {
    error.value = "Complete every goal field.";
    return;
  }

  saving.value = true;

  try {
    await api("/goals/update", {
      session: props.session,
      goal: props.goal,
      ...values,
    });

    success.value =
      "Goal updated. Your saved strategy has not changed.";

    emit("saved");
  } catch (cause) {
    error.value = message(cause);
  } finally {
    saving.value = false;
  }
}

async function retire() {
  if (saving.value || loading.value || !selected.value) {
    return;
  }

  if (
    !window.confirm(
      "Retire this commitment? Its proof and completion history will remain available.",
    )
  ) {
    return;
  }

  const commitment = selected.value;

  saving.value = true;
  error.value = "";
  success.value = "";

  try {
    await api("/commitments/retire", {
      session: props.session,
      goal: props.goal,
      commitment,
    });

    commitments.value = commitments.value.map(
      (item) =>
        item.commitment === commitment
          ? { ...item, active: false }
          : item,
    );

    selected.value = "";

    success.value =
      "Commitment retired. Its history is preserved.";

    emit("saved");
  } catch (cause) {
    error.value = message(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <details
    class="plan-controls"
    @toggle="opened"
  >
    <summary>
      ⚙ Goal settings — Edit goal and manage commitments
    </summary>

    <p v-if="loading" role="status">
      Loading settings...
    </p>

    <template v-if="ready">
      <section class="settings-section">
        <h3>Edit goal</h3>

        <p class="muted">
          Update your goal context without replacing
          your current strategy.
        </p>

        <form @submit.prevent="updateGoal">
          <fieldset :disabled="saving || loading">
            <template
              v-for="item in labels"
              :key="item.key"
            >
              <label
                :for="`edit-${item.key}-${props.goal}`"
              >
                {{ item.label }}
              </label>

              <textarea
                :id="`edit-${item.key}-${props.goal}`"
                v-model="fields[item.key]"
                rows="2"
                required
              />
            </template>

            <button class="primary" type="submit">
              {{ saving ? "Saving..." : "Save goal" }}
            </button>
          </fieldset>
        </form>
      </section>

      <section class="settings-section">
        <h3>Manage commitments</h3>

        <p class="muted">
          Retire a commitment to stop future submissions
          while preserving its completion and proof history.
        </p>

        <form
          v-if="commitments.some((item) => item.active)"
          @submit.prevent="retire"
        >
          <fieldset :disabled="saving || loading">
            <label :for="`retire-${props.goal}`">
              Active commitment
            </label>

            <select
              :id="`retire-${props.goal}`"
              v-model="selected"
              required
            >
              <option disabled value="">
                Choose a commitment
              </option>

              <template
                v-for="item in commitments"
                :key="item.commitment"
              >
                <option
                  v-if="item.active"
                  :value="item.commitment"
                >
                  {{ item.description }}
                </option>
              </template>
            </select>

            <button
              class="primary"
              type="submit"
              :disabled="!selected"
            >
              Retire commitment
            </button>
          </fieldset>
        </form>

        <p v-else class="muted">
          No active commitments.
        </p>
      </section>

      <section
        class="danger-zone"
        aria-labelledby="delete-goal-heading"
      >
        <h3 id="delete-goal-heading">Danger zone</h3>

        <p>
          Permanently delete this goal and its associated
          commitments, proofs, reviews and recorded results.
          This action cannot be undone.
        </p>

        <DeleteGoalButton
          :session="props.session"
          :goal="props.goal"
          :outcome="fields.outcome"
          @deleted="emit('deleted')"
        />
      </section>
    </template>

    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <p v-if="success" role="status">
      {{ success }}
    </p>

    <button
      class="text-button"
      type="button"
      :disabled="saving || loading"
      @click="load"
    >
      Reload settings
    </button>
  </details>
</template>

<style scoped>
.plan-controls {
  margin-top: 24px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
}

.plan-controls > summary {
  color: var(--accent);
  cursor: pointer;
  font-size: 14px;
  font-weight: 750;
}

.plan-controls > summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.settings-section {
  padding: 24px 0;
  border-bottom: 1px solid var(--border);
}

.settings-section h3 {
  margin: 0 0 9px;
  font-size: 19px;
}

.settings-section > .muted {
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.6;
}

fieldset {
  display: grid;
  gap: 12px;
  min-width: 0;
  border: 0;
  padding: 0;
}

textarea,
select {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: white;
  color: var(--text);
  font: inherit;
}

textarea {
  resize: vertical;
}

textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.danger-zone {
  margin: 27px 0 15px;
  padding: 21px;
  border: 1px solid #eebdc5;
  border-radius: 14px;
  background: #fff9fa;
}

.danger-zone h3 {
  margin: 0 0 10px;
  color: #a32939;
  font-size: 18px;
}

.danger-zone p {
  margin: 0 0 12px;
  color: #765760;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 600px) {
  .plan-controls {
    padding: 16px;
  }

  .danger-zone {
    padding: 16px;
  }
}
</style>
