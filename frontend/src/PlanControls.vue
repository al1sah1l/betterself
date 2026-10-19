<script setup lang="ts">
import { reactive, ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
}>();

const emit = defineEmits<{
  saved: [];
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
  if (
    saving.value ||
    loading.value ||
    !ready.value
  ) {
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

  if (
    Object.values(values).some(
      (value) => !value,
    )
  ) {
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
  if (
    saving.value ||
    loading.value ||
    !selected.value
  ) {
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
      Edit goal and manage commitments
    </summary>

    <p v-if="loading" role="status">
      Loading plan...
    </p>

    <template v-if="ready">
      <h3>Edit goal</h3>

      <p class="muted">
        Changing goal context keeps the current strategy.
        You can review the strategy separately.
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

          <button
            class="primary"
            type="submit"
          >
            {{ saving ? "Saving..." : "Save goal" }}
          </button>
        </fieldset>
      </form>

      <h3>Retire a commitment</h3>

      <p class="muted">
        Stop future submissions while keeping completion
        claims, proofs, and peer reviews.
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
    </template>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
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
      Reload plan
    </button>
  </details>
</template>

<style scoped>
.plan-controls {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-top: 24px;
}

summary {
  cursor: pointer;
  font-weight: 600;
}

textarea,
select {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
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
</style>
