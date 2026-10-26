
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
}>();

const emit = defineEmits<{
  created: [goal: string];
}>();

type FieldKey =
  | "outcome"
  | "currentContext"
  | "constraints"
  | "timeline"
  | "successDefinition";

const fields: {
  key: FieldKey;
  number: string;
  label: string;
  description: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    key: "outcome",
    number: "01",
    label: "What do you want to achieve?",
    description: "Start with the outcome, not the tasks.",
    placeholder:
      "e.g. Get a software engineering internship",
    hint: "Be specific about what you want to accomplish.",
  },
  {
    key: "currentContext",
    number: "02",
    label: "Where are you starting?",
    description: "Tell BetterSelf what your current situation looks like.",
    placeholder:
      "e.g. I have a resume and two projects, but I haven't started applying.",
    hint: "Include relevant experience, resources, or progress.",
  },
  {
    key: "constraints",
    number: "03",
    label: "What might get in your way?",
    description: "A realistic strategy should fit your life.",
    placeholder:
      "e.g. I have five hours per week and a full course load.",
    hint: "Think about time, money, access, or other limitations.",
  },
  {
    key: "timeline",
    number: "04",
    label: "When do you want to get there?",
    description: "Give your goal a target timeframe.",
    placeholder: "e.g. By summer 2027",
    hint: "An approximate timeframe is fine.",
  },
  {
    key: "successDefinition",
    number: "05",
    label: "How will you know you've succeeded?",
    description: "Define what a successful outcome actually looks like.",
    placeholder:
      "e.g. Receive and accept an internship offer.",
    hint: "Choose something you can eventually observe or verify.",
  },
];

const form = reactive<Record<FieldKey, string>>({
  outcome: "",
  currentContext: "",
  constraints: "",
  timeline: "",
  successDefinition: "",
});

const loading = ref(false);
const error = ref("");
const attempted = ref(false);

const completedCount = computed(() =>
  fields.filter(
    (field) => form[field.key].trim().length > 0,
  ).length,
);

const progressPercent = computed(() =>
  Math.round(
    (completedCount.value / fields.length) * 100,
  ),
);

const isComplete = computed(
  () => completedCount.value === fields.length,
);

function fieldMissing(key: FieldKey): boolean {
  return attempted.value && !form[key].trim();
}

async function createGoal() {
  if (loading.value) return;

  error.value = "";
  attempted.value = true;

  if (!isComplete.value) {
    error.value =
      "Please complete all five sections before continuing.";

    const firstMissing = fields.find(
      (field) => !form[field.key].trim(),
    );

    if (firstMissing) {
      document
        .getElementById(`goal-${firstMissing.key}`)
        ?.focus();
    }

    return;
  }

  loading.value = true;

  try {
    const result = await api<{ goal: string }>(
      "/goals/create",
      {
        session: props.session,
        outcome: form.outcome.trim(),
        currentContext: form.currentContext.trim(),
        constraints: form.constraints.trim(),
        timeline: form.timeline.trim(),
        successDefinition:
          form.successDefinition.trim(),
      },
    );

    for (const { key } of fields) {
      form[key] = "";
    }

    attempted.value = false;
    emit("created", result.goal);
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value =
        cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign in again."
          : cause.code === "INVALID_REQUEST"
            ? "Please check your goal details and try again."
            : "Could not create your goal. Please try again.";
    } else {
      error.value =
        "Something went wrong. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section
    class="goal-creator"
    aria-labelledby="goal-creator-title"
  >
    <div class="creator-intro">
      <div class="intro-copy">
        <span class="creator-eyebrow">
          BUILD YOUR NEXT CHAPTER
        </span>

        <h2 id="goal-creator-title">
          Let's make it happen.
          <span aria-hidden="true">✦</span>
        </h2>

        <p>
          A meaningful goal starts with a clear picture.
          Tell us where you're headed, and we'll help
          you build a strategy to get there.
        </p>
      </div>

      <div
        class="intro-art"
        aria-hidden="true"
      >
        ◎
      </div>
    </div>

    <div
      class="completion-summary"
      aria-live="polite"
    >
      <div class="completion-copy">
        <strong>Goal clarity</strong>

        <span>
          {{ completedCount }} of {{ fields.length }}
          sections completed
        </span>
      </div>

      <div
        class="progress-track"
        role="progressbar"
        aria-label="Goal form completion"
        :aria-valuenow="completedCount"
        :aria-valuemin="0"
        :aria-valuemax="fields.length"
      >
        <div
          class="progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <form
      class="creator-form"
      novalidate
      @submit.prevent="createGoal"
    >
      <fieldset :disabled="loading">
        <div
          v-for="field in fields"
          :key="field.key"
          class="question-card"
          :class="{
            'question-card--invalid':
              fieldMissing(field.key),
            'question-card--complete':
              form[field.key].trim().length > 0,
          }"
        >
          <div class="question-number">
            {{ field.number }}
          </div>

          <div class="question-body">
            <div class="question-heading">
              <label :for="`goal-${field.key}`">
                {{ field.label }}
              </label>

              <span
                v-if="form[field.key].trim()"
                class="completed-label"
              >
                ✓ Added
              </span>
            </div>

            <p class="question-description">
              {{ field.description }}
            </p>

            <textarea
              :id="`goal-${field.key}`"
              v-model="form[field.key]"
              :placeholder="field.placeholder"
              :aria-invalid="
                fieldMissing(field.key)
              "
              :aria-describedby="
                `goal-hint-${field.key}`
              "
              rows="3"
              required
            />

            <p
              :id="`goal-hint-${field.key}`"
              class="field-hint"
            >
              {{ field.hint }}
            </p>

            <p
              v-if="fieldMissing(field.key)"
              class="field-error"
            >
              This section is required.
            </p>
          </div>
        </div>

        <div class="creator-footer">
          <div class="footer-message">
            <span aria-hidden="true">✧</span>

            <div>
              <strong>
                Your goal, your way.
              </strong>

              <p>
                You can refine your plan as you learn
                what works.
              </p>
            </div>
          </div>

          <button
            type="submit"
            class="create-submit"
            :disabled="loading"
            :aria-busy="loading"
          >
            <span
              v-if="loading"
              class="spinner"
              aria-hidden="true"
            />

            {{
              loading
                ? "Creating your goal..."
                : "Create my goal"
            }}

            <span
              v-if="!loading"
              aria-hidden="true"
            >
              →
            </span>
          </button>
        </div>

        <p
          v-if="error"
          class="form-error"
          role="alert"
        >
          {{ error }}
        </p>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.goal-creator {
  width: 100%;
  min-width: 0;
}

.creator-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(
    115deg,
    #f1eafd,
    #faf7ff
  );
}

