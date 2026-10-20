<script setup lang="ts">
import { ref } from "vue";
import GoalDetailContent from "./GoalDetailContent.vue";
import ObservedResults from "./ObservedResults.vue";
import PlanControls from "./PlanControls.vue";
import ProgressReview from "./ProgressReview.vue";

defineProps<{
  session: string;
  goal: string;
}>();

type Section = "plan" | "results" | "review";

const activeSection = ref<Section>("plan");
const revision = ref(0);

function planSaved() {
  revision.value += 1;
}

function reviewSaved() {
  revision.value += 1;
  activeSection.value = "plan";
}
</script>

<template>
  <div class="goal-workspace">
    <nav class="goal-navigation" aria-label="Goal sections">
      <button
        type="button"
        :aria-pressed="activeSection === 'plan'"
        @click="activeSection = 'plan'"
      >
        Plan
      </button>

      <button
        type="button"
        :aria-pressed="activeSection === 'results'"
        @click="activeSection = 'results'"
      >
        Results
      </button>

      <button
        type="button"
        :aria-pressed="activeSection === 'review'"
        @click="activeSection = 'review'"
      >
        Review
      </button>
    </nav>

    <section v-show="activeSection === 'plan'" aria-label="Goal plan">
      <p class="section-description">
        Your strategy, commitments, and submitted evidence.
      </p>

      <PlanControls
        :key="`plan-${session}-${goal}`"
        :session="session"
        :goal="goal"
        @saved="planSaved"
      />

      <GoalDetailContent
        :key="`detail-${session}-${goal}-${revision}`"
        :session="session"
        :goal="goal"
      />
    </section>

    <section
      v-show="activeSection === 'results'"
      aria-label="Observed results"
    >
      <p class="section-description">
        Record what changed in the real world, separately from
        completing your commitments.
      </p>

      <ObservedResults
        :key="`results-${session}-${goal}`"
        :session="session"
        :goal="goal"
      />
    </section>

    <section
      v-show="activeSection === 'review'"
      aria-label="Progress review"
    >
      <p class="section-description">
        Review your execution and results, then decide whether to
        change your strategy.
      </p>

      <ProgressReview
        :key="`review-${session}-${goal}`"
        :session="session"
        :goal="goal"
        @saved="reviewSaved"
      />
    </section>
  </div>
</template>

<style scoped>
.goal-workspace {
  margin-top: 24px;
}

.goal-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--background);
}

.goal-navigation button {
  flex: 1;
  min-width: 90px;
  padding: 12px 16px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.goal-navigation button:hover {
  background: var(--surface);
  color: var(--text);
}

.goal-navigation button[aria-pressed="true"] {
  background: var(--accent);
  color: white;
}

.goal-navigation button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.section-description {
  margin: 20px 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}
</style>
