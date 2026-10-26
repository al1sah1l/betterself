
<script setup lang="ts">
import {
  computed,
  onActivated,
  onMounted,
  ref,
  watch,
} from "vue";

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
const search = ref("");

const filteredGoals = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) return goals.value;

  return goals.value.filter(
    (goal) =>
      goal.outcome.toLowerCase().includes(query) ||
      (goal.timeline ?? "").toLowerCase().includes(query),
  );
});

async function loadGoals() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ goals: Goal[] }>(
      "/dashboard/goals",
      { session: props.session },
    );

    goals.value = result.goals ?? [];
  } catch (cause) {
    error.value =
      cause instanceof ApiError &&
      cause.code === "UNAUTHORIZED"
        ? "Your session has expired. Please sign out and sign in again."
        : "Could not load your goals. Please try again.";
  } finally {
    loading.value = false;
  }
}

async function goalCreated() {
  showCreateGoal.value = false;
  search.value = "";
  await loadGoals();
}

async function goalDeleted() {
  selectedGoal.value = "";
  search.value = "";
  showCreateGoal.value = false;
  await loadGoals();
}

function openGoal(goal: string) {
  selectedGoal.value = goal;
}

function backToGoals() {
  selectedGoal.value = "";
  void loadGoals();
}

watch(
  () => props.requestedGoal,
  (goal) => {
    if (goal) {
      selectedGoal.value = goal;
    } else {
      selectedGoal.value = "";
    }
  },
  { immediate: true },
);

onMounted(loadGoals);

onActivated(() => {
  if (!selectedGoal.value) {
    void loadGoals();
  }
});
</script>

<template>
  <section class="goals-page" aria-label="Goals">
    <template v-if="selectedGoal">
      <div class="detail-toolbar">
        <button
          class="back-button"
          type="button"
          @click="backToGoals"
        >
          <span aria-hidden="true">←</span>
          All goals
        </button>

        <span class="detail-context">
          YOUR GOAL WORKSPACE
        </span>
      </div>

      <GoalDetail
        :key="selectedGoal"
        :session="props.session"
        :goal="selectedGoal"
        @deleted="goalDeleted"
      />
    </template>

    <template v-else>
      <header class="goals-header">
        <div>
          <p class="eyebrow">
            DREAM BIG, START SMALL
          </p>

          <h1>
            My goals
            <span class="heading-sparkle">✦</span>
          </h1>

          <p class="intro">
            A home for the things you want to achieve.
            Every goal starts with a single step.
          </p>
        </div>

        <button
          class="create-button"
          type="button"
          :aria-expanded="showCreateGoal"
          aria-controls="create-goal-panel"
          @click="showCreateGoal = !showCreateGoal"
        >
          <span aria-hidden="true">
            {{ showCreateGoal ? "×" : "+" }}
          </span>

          {{ showCreateGoal ? "Close form" : "New goal" }}
        </button>
      </header>

      <div
        v-if="showCreateGoal"
        id="create-goal-panel"
        class="create-goal-panel"
      >
        <div class="form-heading">
          <div>
            <p class="eyebrow">
              YOUR NEXT CHAPTER
            </p>

            <h2>Create a goal</h2>
          </div>

          <button
            type="button"
            class="close-form"
            aria-label="Close create goal form"
            @click="showCreateGoal = false"
          >
            ×
          </button>
        </div>

        <CreateGoal
          :session="props.session"
          @created="goalCreated"
        />
      </div>

      <div class="goals-toolbar">
        <div class="goals-count">
          <span class="count-icon" aria-hidden="true">
            ◎
          </span>

          <div>
            <strong>Your journey</strong>

            <p>
              {{ goals.length }}
              {{ goals.length === 1 ? "goal" : "goals" }}
              in your workspace
            </p>
          </div>
        </div>

        <div class="toolbar-actions">
          <label class="search-box">
            <span class="search-icon" aria-hidden="true">
              ⌕
            </span>

            <span class="sr-only">
              Search goals
            </span>

            <input
              v-model="search"
              type="search"
              placeholder="Find a goal..."
            />
          </label>

          <button
            type="button"
            class="refresh-button"
            :disabled="loading"
            @click="loadGoals"
          >
            {{ loading ? "Loading..." : "↻ Refresh" }}
          </button>
        </div>
      </div>

      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>

      <p
        v-if="loading && !goals.length"
        class="loading-message"
        role="status"
      >
        Loading your goals...
      </p>

      <div
        v-else-if="!goals.length && !error"
        class="empty-state"
      >
        <div
          class="empty-illustration"
          aria-hidden="true"
        >
          ✦
        </div>

        <h2>
          Your next chapter starts here.
        </h2>

        <p>
          Create a goal and BetterSelf will help you
          turn it into a strategy, commitments,
          and measurable actions.
        </p>

        <button
          type="button"
          class="create-button"
          @click="showCreateGoal = true"
        >
          + Create my first goal
        </button>
      </div>

      <div
        v-else-if="filteredGoals.length === 0 && !error"
        class="empty-search"
      >
        <h2>No matching goals</h2>

        <p>
          Try another keyword or clear your search.
        </p>

        <button
          type="button"
          class="refresh-button"
          @click="search = ''"
        >
          Clear search
        </button>
      </div>

      <div
        v-else
        class="goals-grid"
      >
        <article
          v-for="(goal, index) in filteredGoals"
          :key="goal.goal"
          class="goal-card"
        >
          <div class="goal-card-top">
            <span class="goal-number">
              GOAL {{ String(index + 1).padStart(2, "0") }}
            </span>

            <span
              class="goal-card-icon"
              aria-hidden="true"
            >
              ✧
            </span>
          </div>

          <div class="goal-card-body">
            <h2>{{ goal.outcome }}</h2>

            <p
              v-if="goal.timeline"
              class="goal-timeline"
            >
              <span aria-hidden="true">◷</span>
              {{ goal.timeline }}
            </p>

            <p v-else class="goal-timeline">
              Your journey, at your pace.
            </p>
          </div>

          <button
            class="goal-open"
            type="button"
            :aria-label="`Open goal: ${goal.outcome}`"
            @click="openGoal(goal.goal)"
          >
            Explore goal

            <span aria-hidden="true">↗</span>
          </button>
        </article>

        <button
          type="button"
          class="add-goal-card"
          @click="showCreateGoal = true"
        >
          <span
            class="add-goal-icon"
            aria-hidden="true"
          >
            +
          </span>

          <strong>
            Dreaming of something new?
          </strong>

          <span>
            Add another goal to your journey.
          </span>
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.goals-page {
  min-width: 0;
}

.goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
}

.eyebrow {
  margin: 0 0 9px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.goals-header h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 40px);
  letter-spacing: -0.05em;
  line-height: 1.2;
}

.heading-sparkle {
  color: #ac8de4;
  font-size: 27px;
}

.intro {
  max-width: 530px;
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}

.create-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 12px;
  padding: 13px 19px;
  background: var(--accent);
  color: white;
  font-size: 14px;
  font-weight: 750;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(115, 84, 197, 0.13);
}

.create-button:hover {
  background: var(--accent-hover);
}

.create-button span {
  font-size: 20px;
  line-height: 1;
}

.create-goal-panel {
  margin-bottom: 30px;
  padding: 26px;
  border: 1px solid #dcd2ef;
  border-radius: 20px;
  background: white;
  box-shadow: 0 12px 30px rgba(75, 50, 135, 0.06);
}

.form-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 22px;
}

.form-heading h2 {
  margin: 0;
  font-size: 22px;
}

.close-form {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 29px;
  cursor: pointer;
}

.goals-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
  margin-bottom: 22px;
}

.goals-count {
  display: flex;
  align-items: center;
  gap: 12px;
}

.count-icon {
  display: grid;
  place-items: center;
  width: 45px;
  height: 45px;
  background: #eee7fb;
  color: var(--accent);
  border-radius: 13px;
  font-size: 27px;
}

.goals-count strong {
  font-size: 16px;
}

.goals-count p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.search-icon {
  color: var(--accent);
  font-size: 22px;
}

.search-box input {
  width: 180px;
  margin: 0;
  padding: 11px 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
}

.refresh-button {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 11px 14px;
  background: white;
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.goals-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.goal-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 230px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 19px;
  background: white;
  overflow-wrap: anywhere;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;
}

.goal-card:hover {
  transform: translateY(-3px);
  border-color: #bca8e9;
  box-shadow: 0 12px 30px rgba(75, 50, 135, 0.08);
}

.goal-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-number {
  padding: 6px 10px;
  border-radius: 8px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.goal-card-icon {
  color: #b49be6;
  font-size: 27px;
}

.goal-card-body {
  flex: 1;
  padding: 20px 0 22px;
}

.goal-card h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.4;
  letter-spacing: -0.025em;
}

.goal-timeline {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.goal-open {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 13px 15px;
  border: 0;
  border-radius: 11px;
  background: #f0eafd;
  color: #6743b8;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.goal-open:hover {
  background: #e6dafa;
}

.add-goal-card {
  min-height: 230px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  padding: 25px;
  border: 2px dashed #cfbfea;
  border-radius: 19px;
  background: #fbf9ff;
  color: var(--accent);
  text-align: center;
  cursor: pointer;
}

.add-goal-card:hover {
  background: #f3edff;
}

.add-goal-icon {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #e9defb;
  font-size: 29px;
}

.add-goal-card strong {
  font-size: 15px;
}

.add-goal-card > span:last-child {
  color: var(--muted);
  font-size: 12px;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 15px;
  background: white;
  color: var(--accent);
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.detail-context {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.loading-message,
.empty-search,
.empty-state {
  padding: 36px 24px;
  border: 1px dashed #d2c5e8;
  border-radius: 19px;
  background: white;
  text-align: center;
}

.empty-illustration {
  margin-bottom: 12px;
  color: var(--accent);
  font-size: 42px;
}

.empty-state h2,
.empty-search h2 {
  font-size: 21px;
}

.empty-state p,
.empty-search p {
  max-width: 430px;
  margin: 12px auto 20px;
  color: var(--muted);
  font-size: 13px;
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

@media (max-width: 700px) {
  .goals-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .goals-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    width: 100%;
  }

  .search-box {
    flex: 1;
  }

  .search-box input {
    width: 100%;
  }

  .create-goal-panel {
    padding: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .goal-card {
    transition: none;
  }
}
</style>
