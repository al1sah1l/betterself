<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
}>();

const emit = defineEmits<{
  created: [group: string];
}>();

const name = ref("");
const topic = ref("");
const loading = ref(false);
const error = ref("");

async function createGroup() {
  if (loading.value) return;

  error.value = "";

  const trimmedName = name.value.trim();
  const trimmedTopic = topic.value.trim();

  if (!trimmedName || !trimmedTopic) {
    error.value = "Enter a group name and topic.";
    return;
  }

  loading.value = true;

  try {
    const result = await api<{ group: string }>(
      "/groups/create",
      {
        session: props.session,
        name: trimmedName,
        topic: trimmedTopic,
      },
    );

    name.value = "";
    topic.value = "";
    emit("created", result.group);
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "INVALID_REQUEST"
            ? "Please check the group name and topic."
            : "Could not create your group. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not create your group. Please try again.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="createGroup">
    <fieldset :disabled="loading">
      <legend>Create a group</legend>

      <label for="group-name">Group name</label>
      <input
        id="group-name"
        v-model="name"
        placeholder="Reading Accountability"
        required
      />

      <label for="group-topic">Topic</label>
      <input
        id="group-topic"
        v-model="topic"
        placeholder="Reading"
        required
      />

      <button class="primary" type="submit">
        {{ loading ? "Creating..." : "Create group" }}
      </button>
    </fieldset>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>
