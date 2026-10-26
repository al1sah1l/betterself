
<script setup lang="ts">
import {
  computed,
  onActivated,
  onMounted,
  ref,
} from "vue";

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
const loading = ref(false);
const loaded = ref(false);
const error = ref("");

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
          : "Could not load your dashboard. Please try again.";
    }
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

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
  goals.value
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
    <div class="welcome-banner">
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
        <div class="decoration-circle circle-one" />
        <div class="decoration-circle circle-two" />
        <span class="decoration-star">✦</span>
      </div>
    </div>

    <div class="dashboard-toolbar">
      <div>
        <h2>Overview</h2>
        <p class="muted">
          A snapshot of your journey so far.
        </p>
      </div>

      <button
        class="refresh-button"
        type="button"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? "Refreshing..." : "↻ Refresh" }}
      </button>
    </div>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}

      <button
        type="button"
        class="retry-button"
        @click="refresh"
      >
        Try again
      </button>
    </p>

    <p
      v-if="loading && !loaded"
      class="muted"
      role="status"
    >
      Loading your dashboard...
    </p>

    <template v-if="loaded">
      <div class="stats-grid">
        <article class="stat-card">
          <div class="stat-icon">
            ◎
          </div>

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
          <div class="stat-icon">
            ✓
          </div>

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
          <div class="stat-icon">
            ✦
          </div>

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
          <div class="stat-icon">
            ◈
          </div>

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
          <div
            class="empty-icon"
            aria-hidden="true"
          >
            ◎
          </div>

          <h3>Every great journey starts somewhere.</h3>

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
            v-for="goal in goals"
            :key="goal.goal"
            class="goal-card"
          >
            <div class="goal-card-top">
              <span class="goal-label">
                MY GOAL
              </span>

              <span
                class="goal-sparkle"
                aria-hidden="true"
              >
                ✧
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
                <span>Recurring completion claims</span>

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
              @click="emit('open-goal', goal.goal)"
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
            @click="emit('navigate', 'commitments')"
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
              @click="emit('open-goal', item.goalId)"
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

/* Welcome banner */

.welcome-banner {
  position: relative;
  overflow: hidden;
  min-height: 218px;
  display: flex;
  align-items: center;
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
  max-width: 590px;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #e9dcff;
}

.welcome-banner h1 {
  margin: 0;
  color: white;
  font-size: clamp(26px, 3.5vw, 38px);
  line-height: 1.2;
  letter-spacing: -0.04em;
}

.welcome-description {
  margin: 12px 0 20px;
  line-height: 1.6;
  font-size: 14px;
  color: #f4eeff;
}

.welcome-button {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 12px 17px;
  border: 0;
  border-radius: 10px;
  background: white;
  color: #6743b8;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.welcome-button:hover {
  background: #f2eaff;
}

.banner-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.decoration-circle {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
}

.circle-one {
  width: 280px;
  height: 280px;
  right: -75px;
  top: -130px;
}

.circle-two {
  width: 210px;
  height: 210px;
  right: 35px;
  bottom: -135px;
}

.decoration-star {
  position: absolute;
  right: 80px;
  top: 55px;
  font-size: 74px;
  opacity: 0.35;
}

/* Headings */

.dashboard-toolbar,
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-toolbar h2,
.section-heading h2 {
  margin: 0;
  font-size: 23px;
  letter-spacing: -0.035em;
}

.dashboard-toolbar .muted {
  margin: 5px 0 0;
  font-size: 13px;
}

