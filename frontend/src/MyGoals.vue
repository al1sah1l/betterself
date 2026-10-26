
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
import PriorityGoalPicker from "./PriorityGoalPicker.vue";

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
const priorityGoal = ref<string | null>(null);

const loading = ref(false);
const error = ref("");
const priorityError = ref("");

const selectedGoal = ref("");
const showCreateGoal = ref(false);
const search = ref("");

const savingPriority = ref("");
const priorityPickerKey = ref(0);

const filteredGoals = computed(() => {
  const query = search.value
    .trim()
    .toLowerCase();

  const matching = goals.value.filter(
    (goal) =>
      goal.outcome
        .toLowerCase()
        .includes(query) ||
      (goal.timeline ?? "")
        .toLowerCase()
        .includes(query),
  );

  return matching.sort((a, b) => {
    if (a.goal === priorityGoal.value) return -1;
    if (b.goal === priorityGoal.value) return 1;
    return 0;
  });
});

async function loadGoals() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

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

    goals.value = goalResponse.goals ?? [];
    priorityGoal.value = priorityResponse.goal;
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

function priorityChanged(
  goal: string | null,
) {
  priorityGoal.value = goal;
}

async function makePriority(goal: string) {
  if (savingPriority.value) return;

  savingPriority.value = goal;
  priorityError.value = "";

  try {
    const result = await api<{
      goal: string | null;
    }>("/goals/set-priority", {
      session: props.session,
      goal,
    });

    priorityGoal.value = result.goal;

    // Reload the separate picker so it reflects
    // a priority changed directly from a card.
    priorityPickerKey.value += 1;
  } catch (cause) {
    priorityError.value =
      cause instanceof ApiError &&
      cause.code === "UNAUTHORIZED"
        ? "Your session expired. Please sign in again."
        : "Could not update your priority. Please try again.";
  } finally {
    savingPriority.value = "";
  }
}

async function goalCreated() {
  showCreateGoal.value = false;
  search.value = "";
  await loadGoals();
  priorityPickerKey.value += 1;
}

async function goalDeleted() {
  selectedGoal.value = "";
  search.value = "";
  showCreateGoal.value = false;

  await loadGoals();
  priorityPickerKey.value += 1;
}

function openGoal(goal: string) {
  selectedGoal.value = goal;
}

function backToGoals() {
  selectedGoal.value = "";
  void loadGoals();
  priorityPickerKey.value += 1;
}

watch(
  () => props.requestedGoal,
  (goal) => {
    selectedGoal.value = goal ?? "";
  },
  { immediate: true },
);

onMounted(loadGoals);

onActivated(() => {
  if (!selectedGoal.value) {
    void loadGoals();
    priorityPickerKey.value += 1;
  }
});
</script>

