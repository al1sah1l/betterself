
<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue";

import { api } from "./api";

const props = defineProps<{
  session: string;
  currentGoal?: string;
}>();

const emit = defineEmits<{
  changed: [goal: string | null];
}>();

type Goal = {
  goal: string;
  outcome: string;
};

const goals = ref<Goal[]>([]);
const priorityGoal = ref<string | null>(null);
const selectedGoal = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const success = ref("");

let requestId = 0;

const priority = computed(() =>
  goals.value.find(
    (goal) => goal.goal === priorityGoal.value,
  ),
);

const isCurrentPriority = computed(
  () =>
    !!props.currentGoal &&
    props.currentGoal === priorityGoal.value,
);

async function load() {
  const id = ++requestId;
  loading.value = true;
  error.value = "";
  success.value = "";

  try {
    const [goalResponse, priorityResponse] =
      await Promise.all([
        api<{ goals: Goal[] }>(
          "/dashboard/goals",
          { session: props.session },
        ),
        api<{ goal: string | null }>(
          "/goals/priority",
          { session: props.session },
        ),
      ]);

    if (id !== requestId) return;

    goals.value = goalResponse.goals ?? [];
    priorityGoal.value = priorityResponse.goal;
    selectedGoal.value = priorityResponse.goal ?? "";

    emit("changed", priorityGoal.value);
  } catch {
    if (id === requestId) {
      error.value =
        "Could not load your priority. Try again.";
    }
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

async function savePriority(goal: string | null) {
  if (saving.value || loading.value) return;

  const previous = priorityGoal.value;
  saving.value = true;
  error.value = "";
  success.value = "";

  try {
    const response = await api<{
      goal: string | null;
    }>("/goals/set-priority", {
      session: props.session,
      goal,
    });

    priorityGoal.value = response.goal;
    selectedGoal.value = response.goal ?? "";

    emit("changed", response.goal);

    success.value = response.goal
      ? "Your priority has been updated."
      : "Your priority has been cleared.";
  } catch {
    selectedGoal.value = previous ?? "";
    error.value =
      "Could not save your priority. Please try again.";
  } finally {
    saving.value = false;
  }
}

function onSelectionChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  void savePriority(target.value || null);
}

watch(
  () => props.session,
  () => void load(),
);

onMounted(load);
</script>

<template>
  <section
    class="priority-picker"
    aria-label="Your priority goal"
  >
    <div class="priority-heading">
      <div>
        <p class="eyebrow">
          ★ YOUR CURRENT FOCUS
        </p>

        <h3 v-if="loading">
          Loading your priority...
        </h3>

        <h3 v-else-if="priority">
          {{ priority.outcome }}
        </h3>

        <h3 v-else>
          No priority selected
        </h3>

        <p>
          Focus on what matters most right now.
          You can change this anytime.
        </p>
      </div>

      <span
        v-if="isCurrentPriority"
        class="priority-badge"
      >
        ★ This goal is your priority
      </span>
    </div>

    <div
      v-if="!loading"
      class="priority-actions"
    >
      <button
        v-if="currentGoal && !isCurrentPriority"
        type="button"
        class="make-priority"
        :disabled="saving"
        @click="savePriority(currentGoal)"
      >
        ★ Prioritize this goal instead
      </button>

      <label class="priority-select">
        <span>Change your priority</span>

        <select
          :value="selectedGoal"
          :disabled="saving"
          @change="onSelectionChange"
        >
          <option value="">
            No priority
          </option>

          <option
            v-for="goal in goals"
            :key="goal.goal"
            :value="goal.goal"
          >
            {{ goal.outcome }}
          </option>
        </select>
      </label>
    </div>

    <p
      v-if="saving"
      class="status"
      role="status"
    >
      Saving your priority...
    </p>

    <p
      v-if="success"
      class="success"
      role="status"
    >
      {{ success }}
    </p>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<style scoped>
.priority-picker {
  padding: 20px 23px;
  border: 1px solid #dfd2f5;
  border-radius: 18px;
  background: #faf7ff;
  color: #382854;
}

.priority-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #7650c4;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.11em;
}

.priority-heading h3 {
  margin: 0;
  font-size: clamp(17px, 2vw, 21px);
  line-height: 1.4;
}

.priority-heading p {
  margin: 9px 0 0;
  color: #786b8b;
  font-size: 12px;
  line-height: 1.6;
}

.priority-badge {
  flex-shrink: 0;
  padding: 8px 11px;
  border-radius: 999px;
  background: #e8ddfa;
  color: #6945b1;
  font-size: 11px;
  font-weight: 750;
}

.priority-actions {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.make-priority {
  min-height: 42px;
  padding: 10px 15px;
  border: 0;
  border-radius: 10px;
  background: #7354c5;
  color: white;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.priority-select {
  display: grid;
  flex: 1;
  min-width: 210px;
  gap: 7px;
  color: #6c5b80;
  font-size: 12px;
  font-weight: 750;
}

.priority-select select {
  width: 100%;
  min-height: 43px;
  padding: 10px 12px;
  border: 1px solid #d8c9ef;
  border-radius: 10px;
  background: white;
  color: #382854;
  font: inherit;
  font-size: 13px;
}

.status,
.success,
.error {
  margin: 12px 0 0;
  font-size: 12px;
}

.success {
  color: #6743b8;
}

.error {
  color: #a32939;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

@media (max-width: 600px) {
  .priority-picker {
    padding: 17px;
  }

  .priority-heading {
    flex-wrap: wrap;
  }

  .priority-select {
    min-width: 100%;
  }
}
</style>
