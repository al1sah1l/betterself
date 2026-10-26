
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
  revision?: number;
}>();

type Completion = {
  occurrence: string;
};

type Commitment = {
  commitment: string;
  description: string;
  recurring: boolean;
  active: boolean;
  completions: Completion[];
};

type GoalDetail = {
  commitments: Commitment[];
};

type Observation = {
  result: string;
  description: string;
  observedOn: string;
};

const commitments = ref<Commitment[]>([]);
const observations = ref<Observation[]>([]);
const loading = ref(false);
const loaded = ref(false);
const error = ref("");

let requestId = 0;

async function refresh() {
  const id = ++requestId;

  loading.value = true;
  error.value = "";

  try {
    const [goalResponse, resultResponse] =
      await Promise.all([
        api<{ detail: GoalDetail }>(
          "/dashboard/goal",
          {
            session: props.session,
            goal: props.goal,
          },
        ),

        api<{ results: Observation[] }>(
          "/dashboard/results",
          {
            session: props.session,
            goal: props.goal,
          },
        ),
      ]);

    if (id !== requestId) return;

    commitments.value =
      goalResponse.detail.commitments ?? [];

    observations.value =
      resultResponse.results ?? [];

    loaded.value = true;
  } catch (cause) {
    if (id !== requestId) return;

    error.value =
      cause instanceof ApiError &&
      cause.code === "UNAUTHORIZED"
        ? "Your session has expired. Sign in again."
        : cause instanceof ApiError &&
            cause.code === "FORBIDDEN"
          ? "You cannot access this goal."
          : "Could not load progress. Please try again.";
  } finally {
    if (id === requestId) {
      loading.value = false;
    }
  }
}

const oneTime = computed(() =>
  commitments.value.filter(
    (commitment) => !commitment.recurring,
  ),
);

const completedOneTime = computed(
  () =>
    oneTime.value.filter(
      (commitment) =>
        commitment.completions.length > 0,
    ).length,
);

const oneTimePercent = computed(() => {
  if (!oneTime.value.length) return 0;

  return Math.round(
    (completedOneTime.value /
      oneTime.value.length) *
      100,
  );
});

const recurring = computed(() =>
  commitments.value.filter(
    (commitment) => commitment.recurring,
  ),
);

const recurringCompletions = computed(() =>
  recurring.value.reduce(
    (count, commitment) =>
      count + commitment.completions.length,
    0,
  ),
);

const activeCommitments = computed(
  () =>
    commitments.value.filter(
      (commitment) => commitment.active,
    ).length,
);

const retiredCommitments = computed(
  () =>
    commitments.value.filter(
      (commitment) => !commitment.active,
    ).length,
);

const observationsCount = computed(
  () => observations.value.length,
);

const lastObservation = computed(() => {
  return [...observations.value].sort(
    (a, b) =>
      b.observedOn.localeCompare(a.observedOn),
  )[0];
});

watch(
  () => [props.session, props.goal, props.revision],
  refresh,
);

onMounted(refresh);
</script>

