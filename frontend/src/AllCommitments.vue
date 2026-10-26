
<script setup lang="ts">
import {
  computed,
  onActivated,
  onMounted,
  ref,
} from "vue";

import { ApiError } from "./api";

import {
  loadGoalOverviews,
  type GoalOverview,
} from "./overview-data";

const props = defineProps<{
  session: string;
}>();

const emit = defineEmits<{
  (event: "open-goal", goal: string): void;
}>();

type Filter = "active" | "all" | "retired";

const goals = ref<GoalOverview[]>([]);
const loading = ref(false);
const loaded = ref(false);
const error = ref("");
const filter = ref<Filter>("active");
const search = ref("");

let requestId = 0;

async function refresh() {
  const id = ++requestId;
  loading.value = true;
  error.value = "";

  try {
    const response = await loadGoalOverviews(
      props.session,
    );

    if (id === requestId) {
      goals.value = response;
      loaded.value = true;
    }
  } catch (cause) {
    if (id === requestId) {
      error.value =
        cause instanceof ApiError &&
        cause.code === "UNAUTHORIZED"
          ? "Your session expired. Please sign in again."
          : "Could not load commitments. Please retry.";
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

const activeCount = computed(
  () => items.value.filter((item) => item.active).length,
);

const retiredCount = computed(
  () => items.value.filter((item) => !item.active).length,
);

const totalClaims = computed(() =>
  items.value.reduce(
    (sum, item) => sum + item.completions.length,
    0,
  ),
);

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();

  return items.value.filter((item) => {
    const matchesStatus =
      filter.value === "all" ||
      (filter.value === "active"
        ? item.active
        : !item.active);

    const matchesSearch =
      !query ||
      item.description.toLowerCase().includes(query) ||
      item.outcome.toLowerCase().includes(query) ||
      (item.schedule ?? "").toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });
});

onMounted(refresh);
onActivated(refresh);
</script>

<template>
  <section
    class="commitments-page"
    aria-labelledby="commitments-heading"
  >
    <header class="page-header">
      <div>
        <p class="eyebrow">
          SHOW UP FOR YOURSELF
        </p>

        <h1 id="commitments-heading">
          My commitments
          <span aria-hidden="true">✦</span>
        </h1>

        <p class="page-subtitle">
          Big changes happen through small, consistent actions.
          Here's everything you've committed to.
        </p>
      </div>

      <button
        type="button"
        class="refresh-button"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? "Refreshing..." : "↻ Refresh" }}
      </button>
    </header>

    <div class="summary-grid">
      <article class="summary-card">
        <div class="summary-icon">✓</div>
        <strong>{{ activeCount }}</strong>
        <span>Active commitments</span>
      </article>

      <article class="summary-card">
        <div class="summary-icon">✦</div>
        <strong>{{ totalClaims }}</strong>
        <span>Completion claims</span>
      </article>

      <article class="summary-card">
        <div class="summary-icon">◷</div>
        <strong>{{ retiredCount }}</strong>
        <span>Retired commitments</span>
      </article>
    </div>

    <div class="section-header">
      <div>
        <p class="eyebrow">TAKE ACTION</p>
        <h2>Your action plan</h2>
      </div>

      <span class="results-count">
        {{ visible.length }}
        {{ visible.length === 1 ? "commitment" : "commitments" }}
      </span>
    </div>

    <div class="controls">
      <div
        class="filter-tabs"
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

          <span>
            {{
              option === "active"
                ? activeCount
                : option === "all"
                  ? items.length
                  : retiredCount
            }}
          </span>
        </button>
      </div>

      <label class="search-box">
        <span aria-hidden="true">⌕</span>
        <span class="sr-only">Search commitments</span>

        <input
          v-model="search"
          type="search"
          placeholder="Search commitments..."
        />
      </label>
    </div>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>

    <p
      v-if="loading && !loaded"
      class="empty-message"
      role="status"
    >
      Loading your commitments...
    </p>

    <div
      v-else-if="!visible.length && !error"
      class="empty-state"
    >
      <div class="empty-icon" aria-hidden="true">
        ✧
      </div>

      <h3>
        {{
          search
            ? "No matching commitments"
            : filter === "active"
              ? "A fresh start!"
              : "Nothing here yet"
        }}
      </h3>

      <p>
        {{
          search
            ? "Try another search or clear your filters."
            : "Commitments appear here when you create them inside a goal."
        }}
      </p>

      <button
        v-if="search || filter !== 'active'"
        class="clear-filters"
        type="button"
        @click="search = ''; filter = 'active'"
      >
        Clear filters
      </button>
    </div>

    <ul v-else class="commitment-list">
      <li
        v-for="item in visible"
        :key="item.commitment"
        class="commitment-card"
      >
        <div class="card-icon" aria-hidden="true">
          {{ item.active ? "✓" : "◷" }}
        </div>

        <div class="card-content">
          <div class="card-badges">
            <span
              class="status-badge"
              :class="item.active ? 'active' : 'retired'"
            >
              {{ item.active ? "Active" : "Retired" }}
            </span>

            <span class="type-badge">
              {{ item.recurring ? "↻ Recurring" : "◎ One-time" }}
            </span>
          </div>

          <h3>{{ item.description }}</h3>

          <p class="goal-reference">
            <span>GOAL</span>
            {{ item.outcome }}
          </p>

          <div class="card-meta">
            <span>
              <span aria-hidden="true">◷</span>
              {{ item.schedule || "No schedule specified" }}
            </span>

            <span>
              <span aria-hidden="true">✦</span>
              {{ item.completions.length }}
              completion
              {{ item.completions.length === 1 ? "claim" : "claims" }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="open-button"
          :aria-label="`Open goal for ${item.description}`"
          @click="emit('open-goal', item.goalId)"
        >
          <span class="open-label">Open goal</span>
          <span aria-hidden="true">→</span>
        </button>
      </li>
    </ul>

    <p class="footnote">
      Completion claims show recorded execution.
      Peer verification and observed outcomes are tracked separately.
      Open a goal to submit proof or update your plan.
    </p>
  </section>
</template>

<style scoped>
.commitments-page {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.page-header,
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.eyebrow {
  margin: 0 0 9px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.page-header h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 39px);
  letter-spacing: -0.045em;
}

.page-header h1 span {
  color: #af93e7;
  font-size: 25px;
}

.page-subtitle {
  max-width: 590px;
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}

.refresh-button,
.clear-filters {
  flex-shrink: 0;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
  padding: 23px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: white;
}

.summary-icon {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  margin-bottom: 5px;
  border-radius: 11px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 21px;
}

.summary-card strong {
  font-size: 32px;
  line-height: 1;
  color: var(--accent);
}

.summary-card span {
  color: var(--muted);
  font-size: 12px;
}

.section-header h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.035em;
}

