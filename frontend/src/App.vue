
<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";
import MyGoals from "./MyGoals.vue";
import MyGroups from "./MyGroups.vue";
import Dashboard from "./Dashboard.vue";
import AllCommitments from "./AllCommitments.vue";

type AuthResponse = {
  account: string;
  session: string;
  expiresAt: string;
};

type Page =
  | "dashboard"
  | "goals"
  | "commitments"
  | "groups";

const mode = ref<"sign-in" | "register">("sign-in");
const username = ref("");
const password = ref("");
const account = ref("");
const session = ref("");
const loading = ref(false);
const error = ref("");

const activePage = ref<Page>("dashboard");
const selectedGoalFromOverview = ref("");

const pages: {
  id: Page;
  icon: string;
  title: string;
}[] = [
  { id: "dashboard", icon: "◫", title: "Dashboard" },
  { id: "goals", icon: "◎", title: "Goals" },
  { id: "commitments", icon: "✓", title: "Commitments" },
  { id: "groups", icon: "♧", title: "Groups" },
];

function navigate(page: Page) {
  selectedGoalFromOverview.value = "";
  activePage.value = page;
}

function openGoal(goal: string) {
  selectedGoalFromOverview.value = goal;
  activePage.value = "goals";
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "UNAUTHORIZED") {
      return "Your username or password is incorrect. Please try again.";
    }

    if (cause.code === "CONFLICT") {
      return "That username is already taken. Please choose another.";
    }

    if (cause.code === "INVALID_REQUEST") {
      return "Please check your username and password.";
    }

    return "Something went wrong. Please try again.";
  }

  return cause instanceof Error
    ? cause.message
    : "Something went wrong. Please try again.";
}

function switchMode() {
  mode.value =
    mode.value === "sign-in" ? "register" : "sign-in";
  error.value = "";
  password.value = "";
}

