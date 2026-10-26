
<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
  nextTick,
} from "vue";

import { api } from "./api";

import GoalDetailContent from "./GoalDetailContent.vue";
import ObservedResults from "./ObservedResults.vue";
import PlanControls from "./PlanControls.vue";
import ProgressReview from "./ProgressReview.vue";
import ProgressOverview from "./ProgressOverview.vue";
import PriorityGoalPicker from "./PriorityGoalPicker.vue";

const props = defineProps<{
  session: string;
  goal: string;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

type Section = "plan" | "results" | "review";

type Commitment = {
  commitment: string;
  description: string;
  active: boolean;
  recurring: boolean;
  proofs: { proof: string }[];
};

type GoalDetailData = {
  outcome: string;
  timeline: string;
  successDefinition: string;
  commitments: Commitment[];
};

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
const overview = ref<GoalDetailData | null>(null);

const selectedCommitment = ref("");
const showProofPicker = ref(false);
const proofMessage = ref("");
const settingsDialog = ref<HTMLDialogElement | null>(null);

const activeDescription = computed(() => {
  switch (activeSection.value) {
    case "plan":
      return "Turn your strategy into concrete action.";
    case "results":
      return "Record what has changed in the real world.";
    case "review":
      return "Reflect on your progress and adapt.";
  }
});

const availableForProof = computed(() =>
  (overview.value?.commitments ?? []).filter(
    (item) =>
      item.active &&
      (item.recurring || (item.proofs?.length ?? 0) === 0),
  ),
);

async function loadOverview() {
  try {
    const result = await api<{
      detail: GoalDetailData;
    }>("/dashboard/goal", {
      session: props.session,
      goal: props.goal,
    });

    overview.value = result.detail;
  } catch {
    overview.value = null;
  }
}

function selectSection(section: Section) {
  if (activeSection.value !== section) {
    activeSection.value = section;
    progressRevision.value += 1;
  }
}

function planSaved() {
  revision.value += 1;
  progressRevision.value += 1;
  void loadOverview();
}

function reviewSaved() {
  revision.value += 1;
  progressRevision.value += 1;
  activeSection.value = "plan";
  void loadOverview();
}

function goalDeleted() {
  emit("deleted");
}

async function openSettings() {
  settingsDialog.value?.showModal();
  await nextTick();

  const panel = settingsDialog.value?.querySelector<HTMLDetailsElement>(
    "details.plan-controls",
  );
  if (panel) panel.open = true;
}

function closeSettings() {
  settingsDialog.value?.close();
}

function settingsDeleted() {
  closeSettings();
  goalDeleted();
}

function openProofPicker() {
  proofMessage.value = "";
  showProofPicker.value = true;
  activeSection.value = "plan";
  void loadOverview();
}

async function jumpToProof() {
  if (!selectedCommitment.value) {
    proofMessage.value = "Choose the commitment you want to prove.";
    return;
  }

  activeSection.value = "plan";
  proofMessage.value = "";
  await nextTick();

  const card = document.getElementById(
    `commitment-${selectedCommitment.value}`,
  );

  if (!card) {
    proofMessage.value =
      "Commitment is not visible. Choose All in the commitment filters and try again.";
    return;
  }

  const details = card.querySelector<HTMLDetailsElement>(
    "details.proof-submission",
  );

  if (!details) {
    proofMessage.value =
      "Proof submission is unavailable for this commitment.";
    return;
  }

  details.open = true;
  card.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "center",
  });

  showProofPicker.value = false;
  await nextTick();

  const firstField = details.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >("textarea, input:not([type=hidden])");

  firstField?.focus({ preventScroll: true });
}

watch(
  () => [props.session, props.goal],
  () => {
    closeSettings();
    selectedCommitment.value = "";
    showProofPicker.value = false;
    activeSection.value = "plan";
    overview.value = null;
    void loadOverview();
  },
);

onMounted(loadOverview);
</script>

