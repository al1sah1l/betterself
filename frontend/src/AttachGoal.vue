<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  goal: string;
}>();

const emit = defineEmits<{
  attached: [group: string];
}>();

type Group = {
  group: string;
  name: string;
  topic: string;
};

const groups = ref<Group[]>([]);
const selectedGroup = ref("");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const success = ref("");

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case "UNAUTHORIZED":
        return "Your session has expired. Please sign out and sign in again.";
      case "FORBIDDEN":
        return "You must own this goal and be a member of the group.";
      case "NOT_FOUND":
        return "The goal or group could not be found.";
      case "CONFLICT":
        return "This goal is already attached to a group.";
      default:
        return "Could not complete the request. Please try again.";
    }
  }

  return cause instanceof Error
    ? cause.message
    : "Could not complete the request. Please try again.";
}

async function loadGroups() {
  if (loading.value || saving.value) return;

  loading.value = true;
  error.value = "";

  try {
    const response = await api<{ groups: Group[] }>(
      "/dashboard/groups",
      { session: props.session },
    );

    groups.value = response.groups;

    if (!groups.value.some((group) => group.group === selectedGroup.value)) {
      selectedGroup.value = "";
    }
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

async function attachGoal() {
  if (loading.value || saving.value) return;

  error.value = "";
  success.value = "";

  const group = groups.value.find(
    (item) => item.group === selectedGroup.value,
  );

  if (!group) {
    error.value = "Choose a group.";
    return;
  }

  if (
    !window.confirm(
      `Attach this goal to "${group.name}"? Its existing and future proofs, including evidence and peer reviews, will be visible to group members.`,
    )
  ) {
    return;
  }

  saving.value = true;

  try {
    const result = await api<{ group: string }>(
      "/groups/attach-goal",
      {
        session: props.session,
        goal: props.goal,
        group: group.group,
      },
    );

    success.value = `Goal attached to ${group.name}.`;
    emit("attached", result.group);
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    saving.value = false;
  }
}

onMounted(loadGroups);
</script>

<template>
  <section class="attach-panel" aria-label="Goal accountability group">
    <h3>Accountability group</h3>

    <p class="muted">
      Attach this goal to one of your groups for peer feedback.
      Existing and future proofs, their evidence, and reviews will
      become visible to group members.
    </p>

    <p v-if="success" role="status">{{ success }}</p>

    <template v-else>
      <p v-if="loading" role="status">Loading groups...</p>

      <form v-else-if="groups.length" @submit.prevent="attachGoal">
        <fieldset :disabled="saving">
          <label :for="`goal-group-${props.goal}`">Group</label>

          <select
            :id="`goal-group-${props.goal}`"
            v-model="selectedGroup"
            required
          >
            <option disabled value="">Choose a group</option>
            <option
              v-for="group in groups"
              :key="group.group"
              :value="group.group"
            >
              {{ group.name }}
            </option>
          </select>

          <button class="primary" type="submit">
            {{ saving ? "Attaching..." : "Attach goal" }}
          </button>
        </fieldset>
      </form>

      <p v-else-if="!error" class="muted">
        Open Groups to create or join a group, then reload this list.
        You can still submit proof before joining a group.
      </p>

      <button
        class="text-button"
        type="button"
        :disabled="loading || saving"
        @click="loadGroups"
      >
        Reload available groups
      </button>
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.attach-panel {
  margin-top: 28px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--background);
}

h3 {
  margin: 0;
  font-size: 18px;
}

fieldset {
  min-width: 0;
}

select {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 600px) {
  .attach-panel {
    padding: 18px;
  }
}
</style>
