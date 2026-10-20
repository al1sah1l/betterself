<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";
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

type GroupSettings = Group & {
  owner: string;
  visibility: "public" | "private";
};

const groups = ref<GroupSettings[]>([]);
const loading = ref(false);
const error = ref("");
const success = ref("");

const search = ref("");
const publicGroups = ref<Group[]>([]);
const searching = ref(false);
const searched = ref(false);
const searchError = ref("");
const joining = ref("");

const createDialog = ref<HTMLDialogElement | null>(null);
const createName = ref("");
const createTopic = ref("");
const createVisibility = ref<"public" | "private">("private");
const creating = ref(false);
const createError = ref("");

const settingsDialog = ref<HTMLDialogElement | null>(null);
const selectedGroup = ref<GroupSettings | null>(null);
const settingsName = ref("");
const settingsTopic = ref("");
const settingsVisibility = ref<"public" | "private">("private");
const settingsBusy = ref(false);
const settingsError = ref("");

let loadVersion = 0;
let searchVersion = 0;

function message(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case "UNAUTHORIZED":
        return "Your session has expired. Please sign out and sign in again.";
      case "FORBIDDEN":
        return "You do not have permission to change this group.";
      case "NOT_FOUND":
        return "This group no longer exists. Reload your groups.";
      case "CONFLICT":
        return "You are already a member of this group.";
      case "INVALID_REQUEST":
        return "Check the name, topic, and visibility.";
      default:
        return fallback;
    }
  }

  return cause instanceof Error ? cause.message : fallback;
}

function isMember(group: string): boolean {
  return groups.value.some((item) => item.group === group);
}

async function loadGroups() {
  const version = ++loadVersion;
  loading.value = true;
  error.value = "";

  try {
    const response = await api<{ groups: Group[] }>(
      "/dashboard/groups",
      { session: props.session },
    );

    const settings = await Promise.all(
      response.groups.map(async (group) => {
        const result = await api<{ settings: GroupSettings }>(
          "/groups/settings",
          {
            session: props.session,
            group: group.group,
          },
        );

        return result.settings;
      }),
    );

    if (version === loadVersion) {
      groups.value = settings;
    }
  } catch (cause) {
    if (version === loadVersion) {
      error.value = message(cause, "Could not load your groups.");
    }
  } finally {
    if (version === loadVersion) {
      loading.value = false;
    }
  }
}

async function searchGroups() {
  const version = ++searchVersion;
  searching.value = true;
  searchError.value = "";

  try {
    const response = await api<{ groups: Group[] }>(
      "/dashboard/public-groups",
      {
        session: props.session,
        search: search.value.trim(),
      },
    );

    if (version === searchVersion) {
      publicGroups.value = response.groups;
      searched.value = true;
    }
  } catch (cause) {
    if (version === searchVersion) {
      searchError.value = message(
        cause,
        "Could not search groups. Please try again.",
      );
    }
  } finally {
    if (version === searchVersion) {
      searching.value = false;
    }
  }
}

async function joinPublicGroup(group: Group) {
  if (joining.value) return;

  joining.value = group.group;
  searchError.value = "";
  success.value = "";

  try {
    await api<{ group: string }>("/groups/join", {
      session: props.session,
      group: group.group,
    });

    success.value = `Joined ${group.name}.`;
    await loadGroups();
  } catch (cause) {
    searchError.value = message(cause, "Could not join this group.");

    if (cause instanceof ApiError && cause.code === "CONFLICT") {
      await loadGroups();
    }
  } finally {
    joining.value = "";
  }
}

function openCreate() {
  createError.value = "";
  createDialog.value?.showModal();
}

function closeCreate() {
  if (creating.value) return;
  createDialog.value?.close();
}

function cancelCreate(event: Event) {
  if (creating.value) event.preventDefault();
}

async function createGroup() {
  if (creating.value) return;

  const name = createName.value.trim();
  const topic = createTopic.value.trim();

  createError.value = "";

  if (!name || name.length > 100 || !topic || topic.length > 500) {
    createError.value =
      "Enter a name of 1–100 characters and a topic of 1–500 characters.";
    return;
  }

  creating.value = true;

  try {
    await api<{ group: string }>("/groups/create", {
      session: props.session,
      name,
      topic,
      visibility: createVisibility.value,
    });

    createName.value = "";
    createTopic.value = "";
    createVisibility.value = "private";
    createDialog.value?.close();

    success.value = "Group created.";
    await loadGroups();

    if (searched.value) await searchGroups();
  } catch (cause) {
    createError.value = message(cause, "Could not create your group.");
  } finally {
    creating.value = false;
  }
}

