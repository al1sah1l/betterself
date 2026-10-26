
<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from "vue";
import { ApiError } from "./api";
import {
  completedCount,
  loadGoalOverviews,
  type GoalOverview,
} from "./overview-data";

const props = defineProps<{
  session: string;
  account: string;
}>();

const emit = defineEmits<{
  (event: "open-goal", goal: string): void;
  (
    event: "navigate",
    page: "goals" | "commitments" | "groups",
  ): void;
}>();

const goals = ref<GoalOverview[]>([]);
const loading = ref(false);
const error = ref("");
let requestId = 0;

async function refresh() {
  const id = ++requestId;
  loading.value = true;
  error.value = "";

  try {
    const response = await loadGoalOverviews(props.session);

    if (id === requestId) {
      goals.value = response;
    }
  } catch (cause) {
    if (id === requestId) {
      error.value =
        cause instanceof ApiError &&
        cause.code === "UNAUTHORIZED"
          ? "Your session expired. Please sign in again."
          : "Could not load your dashboard. Please retry.";
    }
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

const allCommitments = computed(() =>
  goals.value.flatMap((goal) => goal.commitments),
);

const activeCount = computed(
  () =>
    allCommitments.value.filter((item) => item.active).length,
);

const totalCompletions = computed(() =>
  completedCount(allCommitments.value),
);

const goalsWithActivity = computed(
  () =>
    goals.value.filter((goal) =>
      goal.commitments.some(
        (item) => item.completions.length > 0,
      ),
    ).length,
);

const recent = computed(() =>
  goals.value
    .flatMap((goal) =>
      goal.commitments
        .filter((item) => item.active)
        .map((item) => ({
          ...item,
          goalId: goal.goal,
          outcome: goal.outcome,
        })),
    )
    .slice(0, 5),
);

onMounted(refresh);
onActivated(refresh);
</script>

<template>
  <section
    class="overview-page"
    aria-labelledby="dashboard-heading"
  >
    <header class="overview-heading">
      <div>
        <p class="eyebrow">YOUR WORKSPACE</p>
        <h1 id="dashboard-heading">
          Welcome back, {{ account }}!
        </h1>
        <p class="muted">
          Turn your plans into progress, one commitment at a time.
        </p>
      </div>

      <button
        class="overview-refresh"
        type="button"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? "Refreshing…" : "↻ Refresh" }}
      </button>
    </header>

    <p v-if="error" class="error" role="alert">
      {{ error }}
      <button type="button" @click="refresh">
        Try again
      </button>
    </p>

    <p
      v-if="loading && !goals.length"
      role="status"
      class="muted"
    >
      Loading your workspace…
    </p>

    <template v-else>
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-value">{{ goals.length }}</span>
          <span class="metric-label">Total goals</span>
        </div>

        <div class="metric-card">
          <span class="metric-value">{{ activeCount }}</span>
          <span class="metric-label">Active commitments</span>
        </div>

        <div class="metric-card">
          <span class="metric-value">
            {{ totalCompletions }}
          </span>
          <span class="metric-label">Completion claims</span>
        </div>

        <div class="metric-card">
          <span class="metric-value">
            {{ goalsWithActivity }}
          </span>
          <span class="metric-label">Goals with activity</span>
        </div>
      </div>

      <div class="dashboard-columns">
        <section
          class="overview-panel"
          aria-labelledby="overview-goals-heading"
        >
          <div class="panel-heading">
            <h2 id="overview-goals-heading">Your goals</h2>
            <button
              class="panel-action"
              type="button"
              @click="emit('navigate', 'goals')"
            >
              See all
            </button>
          </div>

          <p v-if="!goals.length" class="muted">
            No goals yet. Create your first goal to get started.
          </p>

          <ul v-else class="overview-list">
            <li
              v-for="goal in goals"
              :key="goal.goal"
            >
              <button
                type="button"
                class="overview-link"
                @click="emit('open-goal', goal.goal)"
              >
                {{ goal.outcome }}
                <span aria-hidden="true">→</span>
              </button>

              <p class="muted small">
                {{
                  goal.commitments.filter((c) => c.active).length
                }}
                active commitments ·
                {{ completedCount(goal.commitments) }}
                completion claims
              </p>
            </li>
          </ul>

          <p class="overview-note">
            Completion claims reflect actions, not whether
            the outcome was achieved.
          </p>
        </section>

        <section
          class="overview-panel"
          aria-labelledby="overview-commitments-heading"
        >
          <div class="panel-heading">
            <h2 id="overview-commitments-heading">
              Active commitments
            </h2>

            <button
              class="panel-action"
              type="button"
              @click="emit('navigate', 'commitments')"
            >
              See all
            </button>
          </div>

          <p v-if="!recent.length" class="muted">
            No active commitments yet. Add one from a goal's strategy.
          </p>

          <ul v-else class="overview-list">
            <li
              v-for="item in recent"
              :key="item.commitment"
            >
              <button
                type="button"
                class="overview-link"
                @click="emit('open-goal', item.goalId)"
              >
                {{ item.description }}
                <span aria-hidden="true">→</span>
              </button>

              <p class="muted small">
                {{ item.outcome }} ·
                {{ item.recurring ? "Recurring" : "One-time" }} ·
                {{ item.schedule }}
              </p>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.overview-page {
  display: grid;
  gap: 24px;
}

.overview-heading,
.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.overview-heading h1 {
  font-size: 30px;
  margin: 5px 0 8px;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  font-weight: 800;
  color: var(--accent);
  margin: 0;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card,
.overview-panel {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 17px;
  padding: 22px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.metric-value {
  font-size: 34px;
  line-height: 1.1;
  font-weight: 750;
  color: var(--accent);
}

.metric-label {
  font-size: 13px;
  color: var(--muted);
}

.dashboard-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.panel-heading {
  align-items: center;
  margin-bottom: 18px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 19px;
}

.panel-action,
.overview-refresh {
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--accent);
  border-radius: 9px;
  padding: 9px 13px;
  font-weight: 650;
  cursor: pointer;
}

.overview-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.overview-list li {
  padding: 15px 0;
  border-bottom: 1px solid var(--border);
}

.overview-list li:last-child {
  border-bottom: 0;
}

.overview-link {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: start;
  justify-content: space-between;
  text-align: left;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-weight: 650;
  line-height: 1.45;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.overview-link:hover {
  color: var(--accent);
}

.small {
  font-size: 12px;
  margin: 6px 0 0;
  overflow-wrap: anywhere;
}

.overview-note {
  font-size: 12px;
  color: var(--muted);
  background: var(--background);
  border-radius: 9px;
  padding: 11px;
  margin: 16px 0 0;
}

@media (max-width: 1000px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .dashboard-columns {
    grid-template-columns: 1fr;
  }

  .overview-heading {
    flex-direction: column;
  }
}
</style>
