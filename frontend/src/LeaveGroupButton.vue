
<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";

const props = defineProps<{
  session: string;
  group: string;
  name: string;
}>();

const emit = defineEmits<{
  left: [];
}>();

const busy = ref(false);
const error = ref("");

async function leave() {
  if (busy.value) return;

  const confirmed = window.confirm(
    `Leave "${props.name}"?\n\n` +
    "You will lose access to its shared proofs. " +
    "Your goals and personal proofs will be kept, " +
    "but your goals will be detached from this group.",
  );

  if (!confirmed) return;

  busy.value = true;
  error.value = "";

  try {
    await api<{ left: boolean }>(
      "/groups/leave",
      {
        session: props.session,
        group: props.group,
      },
    );

    emit("left");
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "CONFLICT"
          ? "Group owners cannot leave. Delete the group instead."
          : cause.code === "FORBIDDEN"
            ? "You are not a member of this group."
            : "Could not leave the group."
        : "Could not leave the group. Please retry.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="leave-group-action">
    <button
      type="button"
      class="leave-button"
      :disabled="busy"
      @click="leave"
    >
      {{ busy ? "Leaving..." : "Leave group" }}
    </button>

    <p v-if="error" class="leave-error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.leave-group-action {
  margin: 14px 0;
}

.leave-button {
  padding: 9px 14px;
  border: 1px solid #ded5ed;
  border-radius: 10px;
  background: white;
  color: #7653b8;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.leave-button:hover:not(:disabled) {
  background: #f3edff;
}

.leave-error {
  font-size: 12px;
  color: #a32939;
}
</style>
