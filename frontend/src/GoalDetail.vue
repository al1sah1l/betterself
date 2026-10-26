
<script setup lang="ts">
import { computed, ref } from "vue";

import GoalDetailContent from "./GoalDetailContent.vue";
import ObservedResults from "./ObservedResults.vue";
import PlanControls from "./PlanControls.vue";
import ProgressReview from "./ProgressReview.vue";
import ProgressOverview from "./ProgressOverview.vue";

defineProps<{
  session: string;
  goal: string;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

type Section = "plan" | "results" | "review";

const sections = [
  {
    id: "plan",
    number: "01",
    title: "Plan",
    description: "Strategy & commitments",
  },
  {
    id: "results",
    number: "02",
    title: "Results",
    description: "Real-world outcomes",
  },
  {
    id: "review",
    number: "03",
    title: "Review",
    description: "Reflect & improve",
  },
] as const;

const activeSection = ref<Section>("plan");
const revision = ref(0);
const progressRevision = ref(0);

const activeDescription = computed(() => {
  switch (activeSection.value) {
    case "plan":
      return "Build your strategy, take action, and prove the work you've done.";
    case "results":
      return "Capture what actually changed, not just the tasks you completed.";
    case "review":
      return "Learn from your execution and results, then decide what to improve.";
  }
});

function selectSection(section: Section) {
  if (activeSection.value !== section) {
    activeSection.value = section;
    progressRevision.value += 1;
  }
}

function planSaved() {
  revision.value += 1;
  progressRevision.value += 1;
}

function reviewSaved() {
  revision.value += 1;
  progressRevision.value += 1;
  activeSection.value = "plan";
}

function goalDeleted() {
  emit("deleted");
}
</script>

<template>
  <div class="goal-workspace">
    <header class="workspace-intro">
      <div class="workspace-intro-content">
        <p class="workspace-eyebrow">
          YOUR GOAL WORKSPACE
        </p>

        <h1>
          Every step brings you
          <span>closer.</span>
          <span
            class="workspace-sparkle"
            aria-hidden="true"
          >
            ✦
          </span>
        </h1>

        <p>
          Your strategy, commitments, and real-world
          progress — all in one place.
        </p>
      </div>

      <div
        class="workspace-intro-art"
        aria-hidden="true"
      >
        <span>✧</span>
        <span>✦</span>
      </div>
    </header>

    <ProgressOverview
      :session="session"
      :goal="goal"
      :revision="progressRevision"
    />

    <nav
      class="workspace-tabs"
      aria-label="Goal sections"
    >
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="workspace-tab"
        :class="{
          'workspace-tab--active':
            activeSection === section.id,
        }"
        :aria-current="
          activeSection === section.id
            ? 'page'
            : undefined
        "
        @click="selectSection(section.id)"
      >
        <span class="tab-number">
          {{ section.number }}
        </span>

        <span class="tab-copy">
          <strong>{{ section.title }}</strong>
          <small>{{ section.description }}</small>
        </span>

        <span
          class="tab-arrow"
          aria-hidden="true"
        >
          ↗
        </span>
      </button>
    </nav>

    <div class="workspace-section-heading">
      <div>
        <p class="workspace-section-eyebrow">
          {{
            activeSection === "plan"
              ? "TURN IDEAS INTO ACTION"
              : activeSection === "results"
                ? "MEASURE WHAT MATTERS"
                : "LEARN AND ADAPT"
          }}
        </p>

        <h2>
          {{
            activeSection === "plan"
              ? "Your action plan"
              : activeSection === "results"
                ? "Your observed results"
                : "Your progress review"
          }}
        </h2>

        <p>
          {{ activeDescription }}
        </p>
      </div>
    </div>

    <section
      v-show="activeSection === 'plan'"
      class="workspace-panel"
      aria-label="Goal plan"
    >
      <PlanControls
        :key="`plan-${session}-${goal}`"
        :session="session"
        :goal="goal"
        @saved="planSaved"
        @deleted="goalDeleted"
      />

      <GoalDetailContent
        :key="`detail-${session}-${goal}-${revision}`"
        :session="session"
        :goal="goal"
      />
    </section>

    <section
      v-show="activeSection === 'results'"
      class="workspace-panel"
      aria-label="Observed results"
    >
      <ObservedResults
        :key="`results-${session}-${goal}`"
        :session="session"
        :goal="goal"
      />
    </section>

    <section
      v-show="activeSection === 'review'"
      class="workspace-panel"
      aria-label="Progress review"
    >
      <ProgressReview
        :key="`review-${session}-${goal}`"
        :session="session"
        :goal="goal"
        @saved="reviewSaved"
      />
    </section>

    <footer class="workspace-footer">
      <span aria-hidden="true">✦</span>
      Small steps. Meaningful progress. BetterSelf.
    </footer>
  </div>
