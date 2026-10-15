<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
}>();

const emit = defineEmits<{
  joined: [group: string];
}>();

const group = ref("");
const loading = ref(false);
const error = ref("");

async function joinGroup() {
  if (loading.value) return;

  error.value = "";
  const groupId = group.value.trim();

  if (!groupId) {
    error.value = "Enter a group ID.";
    return;
  }

  loading.value = true;

  try {
    const result = await api<{ group: string }>(
      "/groups/join",
      {
        session: props.session,
        group: groupId,
      },
    );

    group.value = "";
    emit("joined", result.group);
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "NOT_FOUND"
            ? "No group was found with that ID."
            : cause.code === "CONFLICT"
              ? "You are already a member of this group."
              : cause.code === "INVALID_REQUEST"
                ? "Please check the group ID."
                : "Could not join the group. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not join the group. Please try again.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="joinGroup">
    <fieldset :disabled="loading">
      <legend>Join a group</legend>

      <label for="join-group-id">Group ID</label>
      <input
        id="join-group-id"
        v-model="group"
        placeholder="Paste a group ID"
        required
      />

      <button class="primary" type="submit">
        {{ loading ? "Joining..." : "Join group" }}
      </button>
    </fieldset>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>
</template>
