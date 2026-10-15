<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError } from "./api";
import ReviewProof from "./ReviewProof.vue";

const props = defineProps<{
  session: string;
  group: string;
  account: string;
}>();

type Verification = {
  reviewer: string;
  decision: "verified" | "disputed";
  note: string;
};

type SharedProof = {
  proof: string;
  submitter: string;
  goal: string;
  commitment: string;
  occurrence: string;
  evidence: string[];
  verifications: Verification[];
};

const proofs = ref<SharedProof[]>([]);
const loading = ref(false);
const error = ref("");

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : value;
}

async function loadProofs() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    const result = await api<{ proofs: SharedProof[] }>(
      "/dashboard/group-proofs",
      {
        session: props.session,
        group: props.group,
      },
    );

    proofs.value = result.proofs;
  } catch (cause) {
    error.value =
      cause instanceof ApiError
        ? cause.code === "UNAUTHORIZED"
          ? "Your session has expired. Please sign out and sign in again."
          : cause.code === "FORBIDDEN"
            ? "Only group members can view these proofs."
            : cause.code === "NOT_FOUND"
              ? "This group could not be found."
              : "Could not load proofs. Please try again."
        : cause instanceof Error
          ? cause.message
          : "Could not load proofs. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadProofs);
</script>

<template>
  <section class="group-proofs" aria-label="Shared group proofs">
    <h3>Shared proofs</h3>

    <p v-if="loading" role="status">Loading proofs...</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>

    <template v-else>
      <p v-if="proofs.length === 0" class="muted">
        No proofs have been shared with this group yet.
      </p>

      <article
        v-for="proof in proofs"
        :key="proof.proof"
        class="proof-card"
      >
        <h4>Proof from {{ proof.submitter }}</h4>
        <p class="muted">
          Completed at: {{ formatDate(proof.occurrence) }}
        </p>

        <h5>Evidence</h5>
        <ul>
          <li
            v-for="(item, index) in proof.evidence"
            :key="index"
            class="evidence"
          >
            {{ item }}
          </li>
        </ul>

        <h5>Peer verification</h5>

        <p v-if="proof.verifications.length === 0" class="muted">
          No peer reviews yet.
        </p>

        <ul v-else>
          <li
            v-for="verification in proof.verifications"
            :key="verification.reviewer"
          >
            <strong>{{ verification.reviewer }}</strong>
            · {{ verification.decision }}
            <p class="evidence">{{ verification.note }}</p>
          </li>
        </ul>

        <ReviewProof
            v-if="
                proof.submitter !== props.account &&
                !proof.verifications.some(
                (verification) => verification.reviewer === props.account
                )
            "
            :session="props.session"
            :proof="proof.proof"
            @reviewed="loadProofs"
        />

      </article>
    </template>

    <button
      class="text-button"
      type="button"
      :disabled="loading"
      @click="loadProofs"
    >
      Reload proofs
    </button>
  </section>
</template>

<style scoped>
.group-proofs {
  margin-top: 20px;
}

.proof-card {
  margin-top: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow-wrap: anywhere;
}

h4 {
  margin-top: 0;
}

h5 {
  margin: 20px 0 8px;
  font-size: 14px;
}

.evidence {
  white-space: pre-wrap;
}
</style>