async function openSettings(group: GroupSettings) {
  selectedGroup.value = null;
  settingsError.value = "";
  settingsBusy.value = true;
  settingsDialog.value?.showModal();

  try {
    const response = await api<{ settings: GroupSettings }>(
      "/groups/settings",
      {
        session: props.session,
        group: group.group,
      },
    );

    if (response.settings.owner !== props.account) {
      settingsError.value = "Only the owner can change this group.";
      return;
    }

    selectedGroup.value = response.settings;
    settingsName.value = response.settings.name;
    settingsTopic.value = response.settings.topic;
    settingsVisibility.value = response.settings.visibility;
  } catch (cause) {
    settingsError.value = message(cause, "Could not load settings.");
  } finally {
    settingsBusy.value = false;
  }
}

function closeSettings() {
  if (settingsBusy.value) return;
  settingsDialog.value?.close();
}

function cancelSettings(event: Event) {
  if (settingsBusy.value) event.preventDefault();
}

async function saveSettings() {
  if (settingsBusy.value || !selectedGroup.value) return;

  const name = settingsName.value.trim();
  const topic = settingsTopic.value.trim();

  settingsError.value = "";

  if (!name || name.length > 100 || !topic || topic.length > 500) {
    settingsError.value =
      "Enter a name of 1–100 characters and a topic of 1–500 characters.";
    return;
  }

  if (
    selectedGroup.value.visibility === "private" &&
    settingsVisibility.value === "public" &&
    !window.confirm(
      "Make this group public? Registered users will be able to find and join it, then see its shared proofs.",
    )
  ) {
    return;
  }

  settingsBusy.value = true;

  try {
    await api<{ group: string }>("/groups/update", {
      session: props.session,
      group: selectedGroup.value.group,
      name,
      topic,
      visibility: settingsVisibility.value,
    });

    settingsDialog.value?.close();
    success.value = "Group settings saved.";

    await loadGroups();
    if (searched.value) await searchGroups();
  } catch (cause) {
    settingsError.value = message(cause, "Could not save settings.");
  } finally {
    settingsBusy.value = false;
  }
}

async function deleteGroup() {
  if (settingsBusy.value || !selectedGroup.value) return;

  const group = selectedGroup.value;

  if (
    !window.confirm(
      `Delete "${group.name}" for all members? Goals will be detached. Goals, commitments, proofs, and reviews will be kept.`,
    )
  ) {
    return;
  }

  settingsBusy.value = true;
  settingsError.value = "";

  try {
    await api<{ group: string }>("/groups/delete", {
      session: props.session,
      group: group.group,
    });

    groups.value = groups.value.filter(
      (item) => item.group !== group.group,
    );
    publicGroups.value = publicGroups.value.filter(
      (item) => item.group !== group.group,
    );

    settingsDialog.value?.close();
    selectedGroup.value = null;
    success.value = "Group deleted. Goals and proofs were kept.";

    await loadGroups();
    if (searched.value) await searchGroups();
  } catch (cause) {
    settingsError.value = message(cause, "Could not delete this group.");
  } finally {
    settingsBusy.value = false;
  }
}

onMounted(loadGroups);
</script>

