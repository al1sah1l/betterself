<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";
import CreateGroup from "./CreateGroup.vue";
import JoinGroup from "./JoinGroup.vue";
import GroupProofs from "./GroupProofs.vue";

const props = defineProps<{
  session: string;
  account: string;
}>();

type Group = {
  group: string;
  name: string;
  topic: string;
};

const groups = ref<Group[]>([]);
const loading = ref(false);
const error = ref("");

async function loadGroups() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ groups: Group[] }>(
      "/dashboard/groups",
      { session: props.session },
    );

    groups.value = result.groups;
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.code === "UNAUTHORIZED"
        ? "Your session has expired. Please sign out and sign in again."
        : cause instanceof Error && !(cause instanceof ApiError)
          ? cause.message
          : "Could not load your groups. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadGroups);
</script>

<template>
  <section class="my-groups" aria-labelledby="my-groups-heading">
    <h2 id="my-groups-heading">My groups</h2>

    <CreateGroup
        :session="props.session"
        @created="loadGroups"
    />

    <JoinGroup
        :session="props.session"
        @joined="loadGroups"
    />

    <p v-if="loading" role="status">Loading groups...</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>

    <template v-else>
      <p v-if="groups.length === 0" class="muted">
        No groups yet. Create or join a group to share your progress.
      </p>

      <ul v-else>
        <li v-for="group in groups" :key="group.group">
          <strong>{{ group.name }}</strong>
          <p class="muted">{{ group.topic }}</p>
          <p class="group-id">Group ID: {{ group.group }}</p>

          <GroupProofs
            :session="props.session"
            :group="group.group"
            :account="props.account"
          />
        </li>
      </ul>
    </template>

    <button
      class="text-button"
      type="button"
      :disabled="loading"
      @click="loadGroups"
    >
      Reload groups
    </button>
  </section>
</template>

<style scoped>
.my-groups {
  margin-top: 32px;
}

li {
  margin-bottom: 20px;
}

.group-id {
  font-size: 13px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
</style>
