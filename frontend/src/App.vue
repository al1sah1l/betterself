<script setup lang="ts">
import { ref } from "vue";
import { api, ApiError } from "./api";
import MyGoals from "./MyGoals.vue";
import MyGroups from "./MyGroups.vue";

type AuthResponse = {
  account: string;
  session: string;
  expiresAt: string;
};

const mode = ref<"sign-in" | "register">("sign-in");
const username = ref("");
const password = ref("");
const account = ref("");
const session = ref("");
const loading = ref(false);
const error = ref("");

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
  mode.value = mode.value === "sign-in" ? "register" : "sign-in";
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
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username.value.trim())) {
      error.value =
        "Username must contain 3–32 letters, numbers, underscores, or hyphens.";
      return;
    }

    if (password.value.length < 8 || password.value.length > 128) {
      error.value = "Password must contain 8–128 characters.";
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
    if (cause instanceof ApiError && cause.code === "UNAUTHORIZED") {
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
  <main class="auth-card" :class="{ 'signed-in': session }">
    <div class="brand">BetterSelf</div>
    <p class="tagline">Your goals, one commitment at a time.</p>

    <template v-if="!session">
      <h1>
        {{ mode === "sign-in" ? "Welcome back" : "Start your journey" }}
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
              mode === 'sign-in' ? 'current-password' : 'new-password'
            "
            required
          />

          <p v-if="mode === 'register'" class="muted">
            Password must contain 8–128 characters.
          </p>

          <button class="primary" type="submit">
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
      <header class="account-header">
        <div>
          <h1>Hello, {{ account }}!</h1>
          <p class="muted">
            You're signed in and ready to work on your goals.
          </p>
        </div>

        <button
          class="primary"
          type="button"
          :disabled="loading"
          @click="signOut"
        >
          {{ loading ? "Signing out..." : "Sign out" }}
        </button>
      </header>

      <MyGoals :key="session" :session="session" />
      <MyGroups
        :key="session"
        :session="session"
        :account="account"
      />
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
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
  width: min(900px, calc(100% - 32px));
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
  .auth-card {
    margin: 24px auto;
    padding: 24px;
  }

  .account-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