<template>
  <section class="my-groups" aria-labelledby="my-groups-heading">
    <header class="section-header">
      <div>
        <h2 id="my-groups-heading">Accountability groups</h2>
        <p class="muted">
          Find people to share progress with, or create a space for friends.
        </p>
      </div>

      <button class="primary" type="button" @click="openCreate">
        + Create group
      </button>
    </header>

    <p v-if="success" class="feedback" role="status">
      {{ success }}
    </p>

    <section class="discovery-panel" aria-labelledby="discover-groups">
      <h3 id="discover-groups">Find a public group</h3>
      <p class="muted">
        Search by name or topic. Leave the search empty to browse.
        Shared proofs are visible after you join.
      </p>

      <form class="search-form" @submit.prevent="searchGroups">
        <label for="public-group-search">Name or topic</label>
        <div class="search-row">
          <input
            id="public-group-search"
            v-model="search"
            maxlength="100"
            placeholder="Reading, fitness, career..."
          />
          <button
            class="primary"
            type="submit"
            :disabled="searching"
          >
            {{ searching ? "Searching..." : "Search" }}
          </button>
        </div>
      </form>

      <p v-if="searching" class="muted" role="status">
        Searching public groups...
      </p>
      <p v-if="searchError" class="error" role="alert">
        {{ searchError }}
      </p>

      <ul v-if="publicGroups.length" class="discovery-list">
        <li v-for="group in publicGroups" :key="group.group">
          <div>
            <strong>{{ group.name }}</strong>
            <p class="muted">{{ group.topic }}</p>
          </div>

          <button
            class="primary"
            type="button"
            :disabled="Boolean(joining) || loading || isMember(group.group)"
            @click="joinPublicGroup(group)"
          >
            {{
              isMember(group.group)
                ? "Joined"
                : joining === group.group
                  ? "Joining..."
                  : "Join group"
            }}
          </button>
        </li>
      </ul>

      <p
        v-else-if="searched && !searching && !searchError"
        class="muted"
      >
        No public groups found. Try another topic or create one.
      </p>
    </section>

    <details class="invitation-panel">
      <summary>Have a group invitation?</summary>
      <p class="muted">
        Paste the Group ID shared with you. Private groups do not appear
        in search.
      </p>
      <JoinGroup :session="props.session" @joined="loadGroups" />
    </details>

    <header class="section-header membership-heading">
      <h3>Your groups</h3>
      <button
        class="text-button"
        type="button"
        :disabled="loading"
        @click="loadGroups"
      >
        {{ loading ? "Loading..." : "Reload groups" }}
      </button>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="loading" class="muted" role="status">Loading groups...</p>

    <ul v-if="groups.length" class="group-list">
      <li
        v-for="group in groups"
        :key="group.group"
        class="group-card"
      >
        <header class="group-header">
          <div>
            <div class="group-title">
              <h3>{{ group.name }}</h3>
              <span class="visibility-badge">
                {{ group.visibility === "public" ? "Public" : "Private" }}
              </span>
            </div>
            <p class="muted">{{ group.topic }}</p>
          </div>

          <button
            v-if="group.owner === props.account"
            class="text-button"
            type="button"
            @click="openSettings(group)"
          >
            Settings
          </button>
        </header>

        <p class="group-id">Group ID: {{ group.group }}</p>
        <p v-if="group.visibility === 'private'" class="invitation-hint">
          Share this ID only with people you want to invite.
        </p>

        <GroupProofs
          :session="props.session"
          :group="group.group"
          :account="props.account"
        />
      </li>
    </ul>

    <p v-else-if="!loading && !error" class="empty-state">
      You have no groups yet. Find a public group, join by invitation,
      or create your own.
    </p>

    <dialog
      ref="createDialog"
      class="group-dialog"
      aria-labelledby="create-group-title"
      @cancel="cancelCreate"
    >
      <header class="dialog-header">
        <h3 id="create-group-title">Create a group</h3>
        <button
          class="text-button"
          type="button"
          :disabled="creating"
          @click="closeCreate"
        >
          Close
        </button>
      </header>

      <form @submit.prevent="createGroup">
        <fieldset :disabled="creating">
          <label for="create-group-name">Group name</label>
          <input
            id="create-group-name"
            v-model="createName"
            maxlength="100"
            required
            placeholder="Career Circle"
          />

          <label for="create-group-topic">Topic</label>
          <input
            id="create-group-topic"
            v-model="createTopic"
            maxlength="500"
            required
            placeholder="Internship applications and interviews"
          />

          <label for="create-group-visibility">Visibility</label>
          <select
            id="create-group-visibility"
            v-model="createVisibility"
          >
            <option value="private">Private — invite by Group ID</option>
            <option value="public">Public — discoverable in search</option>
          </select>

          <p class="visibility-description">
            {{
              createVisibility === "private"
                ? "Your group will not appear in search. Anyone with its Group ID can join."
                : "Registered users can find and join your group. After joining, they can see shared proofs."
            }}
          </p>

          <button class="primary" type="submit">
            {{ creating ? "Creating..." : "Create group" }}
          </button>
        </fieldset>
      </form>

      <p v-if="createError" class="error" role="alert">
        {{ createError }}
      </p>
    </dialog>

    <dialog
      ref="settingsDialog"
      class="group-dialog"
      aria-labelledby="group-settings-title"
      @cancel="cancelSettings"
    >
      <header class="dialog-header">
        <h3 id="group-settings-title">Group settings</h3>
        <button
          class="text-button"
          type="button"
          :disabled="settingsBusy"
          @click="closeSettings"
        >
          Close
        </button>
      </header>

      <p v-if="settingsBusy && !selectedGroup" role="status">
        Loading settings...
      </p>

      <form v-if="selectedGroup" @submit.prevent="saveSettings">
        <fieldset :disabled="settingsBusy">
          <label for="settings-group-name">Group name</label>
          <input
            id="settings-group-name"
            v-model="settingsName"
            maxlength="100"
            required
          />

          <label for="settings-group-topic">Topic</label>
          <input
            id="settings-group-topic"
            v-model="settingsTopic"
            maxlength="500"
            required
          />

          <label for="settings-group-visibility">Visibility</label>
          <select
            id="settings-group-visibility"
            v-model="settingsVisibility"
          >
            <option value="private">Private — invite by Group ID</option>
            <option value="public">Public — discoverable in search</option>
          </select>

          <p class="visibility-description">
            Making a group private hides it from search. Existing members
            keep their access.
          </p>

          <button class="primary" type="submit">
            {{ settingsBusy ? "Please wait..." : "Save settings" }}
          </button>
        </fieldset>
      </form>

      <p v-if="settingsError" class="error" role="alert">
        {{ settingsError }}
      </p>

      <section v-if="selectedGroup" class="danger-zone">
        <h4>Delete group</h4>
        <p>
          Removes the group for everyone and detaches its goals.
          Goals, commitments, proofs, and reviews are kept.
        </p>
        <button
          class="danger-button"
          type="button"
          :disabled="settingsBusy"
          @click="deleteGroup"
        >
          Delete group
        </button>
      </section>
    </dialog>
  </section>