<template>
  <section
    class="progress-overview"
    aria-labelledby="progress-title"
  >
    <header class="progress-heading">
      <div>
        <p class="progress-eyebrow">
          YOUR PROGRESS
        </p>

        <h2 id="progress-title">
          Progress overview
        </h2>

        <p class="progress-subtitle">
          Track what you've completed and what
          has changed in the real world.
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
    </header>

    <p
      v-if="error"
      class="progress-error"
      role="alert"
    >
      {{ error }}
    </p>

    <p
      v-if="loading && !loaded"
      class="progress-loading"
      role="status"
    >
      Loading your progress...
    </p>

    <template v-if="loaded">
      <div class="progress-grid">
        <section class="progress-card execution">
          <p class="metric-label">
            ONE-TIME COMMITMENTS
          </p>

          <div class="progress-number">
            <strong>
              {{ completedOneTime }}
            </strong>
            <span>
              / {{ oneTime.length }}
            </span>
          </div>

          <div
            class="progress-track"
            role="progressbar"
            :aria-valuenow="completedOneTime"
            :aria-valuemin="0"
            :aria-valuemax="oneTime.length || 1"
            :aria-label="
              'Completed one-time commitments'
            "
          >
            <div
              class="progress-fill"
              :style="{
                width: `${oneTimePercent}%`,
              }"
            />
          </div>

          <p class="metric-description">
            {{
              oneTime.length
                ? `${oneTimePercent}% of one-time commitments have completion claims`
                : "No one-time commitments yet"
            }}
          </p>
        </section>

        <section class="progress-card recurring">
          <p class="metric-label">
            RECURRING EXECUTION
          </p>

          <div class="progress-number">
            <strong>
              {{ recurringCompletions }}
            </strong>
          </div>

          <p class="metric-description">
            Recorded recurring completion
            {{ recurringCompletions === 1
              ? "claim"
              : "claims" }}
            across {{ recurring.length }}
            recurring
            {{ recurring.length === 1
              ? "commitment"
              : "commitments" }}.
          </p>
        </section>

        <section class="progress-card outcomes">
          <p class="metric-label">
            OBSERVED RESULTS
          </p>

          <div class="progress-number">
            <strong>
              {{ observationsCount }}
            </strong>
          </div>

          <p class="metric-description">
            Real-world observations recorded
            separately from completing actions.
          </p>
        </section>
      </div>

      <div class="progress-bottom">
        <div class="commitment-summary">
          <span>
            <strong>{{ activeCommitments }}</strong>
            active commitments
          </span>

          <span class="summary-divider">
            ·
          </span>

          <span>
            <strong>{{ retiredCommitments }}</strong>
            retired
          </span>
        </div>

        <p
          v-if="lastObservation"
          class="latest-observation"
        >
          <strong>Latest observed result:</strong>
          {{ lastObservation.description }}
        </p>

        <p class="progress-note">
          Completion claims measure recorded
          execution, not peer verification
          or achievement of the goal itself.
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.progress-overview {
  margin: 26px 0 30px;
  padding: 25px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #faf8ff;
  overflow-wrap: anywhere;
}

.progress-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.progress-eyebrow {
  margin: 0 0 7px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.progress-heading h2 {
  margin: 0;
  color: var(--text);
  font-size: 22px;
}

.progress-subtitle {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.refresh-button {
  flex-shrink: 0;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: white;
  color: var(--accent);
  font-weight: 650;
  cursor: pointer;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.progress-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}

.progress-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid #e7e0f4;
  border-radius: 14px;
  background: white;
}

.metric-label {
  margin: 0 0 17px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #756987;
}

.progress-number {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 14px;
}

.progress-number strong {
  color: var(--accent);
  font-size: 35px;
  line-height: 1;
}

.progress-number span {
  color: var(--muted);
  font-size: 19px;
}

.progress-track {
  height: 9px;
  border-radius: 999px;
  background: #eee8f9;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.25s ease;
}

.metric-description {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

.progress-bottom {
  display: grid;
  gap: 10px;
  margin-top: 19px;
}

.commitment-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
}

.commitment-summary strong {
  color: var(--text);
}

.summary-divider {
  color: #b9b0c9;
}

.latest-observation {
  margin: 0;
  padding: 12px;
  border-radius: 9px;
  background: #f0eafa;
  color: var(--text);
  font-size: 12px;
  line-height: 1.65;
}

.progress-note {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.progress-error {
  padding: 12px;
  border-radius: 9px;
  background: #fff0f0;
  color: #a32939;
}

.progress-loading {
  color: var(--muted);
}

@media (max-width: 800px) {
  .progress-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .progress-overview {
    padding: 16px;
  }

  .progress-heading {
    flex-direction: column;
  }
}
</style>