.section-eyebrow {
  margin: 0 0 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.refresh-button {
  flex-shrink: 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  color: var(--accent);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.section-link {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.retry-button {
  margin-left: 12px;
  border: 0;
  background: transparent;
  font-weight: 750;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

/* Metrics */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 19px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: white;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 35px;
  height: 35px;
  margin-bottom: 14px;
  border-radius: 10px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 21px;
}

.stat-number {
  color: var(--accent);
  font-size: 32px;
  line-height: 1.1;
}

.stat-label {
  margin-top: 7px;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.4;
}

.stat-footnote {
  margin-top: 7px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

/* Goal cards */

.goals-section,
.commitments-section {
  display: grid;
  gap: 18px;
}

.goal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.goal-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 23px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: white;
  overflow-wrap: anywhere;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.goal-card:hover {
  border-color: #b9a4ea;
  box-shadow: 0 10px 30px rgba(70, 48, 130, 0.08);
  transform: translateY(-2px);
}

.goal-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-label {
  padding: 5px 9px;
  border-radius: 7px;
  background: #f0eafd;
  color: #7354c5;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.goal-sparkle {
  color: #b49be6;
  font-size: 23px;
}

.goal-card h3 {
  margin: 20px 0 8px;
  font-size: 19px;
  line-height: 1.35;
  letter-spacing: -0.02em;
}

.goal-timeline {
  margin: 0 0 22px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.goal-details {
  display: grid;
  gap: 10px;
  margin-top: auto;
}

.goal-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.goal-detail-row span {
  color: var(--muted);
}

.goal-detail-row strong {
  color: var(--text);
}

.goal-progress {
  margin-top: 20px;
}

.goal-progress-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
  color: var(--muted);
  font-size: 12px;
}

.goal-progress-heading strong {
  color: var(--text);
}

.progress-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #eee8f9;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #7354c5,
    #aa8be5
  );
  transition: width 0.25s ease;
}

.progress-note {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.open-goal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 22px;
  padding: 12px 14px;
  border: 0;
  border-radius: 10px;
  background: #f0eafd;
  color: #6743b8;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.open-goal:hover {
  background: #e5d8fa;
}

.new-goal-card {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  padding: 24px;
  border: 2px dashed #cfbee9;
  border-radius: 18px;
  background: #fbf9ff;
  color: var(--accent);
  cursor: pointer;
  text-align: center;
}

.new-goal-card:hover {
  background: #f2ecfd;
}

.new-goal-plus {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #e9ddfc;
  font-size: 28px;
}

.new-goal-card strong {
  font-size: 16px;
}

.new-goal-card > span:last-child {
  color: var(--muted);
  font-size: 12px;
}

/* Empty state */

.empty-state {
  padding: 36px 22px;
  border: 1px dashed #cfbee9;
  border-radius: 18px;
  background: white;
  text-align: center;
}

.empty-icon {
  font-size: 38px;
  color: var(--accent);
}

.empty-state h3 {
  margin: 12px 0;
}

.empty-state p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.empty-action {
  margin-top: 14px;
  padding: 12px 18px;
  border: 0;
  border-radius: 10px;
  background: var(--accent);
  color: white;
  font-weight: 750;
  cursor: pointer;
}

/* Commitments */

.commitments-panel {
  padding: 4px 21px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: white;
}

.commitment-row {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 19px 0;
  border-bottom: 1px solid var(--border);
}

.commitment-row:last-child {
  border-bottom: 0;
}

.commitment-marker {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 37px;
  height: 37px;
  border-radius: 11px;
  background: #efe8fb;
  color: var(--accent);
  font-size: 18px;
}

.commitment-info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.commitment-info strong {
  display: block;
  font-size: 13px;
  line-height: 1.5;
}

.commitment-info p {
  margin: 5px 0;
  color: var(--muted);
  font-size: 12px;
}

.commitment-schedule {
  display: inline-block;
  margin-top: 3px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
}

.commitment-open {
  flex-shrink: 0;
  padding: 7px;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 22px;
  cursor: pointer;
}

.dashboard-disclaimer {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}

/* Responsive */

@media (max-width: 1050px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .dashboard {
    gap: 24px;
  }

  .welcome-banner {
    padding: 25px 20px;
  }

  .banner-decoration {
    opacity: 0.45;
  }

  .dashboard-toolbar,
  .section-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .goal-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    gap: 10px;
  }

  .stat-card {
    padding: 15px;
  }

  .stat-number {
    font-size: 27px;
  }

  .commitments-panel {
    padding: 3px 15px;
  }

  .commitment-row {
    gap: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .goal-card,
  .progress-fill {
    transition: none;
  }
}
</style>