<template>
  <div class="goal-workspace">
    <header class="workspace-intro">
      <div class="workspace-intro-content">
        <p class="workspace-eyebrow">YOUR GOAL WORKSPACE</p>
        <h1>{{ overview?.outcome || "Your next big step" }}</h1>
        <p class="intro-description">
          {{
            overview?.timeline
              ? `Target: ${overview.timeline}`
              : "Your goal, your strategy, your progress."
          }}
        </p>
        <div class="hero-actions">
          <button type="button" class="hero-primary" @click="openProofPicker">
            Submit proof <span aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            class="hero-secondary"
            @click="selectSection('results')"
          >
            Record results
          </button>
        </div>
      </div>
      <div class="workspace-intro-art" aria-hidden="true">
        <span>✧</span>
        <span>✦</span>
      </div>
    </header>

    <PriorityGoalPicker
      :session="session"
      :current-goal="goal"
      class="priority-section"
    />

    <section
      v-if="showProofPicker"
      class="quick-proof"
      aria-label="Quick proof submission"
    >
      <div class="quick-proof-heading">
        <div>
          <h2>What did you accomplish?</h2>
          <p>
            Choose a commitment, and we'll take you
            directly to its proof form.
          </p>
        </div>
        <button
          class="close-quick-proof"
          type="button"
          aria-label="Close proof shortcut"
          @click="showProofPicker = false"
        >
          ×
        </button>
      </div>

      <div v-if="availableForProof.length" class="quick-proof-controls">
        <label for="quick-proof-commitment">Commitment</label>
        <select id="quick-proof-commitment" v-model="selectedCommitment">
          <option disabled value="">Select a commitment</option>
          <option
            v-for="item in availableForProof"
            :key="item.commitment"
            :value="item.commitment"
          >
            {{ item.description }}
          </option>
        </select>
        <button
          type="button"
          class="quick-proof-button"
          :disabled="!selectedCommitment"
          @click="jumpToProof"
        >
          Continue to proof →
        </button>
      </div>

      <p v-else class="quick-proof-empty">
        No commitments are currently available
        for a new proof. Add a commitment or review
        your existing submissions below.
      </p>
      <p v-if="proofMessage" class="quick-proof-error" role="alert">
        {{ proofMessage }}
      </p>
    </section>

    <ProgressOverview
      :session="session"
      :goal="goal"
      :revision="progressRevision"
    />

    <nav class="workspace-tabs" aria-label="Goal sections">
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="workspace-tab"
        :class="{
          'workspace-tab--active': activeSection === section.id,
        }"
        :aria-current="activeSection === section.id ? 'page' : undefined"
        @click="selectSection(section.id)"
      >
        <span class="tab-number">{{ section.number }}</span>
        <span class="tab-copy">
          <strong>{{ section.title }}</strong>
          <small>{{ section.description }}</small>
        </span>
        <span class="tab-arrow" aria-hidden="true">↗</span>
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
                ? "Observed results"
                : "Progress review"
          }}
        </h2>
        <p>{{ activeDescription }}</p>
      </div>
    </div>

    <section
      v-show="activeSection === 'plan'"
      class="workspace-panel"
      aria-label="Goal plan"
    >
      <GoalDetailContent
        :key="`detail-${session}-${goal}-${revision}`"
        :session="session"
        :goal="goal"
        @open-settings="openSettings"
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

    <dialog
      ref="settingsDialog"
      class="goal-settings-dialog"
      aria-label="Goal settings"
    >
      <div class="settings-dialog-header">
        <h2>Goal Settings</h2>
        <button
          type="button"
          class="settings-close-button"
          aria-label="Close goal settings"
          @click="closeSettings"
        >
          ×
        </button>
      </div>

      <PlanControls
        :key="`plan-${session}-${goal}`"
        :session="session"
        :goal="goal"
        @saved="planSaved"
        @deleted="settingsDeleted"
      />
    </dialog>
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
  max-width: 750px;
  min-width: 0;
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
  font-size: clamp(25px, 3vw, 36px);
  line-height: 1.25;
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
}

.intro-description {
  margin: 12px 0 0;
  color: #f4edff;
  font-size: 13px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.hero-primary,
.hero-secondary {
  min-height: 42px;
  padding: 11px 16px;
  border-radius: 10px;
  color: white;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: #fff;
  color: #6844b8;
}

.hero-secondary {
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.12);
}

.workspace-intro-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.workspace-intro-art span:first-child {
  position: absolute;
  top: 10px;
  right: 45px;
  font-size: 125px;
  opacity: 0.15;
}

.workspace-intro-art span:last-child {
  position: absolute;
  right: 180px;
  bottom: -55px;
  font-size: 135px;
  opacity: 0.12;
}

.priority-section {
  margin-top: 18px;
}

.quick-proof {
  margin-top: 18px;
  padding: 23px;
  border: 1px solid #dac9f1;
  border-radius: 17px;
  background: #faf7ff;
}

.quick-proof-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.quick-proof h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.025em;
}

.quick-proof-heading p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.close-quick-proof {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 25px;
  cursor: pointer;
}

.quick-proof-controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.quick-proof-controls label {
  flex: 0 0 100%;
  font-size: 12px;
  font-weight: 750;
}

.quick-proof-controls select {
  flex: 1;
  min-width: 200px;
  min-height: 43px;
  padding: 10px;
  border: 1px solid #d6c8eb;
  border-radius: 10px;
  background: white;
  color: var(--text);
}

.quick-proof-button {
  min-height: 43px;
  padding: 11px 16px;
  border: 0;
  border-radius: 10px;
  background: #7354c5;
  color: white;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.quick-proof-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-proof-empty {
  color: var(--muted);
  font-size: 13px;
}

.quick-proof-error {
  color: #a32939;
  font-size: 12px;
}

.workspace-tabs {
  display: grid;
  grid-template-columns: repeat(
    3,
    minmax(0, 1fr)
  );
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
}

.workspace-tab:hover {
  border-color: #bba6e9;
}

.workspace-tab--active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
  box-shadow:
    0 7px 22px rgba(115, 84, 197, 0.17);
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
  margin: 32px 0 12px;
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

.goal-settings-dialog {
  width: min(650px, calc(100% - 32px));
  max-height: 85vh;
  overflow-y: auto;
  padding: 24px;
  border: 1px solid #e2d7f3;
  border-radius: 20px;
  background: white;
  color: var(--text);
  box-shadow: 0 25px 80px rgba(47, 30, 85, 0.25);
}

.goal-settings-dialog::backdrop {
  background: rgba(32, 22, 53, 0.48);
}

.settings-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 15px;
}

.settings-dialog-header h2 {
  margin: 0;
  font-size: 23px;
}

.settings-close-button {
  width: 37px;
  height: 37px;
  border: 0;
  border-radius: 9px;
  background: #f2ecfc;
  color: #7354c5;
  font-size: 24px;
  cursor: pointer;
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

  .quick-proof {
    padding: 16px;
  }

  .quick-proof-controls select,
  .quick-proof-button {
    flex: 0 0 100%;
    width: 100%;
  }

  .workspace-section-heading {
    margin-top: 25px;
  }
}
</style>
