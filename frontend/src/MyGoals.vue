<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";
import CreateGoal from "./CreateGoal.vue";
import GoalDetail from "./GoalDetail.vue";

const props = defineProps<{
  session: string;
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
      cause instanceof ApiError && cause.code === "UNAUTHORIZED"
        ? "Your session has expired. Please sign out and sign in again."
        : cause instanceof Error && !(cause instanceof ApiError)
          ? cause.message
          : "Could not load your goals. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadGoals);
</script>

<template>
  <section aria-labelledby="my-goals-heading">
    <h2 id="my-goals-heading">My goals</h2>

    <CreateGoal
        :session="props.session"
        @created="loadGoals"
    />

    <p v-if="loading" role="status">Loading goals...</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>

    <template v-else>
      <p v-if="goals.length === 0" class="muted">
        No goals yet. Your first goal starts here.
      </p>

      <ul v-else>
        <li v-for="goal in goals" :key="goal.goal">
          <strong>{{ goal.outcome }}</strong>
          <p class="muted">{{ goal.timeline }}</p>
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
    
    <GoalDetail
        v-if="selectedGoal"
        :key="selectedGoal"
        :session="props.session"
        :goal="selectedGoal"
    />

  </section>
</template>

