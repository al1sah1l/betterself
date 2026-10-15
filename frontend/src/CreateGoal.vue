<script setup lang="ts">
import { reactive, ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
}>();

const emit = defineEmits<{
  created: [goal: string];
}>();

const fields = [
  {
    key: "outcome",
    label: "Desired outcome",
    placeholder: "Get a software engineering internship",
  },
  {
    key: "currentContext",
    label: "Where are you starting?",
    placeholder: "I have a resume but have not started applying.",
  },
  {
    key: "constraints",
    label: "Constraints",
    placeholder: "Five hours per week.",
  },
  {
    key: "timeline",
    label: "Timeline",
    placeholder: "By summer 2027",
  },
  {
    key: "successDefinition",
    label: "What would success look like?",
    placeholder: "Receive and accept an internship offer.",
  },
] as const;

const form = reactive({
  outcome: "",
  currentContext: "",
  constraints: "",
  timeline: "",
  successDefinition: "",
});

const loading = ref(false);
const error = ref("");

async function createGoal() {
  if (loading.value) return;

  error.value = "";

  if (fields.some(({ key }) => !form[key].trim())) {
    error.value = "Please complete every field.";
    return;
  }

  loading.value = true;

  try {
    const result = await api<{ goal: string }>("/goals/create", {
      session: props.session,
      outcome: form.outcome.trim(),
      currentContext: form.currentContext.trim(),
      constraints: form.constraints.trim(),
      timeline: form.timeline.trim(),
      successDefinition: form.successDefinition.trim(),
    });

    for (const { key } of fields) {
      form[key] = "";
    }

    emit("created", result.goal);
  } catch (cause) {
    if (cause instanceof ApiError) {
      error.value =
        cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "INVALID_REQUEST"
            ? "Please check the goal details and try again."
            : "Could not create your goal. Please try again.";
    } else {
      error.value =
        cause instanceof Error
          ? cause.message
          : "Could not create your goal. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section aria-labelledby="create-goal-heading">
    <h2 id="create-goal-heading">Create a goal</h2>

    <form @submit.prevent="createGoal">
      <fieldset :disabled="loading">
        <template v-for="field in fields" :key="field.key">
          <label :for="`goal-${field.key}`">{{ field.label }}</label>

          <textarea
            :id="`goal-${field.key}`"
            v-model="form[field.key]"
            :placeholder="field.placeholder"
            rows="2"
            required
          />
        </template>

        <button class="primary" type="submit">
          {{ loading ? "Creating..." : "Create goal" }}
        </button>
      </fieldset>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
textarea {
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}

textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
