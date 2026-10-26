
<script setup lang="ts">
import {
  computed,
  onActivated,
  onMounted,
  ref,
} from "vue";

import { api, ApiError } from "./api";
import PriorityGoalPicker from "./PriorityGoalPicker.vue";

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
  (
    event: "open-goal",
    goal: string,
  ): void;

  (
    event: "navigate",
    page: "goals" | "commitments" | "groups",
  ): void;
}>();

const goals = ref<GoalOverview[]>([]);
const priorityGoal = ref<string | null>(null);

const loading = ref(false);
const loaded = ref(false);
const error = ref("");

let requestId = 0;

async function refresh() {
  const id = ++requestId;

  loading.value = true;
  error.value = "";

  try {
    const [response, priorityResponse] =
      await Promise.all([
        loadGoalOverviews(props.session),
        api<{ goal: string | null }>(
          "/goals/priority",
          { session: props.session },
        ),
      ]);

    if (id !== requestId) return;

    goals.value = response;
    priorityGoal.value = priorityResponse.goal;
    loaded.value = true;
  } catch (cause) {
    if (id !== requestId) return;

    error.value =
      cause instanceof ApiError &&
      cause.code === "UNAUTHORIZED"
        ? "Your session expired. Please sign in again."
        : "Could not load your dashboard. Please try again.";
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

function priorityChanged(goal: string | null) {
  priorityGoal.value = goal;
}

const orderedGoals = computed(() =>
  [...goals.value].sort((a, b) => {
    if (a.goal === priorityGoal.value) return -1;
    if (b.goal === priorityGoal.value) return 1;
    return 0;
  }),
);

const allCommitments = computed(() =>
  goals.value.flatMap(
    (goal) => goal.commitments,
  ),
);

const activeCommitments = computed(() =>
  allCommitments.value.filter(
    (item) => item.active,
  ).length,
);

const completionClaims = computed(() =>
  completedCount(allCommitments.value),
);

const goalsWithActivity = computed(() =>
  goals.value.filter(
    (goal) =>
      completedCount(goal.commitments) > 0,
  ).length,
);

function oneTimeStats(goal: GoalOverview) {
  const oneTime = goal.commitments.filter(
    (item) => !item.recurring,
  );

  const completed = oneTime.filter(
    (item) => item.completions.length > 0,
  ).length;

  return {
    completed,
    total: oneTime.length,
    percent: oneTime.length
      ? Math.round(
          (completed / oneTime.length) * 100,
        )
      : 0,
  };
}

function recurringCount(goal: GoalOverview) {
  return goal.commitments
    .filter((item) => item.recurring)
    .reduce(
      (total, item) =>
        total + item.completions.length,
      0,
    );
}

const currentCommitments = computed(() =>
  orderedGoals.value
    .flatMap((goal) =>
      goal.commitments
        .filter((item) => item.active)
        .map((item) => ({
          ...item,
          goalId: goal.goal,
          goalOutcome: goal.outcome,
        })),
    )
    .slice(0, 5),
);

onMounted(refresh);
onActivated(refresh);
</script>

<template>
  <section
    class="dashboard"
    aria-labelledby="dashboard-title"
  >
    <header class="welcome-banner">
      <div class="welcome-content">
        <p class="eyebrow">
          YOUR PERSONAL GROWTH SPACE
        </p>

        <h1 id="dashboard-title">
          Hey, {{ account }}!
          <span aria-hidden="true">✦</span>
        </h1>

        <p class="welcome-description">
          Big goals. Small steps. Real progress.
          Make today count.
        </p>

        <button
          type="button"
          class="welcome-button"
          @click="emit('navigate', 'goals')"
        >
          Explore my goals
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <div
        class="banner-decoration"
        aria-hidden="true"
      >
        <span>✦</span>
      </div>
    </header>

    <div class="dashboard-toolbar">
      <div>
        <h2>Overview</h2>
        <p class="muted">
          A snapshot of your journey so far.
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
    </div>

    <div
      v-if="error"
      class="error-panel"
      role="alert"
    >
      <p>{{ error }}</p>

      <button
        type="button"
        @click="refresh"
      >
        Try again
      </button>
    </div>

    <p
      v-if="loading && !loaded"
      class="loading-message"
      role="status"
    >
      Loading your dashboard...
    </p>

    <template v-if="loaded">
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-icon">◎</span>
          <strong class="stat-number">
            {{ goals.length }}
          </strong>
          <span class="stat-label">
            My goals
          </span>
          <span class="stat-footnote">
            Your personal objectives
          </span>
        </article>

        <article class="stat-card">
          <span class="stat-icon">✓</span>
          <strong class="stat-number">
            {{ activeCommitments }}
          </strong>
          <span class="stat-label">
            Active commitments
          </span>
          <span class="stat-footnote">
            Actions you're working on
          </span>
        </article>

        <article class="stat-card">
          <span class="stat-icon">✦</span>
          <strong class="stat-number">
            {{ completionClaims }}
          </strong>
          <span class="stat-label">
            Completion claims
          </span>
          <span class="stat-footnote">
            Recorded execution
          </span>
        </article>

        <article class="stat-card">
          <span class="stat-icon">◈</span>
          <strong class="stat-number">
            {{ goalsWithActivity }}
          </strong>
          <span class="stat-label">
            Goals with activity
          </span>
          <span class="stat-footnote">
            Goals with completed actions
          </span>
        </article>
      </div>

      <PriorityGoalPicker
        v-if="goals.length"
        :session="session"
        class="priority-panel"
        @changed="priorityChanged"
      />

      <section
        class="goals-section"
        aria-labelledby="my-goals-title"
      >
        <div class="section-heading">
          <div>
            <p class="section-eyebrow">
              WHERE YOU'RE HEADED
            </p>
            <h2 id="my-goals-title">
              Your goals
            </h2>
          </div>

          <button
            type="button"
            class="section-link"
            @click="emit('navigate', 'goals')"
          >
            View all goals →
          </button>
        </div>

        <div
          v-if="!goals.length"
          class="empty-state"
        >
          <span class="empty-icon">◎</span>
          <h3>
            Every great journey starts somewhere.
          </h3>
          <p>
            Create your first goal, build a strategy,
            and turn it into achievable commitments.
          </p>

          <button
            type="button"
            class="empty-action"
            @click="emit('navigate', 'goals')"
          >
            + Create my first goal
          </button>
        </div>

        <div
          v-else
          class="goal-grid"
        >
          <article
            v-for="goal in orderedGoals"
            :key="goal.goal"
            class="goal-card"
            :class="{
              'goal-card--priority':
                goal.goal === priorityGoal,
            }"
          >
            <div class="goal-card-top">
              <span
                class="goal-label"
                :class="{
                  'goal-label--priority':
                    goal.goal === priorityGoal,
                }"
              >
                {{
                  goal.goal === priorityGoal
                    ? "★ CURRENT PRIORITY"
                    : "MY GOAL"
                }}
              </span>

              <span
                class="goal-sparkle"
                aria-hidden="true"
              >
                {{
                  goal.goal === priorityGoal
                    ? "★"
                    : "✧"
                }}
              </span>
            </div>

            <h3>{{ goal.outcome }}</h3>

            <p
              v-if="goal.timeline"
              class="goal-timeline"
            >
              <span aria-hidden="true">◷</span>
              {{ goal.timeline }}
            </p>

            <div class="goal-details">
              <div class="goal-detail-row">
                <span>Active commitments</span>
                <strong>
                  {{
                    goal.commitments.filter(
                      (item) => item.active,
                    ).length
                  }}
                </strong>
              </div>

              <div class="goal-detail-row">
                <span>
                  Recurring completion claims
                </span>
                <strong>
                  {{ recurringCount(goal) }}
                </strong>
              </div>
            </div>

            <div class="goal-progress">
              <div class="goal-progress-heading">
                <span>One-time commitments</span>
                <strong>
                  {{ oneTimeStats(goal).completed }}
                  /
                  {{ oneTimeStats(goal).total }}
                </strong>
              </div>

              <div
                class="progress-track"
                role="progressbar"
                :aria-label="
                  `One-time commitments completed for ${goal.outcome}`
                "
                :aria-valuenow="
                  oneTimeStats(goal).completed
                "
                :aria-valuemin="0"
                :aria-valuemax="
                  oneTimeStats(goal).total || 1
                "
              >
                <div
                  class="progress-fill"
                  :style="{
                    width: `${oneTimeStats(goal).percent}%`,
                  }"
                />
              </div>

              <p class="progress-note">
                {{
                  oneTimeStats(goal).total
                    ? `${oneTimeStats(goal).percent}% with completion claims`
                    : "No one-time commitments yet"
                }}
              </p>
            </div>

            <button
              type="button"
              class="open-goal"
              :aria-label="
                `Open goal: ${goal.outcome}`
              "
              @click="
                emit('open-goal', goal.goal)
              "
            >
              Open goal
              <span aria-hidden="true">→</span>
            </button>
          </article>

          <button
            type="button"
            class="new-goal-card"
            @click="emit('navigate', 'goals')"
          >
            <span class="new-goal-plus">
              +
            </span>
            <strong>Add a new goal</strong>
            <span>
              What's your next big thing?
            </span>
          </button>
        </div>
      </section>

      <section
        class="commitments-section"
        aria-labelledby="commitments-title"
      >
        <div class="section-heading">
          <div>
            <p class="section-eyebrow">
              SMALL STEPS, BIG CHANGES
            </p>
            <h2 id="commitments-title">
              Your commitments
            </h2>
          </div>

          <button
            type="button"
            class="section-link"
            @click="
              emit('navigate', 'commitments')
            "
          >
            View all →
          </button>
        </div>

        <div class="commitments-panel">
          <p
            v-if="!currentCommitments.length"
            class="muted"
          >
            No active commitments yet.
            Add one to a goal to start making progress.
          </p>

          <div
            v-for="item in currentCommitments"
            :key="item.commitment"
            class="commitment-row"
          >
            <div
              class="commitment-marker"
              aria-hidden="true"
            >
              ✓
            </div>

            <div class="commitment-info">
              <strong>
                {{ item.description }}
              </strong>

              <p>
                {{ item.goalOutcome }}
                <span
                  v-if="
                    item.goalId === priorityGoal
                  "
                  class="commitment-priority"
                >
                  ★ Priority
                </span>
              </p>

              <span class="commitment-schedule">
                {{
                  item.recurring
                    ? "Recurring"
                    : "One-time"
                }}
                ·
                {{ item.schedule }}
              </span>
            </div>

            <button
              type="button"
              class="commitment-open"
              :aria-label="
                `Open goal for ${item.description}`
              "
              @click="
                emit('open-goal', item.goalId)
              "
            >
              →
            </button>
          </div>
        </div>
      </section>

      <p class="dashboard-disclaimer">
        BetterSelf keeps execution, peer verification,
        and real-world outcomes separate.
        Completing commitments is not the same as
        achieving your final goal.
      </p>
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 30px;
  min-width: 0;
}