async function authenticate() {
  if (loading.value) return;

  error.value = "";

  if (!username.value.trim() || !password.value) {
    error.value = "Enter your username and password.";
    return;
  }

  if (mode.value === "register") {
    if (
      !/^[A-Za-z0-9_-]{3,32}$/.test(
        username.value.trim(),
      )
    ) {
      error.value =
        "Username must contain 3–32 letters, numbers, underscores, or hyphens.";
      return;
    }

    if (
      password.value.length < 8 ||
      password.value.length > 128
    ) {
      error.value =
        "Password must contain 8–128 characters.";
      return;
    }
  }

  loading.value = true;

  try {
    const result = await api<AuthResponse>(
      `/auth/${mode.value}`,
      {
        username: username.value.trim(),
        password: password.value,
      },
    );

    account.value = result.account;
    session.value = result.session;
    password.value = "";
    activePage.value = "dashboard";
    selectedGoalFromOverview.value = "";
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

async function signOut() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    await api<{ signedOut: boolean }>("/auth/sign-out", {
      session: session.value,
    });

    account.value = "";
    session.value = "";
  } catch (cause) {
    if (
      cause instanceof ApiError &&
      cause.code === "UNAUTHORIZED"
    ) {
      account.value = "";
      session.value = "";
    } else {
      error.value = errorMessage(cause);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main
    class="auth-card"
    :class="{ 'signed-in': session }"
  >
    <div v-if="!session" class="brand">
      BetterSelf
    </div>

    <p v-if="!session" class="tagline">
      Your goals, one commitment at a time.
    </p>

    <template v-if="!session">
      <h1>
        {{
          mode === "sign-in"
            ? "Welcome back"
            : "Start your journey"
        }}
      </h1>

      <p class="muted">
        {{
          mode === "sign-in"
            ? "Sign in to continue working toward your goals."
            : "Create an account to turn your goals into action."
        }}
      </p>

      <form @submit.prevent="authenticate">
        <fieldset :disabled="loading">
          <label for="username">Username</label>

          <input
            id="username"
            v-model="username"
            autocomplete="username"
            required
          />

          <label for="password">Password</label>

          <input
            id="password"
            v-model="password"
            type="password"
            :autocomplete="
              mode === 'sign-in'
                ? 'current-password'
                : 'new-password'
            "
            required
          />

          <p
            v-if="mode === 'register'"
            class="muted"
          >
            Password must contain 8–128 characters.
          </p>

          <button
            class="primary"
            type="submit"
          >
            {{
              loading
                ? "Please wait..."
                : mode === "sign-in"
                  ? "Sign in"
                  : "Create account"
            }}
          </button>
        </fieldset>
      </form>

      <button
        class="text-button"
        type="button"
        :disabled="loading"
        @click="switchMode"
      >
        {{
          mode === "sign-in"
            ? "New to BetterSelf? Create an account"
            : "Already have an account? Sign in"
        }}
      </button>
    </template>

    <template v-else>
      <div class="app-shell">
        <aside
          class="app-sidebar"
          aria-label="Workspace sidebar"
        >
          <div class="sidebar-brand">
            BetterSelf
          </div>

          <p class="sidebar-subtitle">
            Your goals, one commitment at a time.
          </p>

          <nav
            class="sidebar-nav"
            aria-label="Main navigation"
          >
            <button
              v-for="page in pages"
              :key="page.id"
              type="button"
              :aria-current="
                activePage === page.id
                  ? 'page'
                  : undefined
              "
              @click="navigate(page.id)"
            >
              <span
                class="nav-symbol"
                aria-hidden="true"
              >
                {{ page.icon }}
              </span>
              {{ page.title }}
            </button>
          </nav>

          <div class="sidebar-bottom">
            <span class="signed-in-as">
              Signed in as
              <strong>{{ account }}</strong>
            </span>

            <button
              type="button"
              class="signout-button"
              :disabled="loading"
              @click="signOut"
            >
              {{
                loading
                  ? "Signing out…"
                  : "Sign out"
              }}
            </button>
          </div>
        </aside>

        <div class="workspace-main">
          <div class="workspace-topbar">
            <span class="workspace-topbar-brand">
              BetterSelf
            </span>
            <span>{{ account }}</span>
          </div>

          <KeepAlive>
            <Dashboard
              v-if="activePage === 'dashboard'"
              :key="`dashboard-${session}`"
              :session="session"
              :account="account"
              @navigate="navigate"
              @open-goal="openGoal"
            />

            <MyGoals
              v-else-if="activePage === 'goals'"
              :key="`goals-${session}`"
              :session="session"
              :requested-goal="selectedGoalFromOverview"
            />

            <AllCommitments
              v-else-if="activePage === 'commitments'"
              :key="`commitments-${session}`"
              :session="session"
              @open-goal="openGoal"
            />

            <MyGroups
              v-else
              :key="`groups-${session}`"
              :session="session"
              :account="account"
            />
          </KeepAlive>

          <p
            v-if="error"
            class="error"
            role="alert"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </template>

    <p
      v-if="error && !session"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </main>
</template>

<style>
:root {
  --accent: #7354c5;
  --accent-hover: #6041b1;
  --background: #f7f5fc;
  --surface: #ffffff;
  --text: #29243b;
  --muted: #726b82;
  --border: #ded9ea;

  font-family: system-ui, sans-serif;
  color: var(--text);
  background: var(--background);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.auth-card {
  width: min(460px, calc(100% - 32px));
  margin: 64px auto;
  padding: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
}

.auth-card.signed-in {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: var(--background);
}

.brand {
  font-size: 24px;
  font-weight: 750;
  color: var(--accent);
}

.tagline,
.muted {
  color: var(--muted);
  line-height: 1.6;
}

.tagline {
  margin-bottom: 32px;
}

h1 {
  font-size: 28px;
  margin-bottom: 8px;
  overflow-wrap: anywhere;
}

.account-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 32px;
}

.account-header button {
  flex-shrink: 0;
}

fieldset {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 24px 0 0;
  border: 0;
}

label {
  font-size: 14px;
  font-weight: 600;
}

input {
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
}

input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button {
  font: inherit;
  cursor: pointer;
}

.primary {
  padding: 12px 20px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-weight: 600;
}

.primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.text-button {
  margin-top: 20px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  text-align: left;
  line-height: 1.5;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.error {
  padding: 12px;
  border-radius: 8px;
  background: #fff0f0;
  color: #a32939;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .auth-card:not(.signed-in) {
    margin: 24px auto;
    padding: 24px;
  }

  .account-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

.page-nav {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.page-nav button {
  margin-top: 0;
  padding: 12px 4px;
  border-bottom: 3px solid transparent;
}

.page-nav button[aria-current="page"] {
  border-bottom-color: var(--accent);
  font-weight: 700;
}
</style>

<style>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 245px minmax(0, 1fr);
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 31px 19px;
  background: #fff;
  border-right: 1px solid var(--border);
}

.sidebar-brand {
  font-size: 25px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.7px;
}

.sidebar-subtitle {
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
  margin: 0 0 26px;
}

.sidebar-nav {
  display: grid;
  gap: 7px;
}

.sidebar-nav button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: 0;
  border-radius: 11px;
  padding: 13px 14px;
  background: transparent;
  text-align: left;
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
}

.sidebar-nav button:hover {
  background: var(--background);
}

.sidebar-nav button[aria-current="page"] {
  background: #eee8fc;
  color: var(--accent);
  font-weight: 750;
}

.nav-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  font-size: 19px;
}

.sidebar-bottom {
  margin-top: auto;
  padding: 20px 8px 0;
  border-top: 1px solid var(--border);
  display: grid;
  gap: 12px;
}

.signed-in-as {
  font-size: 12px;
  color: var(--muted);
  overflow-wrap: anywhere;
}

.signed-in-as strong {
  color: var(--text);
}

.signout-button {
  width: 100%;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #fff;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.workspace-main {
  width: min(1130px, 100%);
  min-width: 0;
  margin: 0 auto;
  padding: 38px clamp(18px, 4vw, 52px) 80px;
}

.workspace-topbar {
  display: none;
}

@media (max-width: 760px) {
  .app-shell {
    display: block;
  }

  .app-sidebar {
    position: static;
    height: auto;
    padding: 12px 16px;
    gap: 9px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-brand,
  .sidebar-subtitle {
    display: none;
  }

  .sidebar-nav {
    display: flex;
    gap: 5px;
    overflow-x: auto;
  }

  .sidebar-nav button {
    white-space: nowrap;
    width: auto;
    padding: 9px 11px;
    font-size: 13px;
  }

  .sidebar-bottom {
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 0;
  }

  .signout-button {
    width: auto;
    font-size: 12px;
    padding: 7px 10px;
  }

  .workspace-main {
    padding: 24px 16px 50px;
  }
}
</style>
