
<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from "vue";
import { ApiError } from "./api";
import {
  loadGoalOverviews,
  type GoalOverview,
} from "./overview-data";

const props = defineProps<{ session: string }>();

const emit = defineEmits<{
  (event: "open-goal", goal: string): void;
}>();

const goals = ref<GoalOverview[]>([]);
const loading = ref(false);
const error = ref("");
const filter = ref<"active" | "all" | "retired">("active");
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
          : "Could not load commitments. Try again.";
    }
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

const items = computed(() =>
  goals.value.flatMap((goal) =>
    goal.commitments.map((commitment) => ({
      ...commitment,
      outcome: goal.outcome,
      goalId: goal.goal,
    })),
  ),
);

const visible = computed(() =>
  items.value.filter(
    (item) =>
      filter.value === "all" ||
      (filter.value === "active"
        ? item.active
        : !item.active),
  ),
);

onMounted(refresh);
onActivated(refresh);
</script>

<template>
  <section
    class="commitments-page"
    aria-labelledby="all-commitments-heading"
  >
    <header class="commitments-top">
      <div>
        <p class="eyebrow">PUT IT INTO PRACTICE</p>
        <h1 id="all-commitments-heading">
          Commitments
        </h1>
        <p class="muted">
          All your commitments across goals.
          Open a goal to submit proof or change your plan.
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

    <div
      class="filters"
      role="group"
      aria-label="Filter commitments"
    >
      <button
        v-for="option in (['active', 'all', 'retired'] as const)"
        :key="option"
        type="button"
        :aria-pressed="filter === option"
        @click="filter = option"
      >
        {{
          option === "active"
            ? "Active"
            : option === "all"
              ? "All"
              : "Retired"
        }}
        ({{
          option === "all"
            ? items.length
            : items.filter(
                (item) =>
                  item.active === (option === "active"),
              ).length
        }})
      </button>
    </div>

    <p v-if="error" class="error" role="alert">
      {{ error }}
      <button type="button" @click="refresh">
        Try again
      </button>
    </p>

    <p
      v-if="loading && !goals.length"
      class="muted"
      role="status"
    >
      Loading commitments…
    </p>

    <p
      v-else-if="!visible.length && !error"
      class="empty-commitments"
    >
      No {{ filter === "all" ? "" : filter }} commitments yet.
      Create one from a goal's strategy.
    </p>

    <ul v-else class="commitment-list">
      <li
        v-for="item in visible"
        :key="item.commitment"
        class="commitment-item"
      >
        <div class="item-top">
          <span
            class="status"
            :class="item.active ? 'active' : 'retired'"
          >
            {{ item.active ? "Active" : "Retired" }}
          </span>

          <span class="muted small">
            {{ item.recurring ? "Recurring" : "One-time" }}
            · {{ item.schedule }}
          </span>
        </div>

        <h2>{{ item.description }}</h2>

        <p class="muted small">
          Goal: {{ item.outcome }} ·
          {{ item.completions.length }} completion claims
        </p>

        <button
          class="open-link"
          type="button"
          @click="emit('open-goal', item.goalId)"
        >
          Open goal →
        </button>
      </li>
    </ul>

    <p class="hint">
      Completion claims are distinct from peer verification
      and observed outcomes.
    </p>
  </section>
</template>

<style scoped>
.commitments-page {
  display: grid;
  gap: 20px;
}

.commitments-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.commitments-top h1 {
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

.overview-refresh {
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--accent);
  border-radius: 9px;
  padding: 9px 13px;
  font-weight: 650;
  cursor: pointer;
  white-space: nowrap;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filters button {
  background: var(--surface);
  color: var(--muted);
  border: 1px solid var(--border);
  padding: 9px 15px;
  border-radius: 999px;
  cursor: pointer;
}

.filters button[aria-pressed="true"] {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.commitment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.commitment-item {
  border: 1px solid var(--border);
  border-radius: 15px;
  padding: 20px;
  background: var(--surface);
  overflow-wrap: anywhere;
}

.item-top {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.commitment-item h2 {
  font-size: 16px;
  line-height: 1.5;
  margin: 12px 0 8px;
}

.status {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.status.active {
  background: #eee6ff;
  color: #6341a6;
}

.status.retired {
  background: #f0eef3;
  color: #716b7c;
}

.small {
  font-size: 13px;
}

.open-link {
  border: 0;
  background: transparent;
  padding: 8px 0 0;
  color: var(--accent);
  font-weight: 650;
  cursor: pointer;
}

.empty-commitments {
  padding: 32px;
  border: 1px dashed var(--border);
  border-radius: 15px;
  color: var(--muted);
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 700px) {
  .commitments-top {
    flex-direction: column;
  }
}
</style>