.results-count {
  color: var(--muted);
  font-size: 12px;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: white;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.filter-tabs button[aria-pressed="true"] {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.filter-tabs button span {
  display: grid;
  place-items: center;
  min-width: 23px;
  height: 23px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f0ecf7;
  color: #6a568b;
  font-size: 11px;
}

.filter-tabs button[aria-pressed="true"] span {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: white;
}

.search-box > span:first-child {
  color: var(--accent);
  font-size: 23px;
}

.search-box input {
  width: 200px;
  margin: 0;
  padding: 11px 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
}

.commitment-list {
  display: grid;
  gap: 13px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.commitment-card {
  display: flex;
  align-items: center;
  gap: 17px;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: white;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.commitment-card:hover {
  transform: translateY(-2px);
  border-color: #baa7e7;
  box-shadow: 0 10px 25px rgba(75, 50, 135, 0.06);
}

.card-icon {
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  height: 48px;
  align-self: flex-start;
  border-radius: 13px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 23px;
}

.card-content {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.status-badge,
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
}

.status-badge.active {
  background: #eee6ff;
  color: #6743b8;
}

.status-badge.retired {
  background: #efedf3;
  color: #726b82;
}

.type-badge {
  background: #f7f5fc;
  color: #726b82;
}

.card-content h3 {
  margin: 13px 0 10px;
  font-size: 17px;
  line-height: 1.45;
  letter-spacing: -0.015em;
}

.goal-reference {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.goal-reference > span {
  margin-right: 7px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px 20px;
  margin-top: 16px;
  color: var(--muted);
  font-size: 12px;
}

.card-meta > span {
  display: inline-flex;
  gap: 7px;
  align-items: center;
}

.open-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 0;
  border-radius: 10px;
  background: #f0eafd;
  color: #6743b8;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.open-button:hover {
  background: #e5d9fa;
}

.empty-state,
.empty-message {
  padding: 45px 20px;
  border: 1px dashed #cfbee9;
  border-radius: 18px;
  background: white;
  text-align: center;
  color: var(--muted);
}

.empty-icon {
  color: var(--accent);
  font-size: 40px;
}

.empty-state h3 {
  margin: 12px 0;
  color: var(--text);
  font-size: 20px;
}

.empty-state p {
  max-width: 400px;
  margin: 0 auto 20px;
  font-size: 13px;
  line-height: 1.7;
}

.footnote {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-card {
    padding: 16px;
  }

  .commitment-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .open-button {
    margin-left: auto;
  }
}

@media (max-width: 540px) {
  .summary-grid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .summary-card {
    flex-direction: row;
    align-items: center;
    gap: 13px;
  }

  .summary-icon {
    margin: 0;
  }

  .summary-card strong {
    font-size: 25px;
  }

  .controls {
    align-items: stretch;
    flex-direction: column;
  }

  .search-box input {
    flex: 1;
    width: 100%;
  }

  .commitment-card {
    padding: 17px;
    gap: 12px;
  }

  .card-icon {
    flex-basis: 38px;
    height: 38px;
  }

  .open-button {
    width: 100%;
    justify-content: space-between;
  }
}

@media (prefers-reduced-motion: reduce) {
  .commitment-card {
    transition: none;
  }
}
</style>
