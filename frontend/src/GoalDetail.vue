<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";
import StrategyProposal from "./StrategyProposal.vue";
import CreateCommitment from "./CreateCommitment.vue";
import AttachGoal from "./AttachGoal.vue";
import SubmitProof from "./SubmitProof.vue";

const props = defineProps<{
  session: string;
  goal: string;
}>();

type StrategyStep = {
  description: string;
  successCriterion: string;
};

type Commitment = {
  commitment: string;
  description: string;
  recurring: boolean;
  schedule: string;
  active: boolean;
  completions: {
    completion: string;
    occurrence: string;
  }[];
};

type GoalData = {
  goal: string;
  outcome: string;
  currentContext: string;
  constraints: string;
  timeline: string;
  successDefinition: string;
  currentStrategy: StrategyStep[] | null;
  group: string | null;
  commitments: Commitment[];
};

const detail = ref<GoalData | null>(null);
const loading = ref(false);
const error = ref("");

const commitmentDescription = ref("");
const commitmentFormKey = ref(0);

function useStrategyStep(step: StrategyStep) {
  commitmentDescription.value = step.description;
  commitmentFormKey.value += 1;
}

async function loadDetail() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ detail: GoalData }>(
      "/dashboard/goal",
      {
        session: props.session,
        goal: props.goal,
      },
    );

    detail.value = result.detail;
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value =
        cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "You do not have access to this goal."
            : cause.code === "NOT_FOUND"
              ? "This goal could not be found."
              : "Could not load this goal. Please try again.";
    } else {
      error.value =
        cause instanceof Error
          ? cause.message
          : "Could not load this goal. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadDetail);
</script>

<template>
  <section class="goal-detail" aria-label="Goal detail">
    <p v-if="loading" role="status">Loading goal...</p>

    <p v-else-if="error" class="error" role="alert">
      {{ error }}
    </p>

    <template v-else-if="detail">
      <h2>{{ detail.outcome }}</h2>

      <dl>
        <dt>Starting point</dt>
        <dd>{{ detail.currentContext }}</dd>

        <dt>Constraints</dt>
        <dd>{{ detail.constraints }}</dd>

        <dt>Timeline</dt>
        <dd>{{ detail.timeline }}</dd>

        <dt>Success definition</dt>
        <dd>{{ detail.successDefinition }}</dd>
      </dl>

      <h3>Strategy</h3>

      <ol v-if="detail.currentStrategy">
        <li
          v-for="(step, index) in detail.currentStrategy"
          :key="index"
        >
          <strong>{{ step.description }}</strong>
          <p class="muted">{{ step.successCriterion }}</p>

          <button
            class="text-button"
            type="button"
            @click="useStrategyStep(step)"
            >
            Create commitment from this step
          </button>
        </li>
      </ol>

      <StrategyProposal
        v-else
        :session="props.session"
        :goal="props.goal"
        @saved="loadDetail"
      />

      <section v-if="detail.group" aria-label="Goal accountability group">
      <h3>Accountability group</h3>
      <p class="muted">
        Proof submissions for this goal are shared with this group.
      </p>
      <p>Group ID: {{ detail.group }}</p>
      </section>

      <AttachGoal
        v-else
        :session="props.session"
        :goal="props.goal"
        @attached="loadDetail"
      />

      <h3>Commitments</h3>

      <CreateCommitment
        :key="commitmentFormKey"
        :session="props.session"
        :goal="props.goal"
        :initial-description="commitmentDescription"
        @created="loadDetail"
      />

      <ul v-if="detail.commitments.length">
        <li
          v-for="commitment in detail.commitments"
          :key="commitment.commitment"
        >
          <strong>{{ commitment.description }}</strong>
          <p class="muted">
            {{ commitment.schedule }}
            · {{ commitment.recurring ? "Recurring" : "One-time" }}
            · {{ commitment.active ? "Active" : "Retired" }}
          </p>

          <div>
            <h4>Completion claims</h4>

            <ul v-if="commitment.completions.length">
                <li
                v-for="claim in commitment.completions"
                :key="claim.completion"
                >
                Claimed completion:
                {{ new Date(claim.occurrence).toLocaleString() }}
                </li>
            </ul>

            <p v-else class="muted">No completion claims yet.</p>

            <p class="muted">
                A completion claim records reported execution.
                Peer verification is shown separately in the group.
            </p>
          </div>

          <SubmitProof
            v-if="commitment.active"
            :session="props.session"
            :goal="props.goal"
            :commitment="commitment.commitment"
          />
        </li>
      </ul>

      <p v-else class="muted">No commitments yet.</p>
    </template>

    <button
      class="text-button"
      type="button"
      :disabled="loading"
      @click="loadDetail"
    >
      Reload goal
    </button>
  </section>
</template>

<style scoped>
.goal-detail {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow-wrap: anywhere;
}

dt {
  margin-top: 16px;
  font-weight: 600;
}

dd {
  margin: 6px 0 0;
  color: var(--muted);
  white-space: pre-wrap;
}

li {
  margin-bottom: 16px;
}
</style>
