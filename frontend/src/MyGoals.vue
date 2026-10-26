
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, ApiError } from "./api";
import CreateGoal from "./CreateGoal.vue";
import GoalDetail from "./GoalDetail.vue";

const props = defineProps<{
  session: string;
  requestedGoal?: string;
}>();

type Goal = {
  goal: string;
  outcome: string;
  timeline: string;
};

const goals = ref<Goal[]>([]);
const loading = ref(false);
const error = ref("");
const selectedGoal = ref("");
const showCreateGoal = ref(false);

async function goalCreated() {
  showCreateGoal.value = false;
  await loadGoals();
}

async function loadGoals() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ goals: Goal[] }>(
      "/dashboard/goals",
      { session: props.session },
    );

    goals.value = result.goals;
  } catch (cause) {
    error.value =
      cause instanceof ApiError &&
      cause.code === "UNAUTHORIZED"
        ? "Your session has expired. Please sign out and sign in again."
        : cause instanceof Error &&
            !(cause instanceof ApiError)
          ? cause.message
          : "Could not load your goals. Please try again.";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.requestedGoal,
  (goal) => {
    if (goal) {
      selectedGoal.value = goal;
    }
  },
  { immediate: true },
);

onMounted(loadGoals);
</script>

<template>
  <section aria-label="Goals">
    <template v-if="selectedGoal">
      <button
        class="text-button"
        type="button"
        @click="selectedGoal = ''"
      >
        ← Back to goals
      </button>

      <GoalDetail
        :key="selectedGoal"
        :session="props.session"
        :goal="selectedGoal"
      />
    </template>

    <template v-else>
      <header class="section-header">
        <h2 id="my-goals-heading">My goals</h2>

        <button
          class="primary"
          type="button"
          :aria-expanded="showCreateGoal"
          aria-controls="create-goal-panel"
          @click="showCreateGoal = !showCreateGoal"
        >
          {{ showCreateGoal ? "Close form" : "+ New goal" }}
        </button>
      </header>

      <div
        id="create-goal-panel"
        v-show="showCreateGoal"
        class="create-goal-panel"
      >
        <CreateGoal
          :session="props.session"
          @created="goalCreated"
        />
      </div>

      <p v-if="loading" role="status">
        Loading goals...
      </p>

      <p
        v-else-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>

      <template v-else>
        <p v-if="goals.length === 0" class="muted">
          No goals yet. Your first goal starts here.
        </p>

        <ul v-else class="goal-grid">
          <li
            v-for="goal in goals"
            :key="goal.goal"
            class="goal-card"
          >
            <strong>{{ goal.outcome }}</strong>
            <p class="muted">
              {{ goal.timeline }}
            </p>

            <button
              class="text-button"
              type="button"
              @click="selectedGoal = goal.goal"
            >
              Open goal
            </button>
          </li>
        </ul>
      </template>

      <button
        class="text-button"
        type="button"
        :disabled="loading"
        @click="loadGoals"
      >
        Reload goals
      </button>
    </template>
  </section>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.section-header h2 {
  margin: 0;
}

.create-goal-panel {
  margin-bottom: 24px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
}

@media (max-width: 600px) {
  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

.goal-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 16px;
  padding: 0;
  margin: 24px 0;
  list-style: none;
}

.goal-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  overflow-wrap: anywhere;
}

.goal-card strong {
  font-size: 18px;
  line-height: 1.4;
}

.goal-card .muted {
  margin: 12px 0;
}

.goal-card button {
  margin-top: auto;
  padding-top: 16px;
}
</style>
