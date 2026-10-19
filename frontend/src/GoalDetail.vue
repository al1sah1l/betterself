<script setup lang="ts">
import { ref } from "vue";

import GoalDetailContent from "./GoalDetailContent.vue";
import ObservedResults from "./ObservedResults.vue";
import PlanControls from "./PlanControls.vue";

defineProps<{
  session: string;
  goal: string;
}>();

const revision = ref(0);
</script>

<template>
  <PlanControls
    :key="`plan-${session}-${goal}`"
    :session="session"
    :goal="goal"
    @saved="revision += 1"
  />

  <GoalDetailContent
    :key="`detail-${session}-${goal}-${revision}`"
    :session="session"
    :goal="goal"
  />

  <ObservedResults
    :key="`results-${session}-${goal}`"
    :session="session"
    :goal="goal"
  />
</template>