<template>
  <section
    class="goals-page"
    aria-label="Goals"
  >
    <template v-if="selectedGoal">
      <div class="detail-toolbar">
        <button
          type="button"
          class="back-button"
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
            <span
              class="heading-sparkle"
              aria-hidden="true"
            >
              ✦
            </span>
          </h1>

          <p class="intro">
            A home for the things you want to
            achieve. Every goal starts with
            a single step.
          </p>
        </div>

        <button
          class="create-button"
          type="button"
          :aria-expanded="showCreateGoal"
          aria-controls="create-goal-panel"
          @click="
            showCreateGoal = !showCreateGoal
          "
        >
          <span aria-hidden="true">
            {{ showCreateGoal ? "×" : "+" }}
          </span>

          {{
            showCreateGoal
              ? "Close form"
              : "New goal"
          }}
        </button>
      </header>

      <PriorityGoalPicker
        v-if="goals.length"
        :key="priorityPickerKey"
        :session="session"
        class="goals-priority-picker"
        @changed="priorityChanged"
      />

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
            @click="
              showCreateGoal = false
            "
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
          <span
            class="count-icon"
            aria-hidden="true"
          >
            ◎
          </span>

          <div>
            <strong>Your journey</strong>

            <p>
              {{ goals.length }}
              {{
                goals.length === 1
                  ? "goal"
                  : "goals"
              }}
              in your workspace
            </p>
          </div>
        </div>

        <div class="toolbar-actions">
          <label class="search-box">
            <span
              class="search-icon"
              aria-hidden="true"
            >
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
            {{
              loading
                ? "Loading..."
                : "↻ Refresh"
            }}
          </button>
        </div>
      </div>

      <p
        v-if="error"
        class="error-message"
        role="alert"
      >
        {{ error }}
      </p>

      <p
        v-if="priorityError"
        class="error-message"
        role="alert"
      >
        {{ priorityError }}
      </p>

      <div
        v-if="loading && !goals.length"
        class="loading-message"
        role="status"
      >
        Loading your goals...
      </div>

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
          Create a goal and BetterSelf will
          help you turn it into a strategy,
          commitments, and measurable actions.
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
        v-else-if="
          filteredGoals.length === 0 &&
          !error
        "
        class="empty-search"
      >
        <h2>No matching goals</h2>

        <p>
          Try another keyword or clear
          your search.
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
          :class="{
            'goal-card--priority':
              goal.goal === priorityGoal,
          }"
        >
          <div class="goal-card-top">
            <span
              class="goal-number"
              :class="{
                'goal-number--priority':
                  goal.goal === priorityGoal,
              }"
            >
              {{
                goal.goal === priorityGoal
                  ? "★ CURRENT PRIORITY"
                  : `GOAL ${String(index + 1).padStart(2, "0")}`
              }}
            </span>

            <span
              class="goal-card-icon"
              aria-hidden="true"
            >
              {{
                goal.goal === priorityGoal
                  ? "★"
                  : "✧"
              }}
            </span>
          </div>

          <div class="goal-card-body">
            <h2>{{ goal.outcome }}</h2>

            <p
              v-if="goal.timeline"
              class="goal-timeline"
            >
              <span aria-hidden="true">
                ◷
              </span>
              {{ goal.timeline }}
            </p>

            <p
              v-else
              class="goal-timeline"
            >
              Your journey, at your pace.
            </p>
          </div>

          <button
            v-if="
              goal.goal !== priorityGoal
            "
            type="button"
            class="set-priority-button"
            :disabled="
              Boolean(savingPriority)
            "
            @click="
              makePriority(goal.goal)
            "
          >
            {{
              savingPriority === goal.goal
                ? "Saving..."
                : "☆ Make priority"
            }}
          </button>

          <div
            v-else
            class="priority-confirmation"
          >
            ★ Your main focus right now
          </div>

          <button
            type="button"
            class="goal-open"
            :aria-label="
              `Open goal: ${goal.outcome}`
            "
            @click="
              openGoal(goal.goal)
            "
          >
            Explore goal

            <span aria-hidden="true">
              ↗
            </span>
          </button>
        </article>

        <button
          type="button"
          class="add-goal-card"
          @click="
            showCreateGoal = true
          "
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
  margin-bottom: 26px;
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
  padding: 13px 19px;
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: white;
  font-size: 14px;
  font-weight: 750;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(
    115,
    84,
    197,
    0.13
  );
}

.create-button:hover {
  background: var(--accent-hover);
}

.create-button span {
  font-size: 20px;
  line-height: 1;
}

.goals-priority-picker {
  margin-bottom: 28px;
}

.create-goal-panel {
  margin-bottom: 30px;
  padding: 26px;
  border: 1px solid #dcd2ef;
  border-radius: 20px;
  background: white;
  box-shadow: 0 12px 30px rgba(
    75,
    50,
    135,
    0.06
  );
}

.form-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  border-radius: 13px;
  background: #eee7fb;
  color: var(--accent);
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
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
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
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.refresh-button:disabled {
  opacity: 0.6;
}

.goals-grid {
  display: grid;
  grid-template-columns: repeat(
    2,
    minmax(0, 1fr)
  );
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
  box-shadow: 0 12px 30px rgba(
    75,
    50,
    135,
    0.08
  );
}

.goal-card--priority {
  border: 2px solid #7951cb;
  background: linear-gradient(
    145deg,
    #fff 55%,
    #f7f1ff 100%
  );
  box-shadow: 0 10px 28px rgba(
    105,
    65,
    180,
    0.11
  );
}

.goal-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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

.goal-number--priority {
  background: #7354c5;
  color: white;
}

.goal-card-icon {
  color: #b49be6;
  font-size: 27px;
}

.goal-card--priority .goal-card-icon {
  color: #7354c5;
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

.set-priority-button {
  align-self: flex-start;
  min-height: 38px;
  padding: 9px 12px;
  margin-bottom: 12px;
  border: 1px solid #d6c5f0;
  border-radius: 9px;
  background: #f8f4ff;
  color: #7150bf;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.set-priority-button:hover:not(:disabled) {
  background: #eee5ff;
}

.set-priority-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.priority-confirmation {
  margin-bottom: 12px;
  color: #6743b8;
  font-size: 12px;
  font-weight: 750;
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

.goal-card--priority .goal-open {
  background: #7354c5;
  color: white;
}

.goal-card--priority .goal-open:hover {
  background: #6041b1;
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
  padding: 10px 15px;
  border: 1px solid var(--border);
  border-radius: 10px;
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

.error-message {
  padding: 12px 15px;
  border: 1px solid #efc3ca;
  border-radius: 10px;
  background: #fff3f5;
  color: #a32939;
  font-size: 12px;
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

  .goal-card {
    padding: 19px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .goal-card {
    transition: none;
  }
}
</style>