</template>

<style>
@import "./GoalWorkspaceTheme.css";
</style>

<style scoped>
.goal-workspace {
  min-width: 0;
  padding-bottom: 24px;
}

.workspace-intro {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 195px;
  overflow: hidden;
  padding: 30px 34px;
  border-radius: 22px;
  background: linear-gradient(
    115deg,
    #6744ba 0%,
    #8767d5 62%,
    #b49aeb 100%
  );
  color: white;
}

.workspace-intro-content {
  position: relative;
  z-index: 1;
  max-width: 620px;
}

.workspace-eyebrow {
  margin: 0 0 11px;
  color: #ece0ff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.workspace-intro h1 {
  margin: 0;
  color: white;
  font-size: clamp(25px, 3vw, 35px);
  line-height: 1.25;
  letter-spacing: -0.045em;
}

.workspace-intro h1 > span:first-child {
  color: #f5e5ff;
}

.workspace-sparkle {
  margin-left: 8px;
  color: #e8d0ff;
  font-size: 25px;
}

.workspace-intro-content > p:last-child {
  margin: 12px 0 0;
  color: #f4edff;
  font-size: 13px;
  line-height: 1.65;
}

.workspace-intro-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.workspace-intro-art span:first-child {
  position: absolute;
  top: 12px;
  right: 45px;
  color: white;
  font-size: 125px;
  opacity: 0.15;
}

.workspace-intro-art span:last-child {
  position: absolute;
  right: 180px;
  bottom: -55px;
  color: white;
  font-size: 135px;
  opacity: 0.12;
}

.workspace-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 30px;
}

.workspace-tab {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: white;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.workspace-tab:hover {
  transform: translateY(-2px);
  border-color: #bba6e9;
}

.workspace-tab--active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
  box-shadow: 0 7px 22px rgba(115, 84, 197, 0.17);
}

.tab-number {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #f0eafd;
  color: var(--accent);
  font-size: 13px;
  font-weight: 800;
}

.workspace-tab--active .tab-number {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.tab-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

.tab-copy strong {
  font-size: 14px;
  font-weight: 750;
}

.tab-copy small {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
}

.workspace-tab--active .tab-copy small {
  color: #eee6ff;
}

.tab-arrow {
  margin-left: auto;
  color: #a48abc;
  font-size: 17px;
}

.workspace-tab--active .tab-arrow {
  color: #eee6ff;
}

.workspace-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin: 38px 0 8px;
}

.workspace-section-eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.workspace-section-heading h2 {
  margin: 0;
  font-size: clamp(23px, 3vw, 29px);
  letter-spacing: -0.035em;
}

.workspace-section-heading > div > p:last-child {
  max-width: 650px;
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}

.workspace-panel {
  min-width: 0;
}

.workspace-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 45px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.workspace-footer span {
  color: var(--accent);
}

@media (max-width: 850px) {
  .workspace-tabs {
    gap: 8px;
  }

  .workspace-tab {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .tab-arrow {
    display: none;
  }
}

@media (max-width: 600px) {
  .workspace-intro {
    padding: 25px 20px;
    min-height: 165px;
  }

  .workspace-tabs {
    gap: 6px;
  }

  .workspace-tab {
    padding: 12px 9px;
  }

  .tab-number {
    width: 30px;
    height: 30px;
    font-size: 11px;
  }

  .tab-copy strong {
    font-size: 13px;
  }

  .tab-copy small {
    display: none;
  }

  .workspace-section-heading {
    margin-top: 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-tab {
    transition: none;
  }
}
</style>