</template>

<style scoped>
.my-groups {
  margin-top: 28px;
  overflow-wrap: anywhere;
}

.section-header,
.group-header,
.group-title,
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-header h2,
.section-header h3,
.group-header h3,
.dialog-header h3 {
  margin: 0;
}

.section-header > .primary {
  flex-shrink: 0;
}

.section-header .muted {
  margin: 10px 0 0;
}

.discovery-panel {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--background);
}

.discovery-panel h3 {
  margin: 0;
}

.search-form {
  margin-top: 20px;
}

.search-form label {
  display: block;
  margin-bottom: 8px;
}

.search-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.search-row input {
  min-width: 0;
  margin: 0;
}

.search-row button {
  flex-shrink: 0;
}

.discovery-list,
.group-list {
  display: grid;
  gap: 16px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.discovery-list > li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.discovery-list .muted {
  margin: 6px 0 0;
}

.discovery-list button {
  flex-shrink: 0;
}

.invitation-panel {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
}

summary {
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}

summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.membership-heading {
  margin-top: 32px;
}

.membership-heading .text-button,
.group-header .text-button,
.dialog-header .text-button {
  margin: 0;
  flex-shrink: 0;
}

.group-card {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
}

.group-header {
  align-items: flex-start;
}

.group-title {
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}

.group-title h3 {
  font-size: 20px;
}

.visibility-badge {
  padding: 5px 10px;
  border-radius: 999px;
  background: #eee8fb;
  color: #6041b1;
  font-size: 12px;
  font-weight: 650;
}

.group-id,
.invitation-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.invitation-hint {
  margin-top: -4px;
}

.feedback {
  padding: 12px 16px;
  border-radius: 10px;
  background: #eee8fb;
  color: #6041b1;
  line-height: 1.6;
}

.empty-state {
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  color: var(--muted);
  line-height: 1.6;
}

.group-dialog {
  width: min(540px, calc(100% - 32px));
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 80px rgb(29 20 50 / 20%);
}

.group-dialog::backdrop {
  background: rgb(29 20 50 / 45%);
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

.visibility-description {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.danger-zone {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.danger-zone h4 {
  margin: 0;
}

.danger-zone p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.danger-button {
  padding: 10px 16px;
  border: 1px solid #a32939;
  border-radius: 8px;
  background: var(--surface);
  color: #a32939;
  font: inherit;
  font-weight: 600;
}

@media (max-width: 600px) {
  .section-header,
  .group-header,
  .discovery-list > li {
    align-items: flex-start;
    flex-direction: column;
  }

  .search-row {
    flex-direction: column;
  }

  .discovery-panel,
  .group-card,
  .group-dialog {
    padding: 20px;
  }
}
</style>