.creator-eyebrow {
  display: block;
  margin-bottom: 8px;
  color: #7550be;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.creator-intro h2 {
  margin: 0;
  color: #302440;
  font-size: clamp(23px, 3vw, 30px);
  letter-spacing: -0.04em;
}

.creator-intro h2 span {
  color: #a98ce4;
}

.creator-intro p {
  max-width: 530px;
  margin: 10px 0 0;
  color: #776b88;
  font-size: 13px;
  line-height: 1.7;
}

.intro-art {
  flex-shrink: 0;
  color: #bda7eb;
  font-size: 76px;
  line-height: 1;
}

.completion-summary {
  padding: 24px 3px 15px;
}

.completion-copy {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
  font-size: 12px;
}

.completion-copy strong {
  color: var(--text);
}

.completion-copy span {
  color: var(--muted);
}

.progress-track {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #ece4f8;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #8560d4;
  transition: width 0.2s ease;
}

.creator-form fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.question-card {
  display: flex;
  align-items: flex-start;
  gap: 17px;
  margin-top: 14px;
  padding: 20px;
  border: 1px solid #e8e0f2;
  border-radius: 15px;
  background: white;
  transition: border-color 0.2s ease;
}

.question-card:focus-within {
  border-color: #9474d6;
}

.question-card--invalid {
  border-color: #d58d9b;
}

.question-number {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  height: 38px;
  border-radius: 11px;
  background: #eee7fb;
  color: #7855c1;
  font-size: 12px;
  font-weight: 800;
}

.question-body {
  flex: 1;
  min-width: 0;
}

.question-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.question-heading label {
  color: var(--text);
  font-size: 15px;
  font-weight: 750;
  line-height: 1.4;
}

.completed-label {
  flex-shrink: 0;
  color: #7855c1;
  font-size: 11px;
  font-weight: 750;
}

.question-description {
  margin: 5px 0 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.question-body textarea {
  display: block;
  width: 100%;
  min-height: 90px;
  box-sizing: border-box;
  padding: 12px 13px;
  border: 1px solid #e2d9ee;
  border-radius: 10px;
  outline: none;
  background: #fcfbff;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}

.question-body textarea:focus {
  border-color: #8560d4;
  box-shadow: 0 0 0 3px rgba(
    133,
    96,
    212,
    0.12
  );
}

.question-body textarea::placeholder {
  color: #a199ad;
}

.field-hint {
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.field-error {
  margin: 8px 0 0;
  color: #a43d58;
  font-size: 12px;
  font-weight: 650;
}

.creator-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.footer-message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.footer-message > span {
  color: #a88bdc;
  font-size: 24px;
}

.footer-message strong {
  font-size: 13px;
}

.footer-message p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.create-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 46px;
  padding: 12px 20px;
  border: 0;
  border-radius: 11px;
  background: var(--accent);
  color: white;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.create-submit:hover:not(:disabled) {
  background: var(--accent-hover);
}

.create-submit:disabled {
  opacity: 0.7;
  cursor: wait;
}

.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(
    255,
    255,
    255,
    0.35
  );
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

.form-error {
  padding: 12px 14px;
  border-radius: 9px;
  background: #fff0f2;
  color: #a43d58;
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .creator-intro {
    padding: 18px;
  }

  .intro-art {
    display: none;
  }

  .question-card {
    gap: 11px;
    padding: 15px;
  }

  .question-number {
    flex-basis: 30px;
    height: 30px;
  }

  .creator-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .create-submit {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }

  .spinner {
    animation: none;
  }
}
</style>