.welcome-banner {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 218px;
  overflow: hidden;
  padding: 32px;
  border-radius: 22px;
  background: linear-gradient(
    115deg,
    #6543bd 0%,
    #8160d5 55%,
    #b396ec 100%
  );
  color: white;
}

.welcome-content {
  position: relative;
  z-index: 1;
}

.eyebrow {
  margin: 0 0 12px;
  color: #eee3ff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.welcome-banner h1 {
  margin: 0;
  color: white;
  font-size: clamp(30px, 4vw, 43px);
  letter-spacing: -0.045em;
}

.welcome-banner h1 span {
  color: #f3dfff;
}

.welcome-description {
  max-width: 440px;
  margin: 13px 0 22px;
  color: #f7efff;
  font-size: 14px;
  line-height: 1.6;
}

.welcome-button {
  display: inline-flex;
  align-items: center;
  gap: 15px;
  padding: 12px 18px;
  border: 0;
  border-radius: 11px;
  background: white;
  color: #6844b8;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.banner-decoration {
  position: absolute;
  right: 9%;
  top: -45px;
  font-size: 230px;
  color: #fff;
  opacity: 0.14;
  pointer-events: none;
}

.dashboard-toolbar,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.dashboard-toolbar h2,
.section-heading h2 {
  margin: 0;
  color: var(--text);
  font-size: 26px;
  letter-spacing: -0.04em;
}

.muted,
.dashboard-toolbar p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.refresh-button {
  flex-shrink: 0;
  padding: 11px 15px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.refresh-button:disabled {
  opacity: 0.6;
}

.error-panel {
  padding: 16px;
  border: 1px solid #eab9c3;
  border-radius: 12px;
  background: #fff5f7;
  color: #a32939;
}

.error-panel button {
  padding: 9px 12px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: white;
  color: inherit;
  cursor: pointer;
}

.loading-message {
  color: var(--muted);
  font-size: 13px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(
    4,
    minmax(0, 1fr)
  );
  gap: 15px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  gap: 10px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: white;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  border-radius: 11px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 22px;
}

.stat-number {
  color: var(--accent);
  font-size: 33px;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  font-weight: 750;
  color: var(--text);
}

.stat-footnote {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.priority-panel {
  margin: 0;
}

.goals-section,
.commitments-section {
  display: grid;
  gap: 22px;
}

.section-eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.section-link {
  padding: 7px 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.goal-grid {
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
  padding: 25px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: white;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
}

.goal-card:hover {
  transform: translateY(-2px);
  border-color: #baa5e5;
  box-shadow: 0 10px 25px rgba(
    75,
    50,
    135,
    0.07
  );
}

.goal-card--priority {
  border: 2px solid #7951cb;
  background: linear-gradient(
    145deg,
    #fff 65%,
    #f6f0ff 100%
  );
  box-shadow: 0 10px 30px rgba(
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
  gap: 10px;
}

.goal-label {
  padding: 7px 11px;
  border-radius: 9px;
  background: #f0eafd;
  color: #7354c5;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.goal-label--priority {
  background: #7354c5;
  color: white;
}

.goal-sparkle {
  color: #b59be9;
  font-size: 25px;
}

.goal-card--priority .goal-sparkle {
  color: #7354c5;
}

.goal-card h3 {
  margin: 25px 0 12px;
  color: var(--text);
  font-size: clamp(17px, 2vw, 21px);
  line-height: 1.4;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}

.goal-timeline {
  margin: 0 0 26px;
  color: var(--muted);
  font-size: 13px;
}

.goal-details {
  display: grid;
  gap: 13px;
  margin-top: auto;
}

.goal-detail-row,
.goal-progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.goal-detail-row span,
.goal-progress-heading span {
  color: var(--muted);
}

.goal-detail-row strong,
.goal-progress-heading strong {
  color: var(--text);
}

.goal-progress {
  margin-top: 23px;
}

.progress-track {
  height: 9px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #eee7fa;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #7651c6,
    #af8de8
  );
  transition: width 0.2s;
}

.progress-note {
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.open-goal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
  margin-top: 25px;
  padding: 14px 17px;
  border: 0;
  border-radius: 11px;
  background: #f0eafd;
  color: #6743b8;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.open-goal:hover {
  background: #e5d8fa;
}

.goal-card--priority .open-goal {
  background: #7354c5;
  color: white;
}

.goal-card--priority .open-goal:hover {
  background: #6041b1;
}

.new-goal-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  gap: 12px;
  padding: 24px;
  border: 2px dashed #cfbfea;
  border-radius: 20px;
  background: #fbf9ff;
  color: var(--accent);
  text-align: center;
  cursor: pointer;
}

.new-goal-plus {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #e9defb;
  font-size: 31px;
}

.new-goal-card strong {
  font-size: 16px;
}

.new-goal-card > span:last-child {
  color: var(--muted);
  font-size: 12px;
}

.empty-state {
  padding: 42px 24px;
  border: 1px dashed #cfbee9;
  border-radius: 18px;
  background: white;
  text-align: center;
}

.empty-icon {
  color: var(--accent);
  font-size: 37px;
}

.empty-state h3 {
  font-size: 21px;
}

.empty-state p {
  max-width: 440px;
  margin: 12px auto 20px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.empty-action {
  padding: 12px 17px;
  border: 0;
  border-radius: 11px;
  background: var(--accent);
  color: white;
  font-weight: 750;
  cursor: pointer;
}

.commitments-panel {
  padding: 12px 22px;
  border: 1px solid var(--border);
  border-radius: 19px;
  background: white;
}

.commitment-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}

.commitment-row:last-child {
  border-bottom: 0;
}

.commitment-marker {
  display: grid;
  place-items: center;
  flex: 0 0 43px;
  height: 43px;
  border-radius: 12px;
  background: #efe7fc;
  color: #7354c5;
  font-size: 20px;
}

.commitment-info {
  flex: 1;
  min-width: 0;
}

.commitment-info strong {
  font-size: 14px;
  color: var(--text);
}

.commitment-info p {
  margin: 6px 0;
  color: var(--muted);
  font-size: 12px;
}

.commitment-schedule {
  color: var(--muted);
  font-size: 11px;
}

.commitment-priority {
  display: inline-block;
  margin-left: 8px;
  padding: 3px 7px;
  border-radius: 7px;
  background: #efe7fc;
  color: #6843b0;
  font-size: 10px;
  font-weight: 750;
}

.commitment-open {
  flex-shrink: 0;
  padding: 10px 14px;
  border: 0;
  border-radius: 10px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 17px;
  cursor: pointer;
}

.dashboard-disclaimer {
  margin: 0;
  padding: 13px 0;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}

@media (max-width: 1000px) {
  .stats-grid {
    grid-template-columns: repeat(
      2,
      minmax(0, 1fr)
    );
  }
}

@media (max-width: 700px) {
  .goal-grid {
    grid-template-columns: 1fr;
  }

  .welcome-banner {
    min-height: 185px;
    padding: 24px;
  }

  .banner-decoration {
    display: none;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    gap: 10px;
  }

  .stat-card {
    padding: 15px;
  }

  .stat-number {
    font-size: 27px;
  }

  .goal-card {
    padding: 19px;
  }

  .commitments-panel {
    padding: 8px 15px;
  }

  .commitment-row {
    gap: 10px;
  }

  .commitment-marker {
    flex-basis: 34px;
    height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .goal-card,
  .progress-fill {
    transition: none;
  }
}
</style>
